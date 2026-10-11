import assert from "node:assert/strict";
import test from "node:test";
import { createVendorCache, VENDOR_CACHE_TTL } from "../src/lib/vendor-cache.ts";

test("customers and vendors retain separate options and refresh timestamps", async () => {
  const saved = new Map();
  const storage = () => ({ getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) });
  const vendors = createVendorCache(storage, () => 1000);
  const customers = createVendorCache(storage, () => 1000, "miel:sale-customers:v1");
  vendors.remember("Proveedor");
  await vendors.refresh(async () => ["Proveedor remoto"]);
  customers.remember("Cliente");
  let calls = 0;
  assert.deepEqual(await customers.refresh(async () => { calls++; return ["Cliente remoto"]; }), ["Cliente", "Cliente remoto"]);
  assert.equal(calls, 1);
  assert.deepEqual(vendors.read(), ["Proveedor", "Proveedor remoto"]);
  const reloaded = createVendorCache(storage, () => 1001, "miel:sale-customers:v1");
  await reloaded.refresh(async () => { calls++; return []; });
  assert.equal(calls, 1);
});

function setup() {
  let saved = null;
  let time = 1000;
  const storage = () => ({ getItem: () => saved, setItem: (_, value) => { saved = value; } });
  return { storage, now: () => time, advance: (ms) => { time += ms; }, corrupt: () => { saved = "invalid"; } };
}

test("refreshes initially and at 24 hours, including across reloads; local saves do not postpone refresh", async () => {
  const env = setup();
  const cache = createVendorCache(env.storage, env.now);
  let calls = 0;
  const fetch = async () => { calls++; return ["Proveedor A"]; };
  await cache.refresh(fetch);
  env.advance(VENDOR_CACHE_TTL - 1);
  cache.remember("Proveedor B");
  const reloaded = createVendorCache(env.storage, env.now);
  assert.deepEqual(await reloaded.refresh(fetch), ["Proveedor A", "Proveedor B"]);
  assert.equal(calls, 1);
  env.advance(1);
  await reloaded.refresh(fetch);
  assert.equal(calls, 2);
});

test("deduplicates concurrent requests and merges vendors saved during refresh", async () => {
  const env = setup();
  const cache = createVendorCache(env.storage, env.now);
  let complete;
  let calls = 0;
  const fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = cache.refresh(fetch);
  const second = cache.refresh(fetch);
  await Promise.resolve();
  cache.remember(" Local ");
  complete(["Remoto", "local", "", " Remoto "]);
  assert.deepEqual(await first, ["local", "Remoto"]);
  await second;
  assert.equal(calls, 1);
});

test("failed requests retain local options and are not retried before 24 hours", async () => {
  const env = setup();
  const cache = createVendorCache(env.storage, env.now);
  cache.remember("Local");
  let calls = 0;
  const fetch = async () => { calls++; throw Error("offline"); };
  assert.deepEqual(await cache.refresh(fetch), ["Local"]);
  await cache.refresh(fetch);
  assert.equal(calls, 1);
  env.advance(VENDOR_CACHE_TTL);
  await cache.refresh(fetch);
  assert.equal(calls, 2);
});

test("handles corrupt or blocked browser storage", async () => {
  const env = setup();
  env.corrupt();
  assert.deepEqual(await createVendorCache(env.storage, env.now).refresh(async () => ["Remote"]), ["Remote"]);
  const cache = createVendorCache(() => { throw Error("blocked"); }, env.now);
  cache.remember("Local");
  assert.deepEqual(await cache.refresh(async () => ["Remote"]), ["Local", "Remote"]);
  assert.deepEqual(cache.read(), ["Local", "Remote"]);
});
