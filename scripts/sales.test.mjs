import test from "node:test";
import assert from "node:assert/strict";
import { calculateSale, parseHundredths, parseSaleInput, saleSnapshot } from "../src/lib/sales.ts";

test("multiple products: quantity, individual commissions and card fee", () => {
  const result = calculateSale([
    { quantity: 2, unitPriceCents: 20000, unitCostCents: 8500, commissionBps: 2000 },
    { quantity: 3, unitPriceCents: 6000, unitCostCents: 2500, commissionBps: 2500 },
  ], 406);
  assert.equal(result.subtotal, 58000);
  assert.equal(result.production, 24500);
  assert.equal(result.sellerPayment, 12500);
  assert.equal(result.cardFee, 2355);
  assert.equal(result.cost, 39355);
  assert.equal(result.profit, 18645);
});

function saleForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ soldAt: "2026-09-21", sellerId: "seller", productId: "honey", quantity: "2", unitPrice: "200.00", customer: "  " })) form.set(key, value);
  return form;
}

test("special unit prices are validated and used without modifying catalog costs", () => {
  const form = saleForm();
  form.set("unitPrice", "175.50");
  const input = parseSaleInput(form);
  assert.equal(input.items[0].unitPriceCents, 17550);
  const product = { id: "honey", name: "Miel", priceCents: 20000, costCents: 8500, active: true };
  const seller = { id: "seller", name: "Lizeth", active: true, commissions: [{ productId: "honey", rateBps: 2000 }] };
  const snapshot = saleSnapshot([product], seller, input.items);
  assert.equal(snapshot.items[0].unitPriceCents, 17550);
  assert.equal(snapshot.items[0].unitCostCents, 8500);
  assert.equal(product.priceCents, 20000);
  const totals = calculateSale(snapshot.items, 406);
  assert.equal(totals.subtotal, 35100);
  assert.equal(totals.sellerPayment, 7020);
  assert.equal(totals.cardFee, 1425);
  assert.equal(totals.profit, 9655);
  for (const invalid of ["", "-1", "2.999", "NaN", "1000000.01"]) {
    form.set("unitPrice", invalid);
    assert.equal(parseSaleInput(form), null);
  }
  form.delete("unitPrice");
  assert.equal(parseSaleInput(form), null);
  form.set("unitPrice", "0");
  assert.equal(parseSaleInput(form).items[0].unitPriceCents, 0);
});

test("sale input validates calendar dates, quantities, duplicate products and card rate", () => {
  assert.equal(parseSaleInput(saleForm()).customer, null);
  for (const [field, value] of [["soldAt", "2026-02-30"], ["soldAt", "invalid"], ["quantity", "0"], ["quantity", "-1"], ["quantity", "1.5"], ["quantity", "10001"], ["sellerId", ""]]) {
    const form = saleForm(); form.set(field, value);
    assert.equal(parseSaleInput(form), null);
  }
  const duplicate = saleForm(); duplicate.append("productId", "honey"); duplicate.append("quantity", "1");
  assert.equal(parseSaleInput(duplicate), null);
  const card = saleForm(); card.set("paidByCard", "on"); card.set("cardRate", "4.06");
  assert.equal(parseSaleInput(card).cardRateBps, 406);
  card.set("cardRate", "100.01"); assert.equal(parseSaleInput(card), null);
  card.delete("paidByCard"); assert.equal(parseSaleInput(card).cardRateBps, 0);
});

test("snapshot requires active catalogs and explicit commissions, including zero", () => {
  const product = { id: "honey", name: "Miel", priceCents: 20000, costCents: 8500, active: true };
  const seller = { id: "seller", name: "Elí", active: true, commissions: [] };
  const rows = [{ productId: "honey", quantity: 2 }];
  assert.equal(saleSnapshot([product], seller, rows), null);
  seller.commissions.push({ productId: "honey", rateBps: 0 });
  const snapshot = saleSnapshot([product], seller, rows);
  assert.equal(snapshot.items[0].commissionBps, 0);
  product.priceCents = 25000;
  assert.equal(snapshot.items[0].unitPriceCents, 20000);
  assert.notDeepEqual(saleSnapshot([product], seller, rows), snapshot);
  product.active = false;
  assert.equal(saleSnapshot([product], seller, rows), null);
  product.active = true; seller.active = false;
  assert.equal(saleSnapshot([product], seller, rows), null);
});

test("zero commission, no card, and losses remain valid", () => {
  const result = calculateSale([{ quantity: 2, unitPriceCents: 1000, unitCostCents: 1500, commissionBps: 0 }], 0);
  assert.equal(result.sellerPayment, 0);
  assert.equal(result.cardFee, 0);
  assert.equal(result.profit, -1000);
});

test("round commission per line and card fee once per sale", () => {
  const result = calculateSale(Array.from({ length: 3 }, () => ({ quantity: 1, unitPriceCents: 5, unitCostCents: 0, commissionBps: 1000 })), 1000);
  assert.equal(result.sellerPayment, 3);
  assert.equal(result.cardFee, 2);
});

test("calculations use historical snapshots, independent of current catalog", () => {
  const product = { priceCents: 20000, costCents: 8500 };
  const seller = { rateBps: 2000 };
  const snapshot = { quantity: 1, unitPriceCents: product.priceCents, unitCostCents: product.costCents, commissionBps: seller.rateBps };
  product.priceCents = 30000;
  product.costCents = 12000;
  seller.rateBps = 5000;
  assert.equal(calculateSale([snapshot], 0).profit, 7500);
});

test("strict decimal parsing preserves cents and rejects invalid inputs", () => {
  assert.equal(parseHundredths("4.06", 10000), 406);
  assert.equal(parseHundredths("1,01"), 101);
  assert.equal(parseHundredths("0"), 0);
  assert.equal(parseHundredths("100", 10000), 10000);
  for (const input of ["", null, "-1", "NaN", "Infinity", "1e2", "1.001", "100.01"]) {
    assert.equal(parseHundredths(input, 10000), null);
  }
});
