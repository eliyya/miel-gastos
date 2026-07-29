export function formatMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(/,/g, ".").trim();
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(amount * 100);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
  }).format(value);
}
