import assert from "node:assert/strict";
import test from "node:test";

import {
  createEasystoreSignature,
  isCardPaymentMethod,
  mexicoDate,
  moneyToCents,
  normalizeComparableName,
  parseEasystoreSaleCompletedEvent,
  verifyEasystoreSignature,
} from "../src/lib/easystore-webhook.ts";

test("verifies EasyStore signatures and rejects stale timestamps", () => {
  const secret = "a-secret-that-is-long-enough";
  const rawBody = '{"id":"event-1"}';
  const now = 1_790_000_000_000;
  const timestamp = String(Math.floor(now / 1000));
  const signature = createEasystoreSignature({ secret, timestamp, rawBody });

  assert.equal(verifyEasystoreSignature({ secret, timestamp, signature, rawBody, now }), true);
  assert.equal(verifyEasystoreSignature({ secret, timestamp, signature: `${signature}x`, rawBody, now }), false);
  assert.equal(verifyEasystoreSignature({ secret, timestamp, signature, rawBody, now: now + 301_000 }), false);
});

test("parses money without accepting fractions beyond cents", () => {
  assert.equal(moneyToCents("12.50"), 1250);
  assert.equal(moneyToCents(12.5), 1250);
  assert.equal(moneyToCents("12.501"), null);
  assert.equal(moneyToCents(-1), null);
});

test("maps names consistently for seller fallback and preserves Mexico dates", () => {
  assert.equal(normalizeComparableName("  José   de la Cruz "), "jose de la cruz");
  assert.equal(mexicoDate("2026-09-30T05:59:59.000Z"), "2026-09-29");
  assert.equal(isCardPaymentMethod("tarjeta de débito"), true);
  assert.equal(isCardPaymentMethod("cash"), false);
});

test("accepts the sale.completed contract emitted by EasyStore", () => {
  const result = parseEasystoreSaleCompletedEvent({
    id: "event-1",
    type: "sale.completed",
    version: 1,
    occurred_at: "2026-09-30T12:00:00.000Z",
    store: { id: "store-1", external_id: null },
    sale: {
      id: "sale-1",
      subtotal: 25,
      tax: 0,
      total: 25,
      payment_method: "cash",
      created_at: "2026-09-30T12:00:00.000Z",
    },
    seller: { id: "seller-1", external_id: null, name: "Lizeth" },
    items: [{
      product_id: "product-1",
      external_product_id: "miel-product-1",
      name: "Miel",
      quantity: 1,
      unit_price: 25,
      stock_after_sale: 4,
    }],
  });

  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.items[0].external_product_id, "miel-product-1");
});
