import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as webhook from "../src/lib/easystore-webhook.ts";
import * as salesModule from "../src/lib/sales.ts";

const source = readFileSync(new URL("../src/app/api/webhooks/easystore/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness(userExists) {
  const lookups = [];
  const sales = [];
  const prisma = {
    user: { async findUnique(query) { lookups.push(query.where); return userExists ? { id: "local-user" } : null; } },
    sale: { async findUnique() { return null; }, async create({ data }) { sales.push(data); return { id: "local-sale" }; } },
    product: { async findMany() { return [{ id: "local-product", name: "Miel", costCents: 500 }]; } },
    seller: { async findMany() { return [{ id: "local-seller", name: "Lizeth", commissions: [{ productId: "local-product", rateBps: 0 }] }]; } },
    async $transaction(callback) { return callback(prisma); },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Buffer, console,
    process: { env: { EASYSTORE_WEBHOOK_SECRET: "test-secret", APP_OWNER_EMAIL: "fallback@example.com", EASYSTORE_WEBHOOK_USER_EMAIL: "fallback@example.com" } },
    require(id) {
      if (id === "@/lib/prisma") return { prisma };
      if (id === "@/lib/sales") return salesModule;
      if (id === "@/lib/easystore-webhook") return webhook;
      if (id === "next/cache") return { revalidatePath() {} };
      if (id === "next/server") return { NextResponse: { json: Response.json } };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { POST: exports.POST, lookups, sales };
}

function request(externalId, paymentMethod = "cash") {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({
    id: "event-1", type: "sale.completed", version: 1, occurred_at: "2026-10-01T12:00:00.000Z",
    store: { id: "source-store", external_id: null },
    sale: { id: "source-sale", subtotal: 25, tax: 0, total: 25, payment_method: paymentMethod, created_at: "2026-10-01T12:00:00.000Z" },
    seller: { id: "source-user", external_id: externalId, name: "Lizeth" },
    items: [{ product_id: "source-product", external_product_id: "local-product", name: "Miel", quantity: 1, unit_price: 25, stock_after_sale: 4 }],
  });
  return new Request("https://example.com/api/webhooks/easystore", {
    method: "POST", body: rawBody,
    headers: {
      "x-easystore-event-id": "event-1", "x-easystore-event-type": "sale.completed", "x-easystore-timestamp": timestamp,
      "x-easystore-signature": webhook.createEasystoreSignature({ secret: "test-secret", timestamp, rawBody }),
    },
  });
}

test("rejects missing external user ID even with email fallback configured", async () => {
  const h = harness(true);
  assert.equal((await h.POST(request(null))).status, 422);
  assert.equal(h.lookups.length, 0);
  assert.equal(h.sales.length, 0);
});

test("rejects external ID that does not identify a local user", async () => {
  const h = harness(false);
  assert.equal((await h.POST(request("unknown-user"))).status, 422);
  assert.equal(h.lookups[0].id, "unknown-user");
  assert.equal(h.sales.length, 0);
});

test("records the sale under the user identified by seller.external_id", async () => {
  const h = harness(true);
  assert.equal((await h.POST(request("local-user"))).status, 201);
  assert.equal(h.lookups[0].id, "local-user");
  assert.equal(h.sales.length, 1);
  assert.equal(h.sales[0].userId, "local-user");
  assert.equal(h.sales[0].sellerId, "local-seller");
  assert.equal(h.sales[0].cardRateBps, 0);
});

test("card sales use the same default rate as the app", async () => {
  const h = harness(true);
  assert.equal((await h.POST(request("local-user", "card"))).status, 201);
  assert.equal(h.sales[0].paidByCard, true);
  assert.equal(h.sales[0].cardRateBps, salesModule.DEFAULT_CARD_RATE_BPS);
  assert.equal(h.sales[0].cardRateBps, 406);
});
