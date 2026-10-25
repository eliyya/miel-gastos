export const VENDOR_CACHE_TTL = 24 * 60 * 60 * 1000;
const KEY = "miel:expense-vendors:v1";
type Cache = { vendors: string[]; checkedAt: number | null };
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

function normalize(values: string[]) {
  const unique = new Map<string, string>();
  for (const value of values) {
    const name = value.trim();
    if (name) unique.set(name.toLocaleLowerCase("es"), name);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, "es"));
}

export function createVendorCache(storage: () => Storage, now = Date.now, key = KEY) {
  let memory: Cache = { vendors: [], checkedAt: null };
  let pending: Promise<string[]> | undefined;
  function read(): Cache {
    try {
      const parsed = JSON.parse(storage().getItem(key) ?? "null");
      if (
        parsed &&
        Array.isArray(parsed.vendors) &&
        parsed.vendors.every((v: unknown) => typeof v === "string")
      ) {
        memory = {
          vendors: normalize(parsed.vendors),
          checkedAt:
            typeof parsed.checkedAt === "number" && Number.isFinite(parsed.checkedAt)
              ? parsed.checkedAt
              : null,
        };
      }
    } catch {
      /* Storage may be unavailable; retain the session cache. */
    }
    return memory;
  }
  function write(cache: Cache) {
    memory = cache;
    try {
      storage().setItem(key, JSON.stringify(cache));
    } catch {
      /* Keep working in memory. */
    }
  }
  return {
    read: () => read().vendors,
    remember(vendor: string) {
      const cache = read();
      write({ ...cache, vendors: normalize([...cache.vendors, vendor]) });
    },
    refresh(fetchVendors: () => Promise<string[]>): Promise<string[]> {
      if (pending) return pending;
      const cache = read();
      const elapsed = cache.checkedAt === null ? Infinity : now() - cache.checkedAt;
      if (elapsed >= 0 && elapsed < VENDOR_CACHE_TTL) return Promise.resolve(cache.vendors);
      // Record the attempt too, so an unavailable database is not queried on every opening.
      write({ ...cache, checkedAt: now() });
      pending = Promise.resolve()
        .then(fetchVendors)
        .then((vendors) => {
          const latest = read();
          write({ ...latest, vendors: normalize([...latest.vendors, ...vendors]) });
          return memory.vendors;
        })
        .catch(() => read().vendors)
        .finally(() => {
          pending = undefined;
        });
      return pending;
    },
  };
}

export const vendorCache = createVendorCache(() => window.localStorage);
