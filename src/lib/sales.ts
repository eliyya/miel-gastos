// Money is stored in cents; rates in basis points (4.06% = 406).
export type SaleLine = {
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  commissionBps: number;
};

export function calculateSale(items: SaleLine[], cardRateBps: number) {
  const lines = items.map((item) => {
    const subtotal = item.quantity * item.unitPriceCents;
    return {
      subtotal,
      production: item.quantity * item.unitCostCents,
      sellerPayment: Math.round(subtotal * item.commissionBps / 10_000),
    };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const production = lines.reduce((sum, line) => sum + line.production, 0);
  const sellerPayment = lines.reduce((sum, line) => sum + line.sellerPayment, 0);
  const cardFee = Math.round(subtotal * cardRateBps / 10_000);
  const cost = production + sellerPayment + cardFee;
  return { lines, subtotal, production, sellerPayment, cardFee, cost, profit: subtotal - cost };
}

export function parseHundredths(value: unknown, max = 100_000_000): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= max ? result : null;
}

export type SalesFormState = { error?: string; success?: string };

export type CatalogProduct = { id: string; name: string; priceCents: number; costCents: number; active: boolean };
export type CatalogSeller = { id: string; name: string; active: boolean; commissions: { productId: string; rateBps: number }[] };

export function parseSaleInput(form: FormData) {
  const soldAt = String(form.get("soldAt") ?? "");
  const customer = String(form.get("customer") ?? "").trim();
  const sellerId = String(form.get("sellerId") ?? "");
  const paidByCard = form.get("paidByCard") === "on";
  const cardRateBps = paidByCard ? parseHundredths(form.get("cardRate"), 10_000) : 0;
  const productIds = form.getAll("productId").map(String);
  const quantities = form.getAll("quantity").map(String);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(soldAt) || !Number.isFinite(Date.parse(soldAt)) ||
    new Date(soldAt).toISOString().slice(0, 10) !== soldAt ||
    !sellerId || customer.length > 160 || cardRateBps === null ||
    !productIds.length || productIds.length > 100 || productIds.some((id) => !id) ||
    productIds.length !== quantities.length || new Set(productIds).size !== productIds.length ||
    quantities.some((q) => !/^\d+$/.test(q) || Number(q) < 1 || Number(q) > 10_000)) {
    return null;
  }
  return { soldAt, customer: customer || null, sellerId, paidByCard, cardRateBps,
    items: productIds.map((productId, i) => ({ productId, quantity: Number(quantities[i]) })) };
}

export function saleSnapshot(products: CatalogProduct[], seller: CatalogSeller, rows: { productId: string; quantity: number }[]) {
  const items = rows.map((row) => {
    const product = products.find((p) => p.id === row.productId && p.active);
    const commission = seller.commissions.find((c) => c.productId === row.productId);
    if (!product || !seller.active || !commission) return null;
    return { productId: product.id, productName: product.name, quantity: row.quantity,
      unitPriceCents: product.priceCents, unitCostCents: product.costCents, commissionBps: commission.rateBps };
  });
  if (items.some((item) => item === null)) return null;
  return { sellerName: seller.name, items: items as NonNullable<(typeof items)[number]>[] };
}
