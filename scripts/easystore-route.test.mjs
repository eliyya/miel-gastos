import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "@typescript/typescript6";
import * as webhook from "../src/lib/easystore-webhook.ts";
import * as salesModule from "../src/lib/sales.ts";

const source = readFileSync(
  new URL("../src/app/api/webhooks/easystore/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({
  sellerExists = true,
  userId = "linked-user",
  ownerExists = true,
  enabled = true,
  configurationError = false,
} = {}) {
  const lookups = [];
  const sales = [];
  const prisma = {
    user: {
      async findFirst(query) {
        lookups.push(query.where);
        return ownerExists ? { id: "owner-user" } : null;
      },
    },
    sale: {
      async findUnique() {
        return sales.length ? { id: "local-sale" } : null;
      },
      async create({ data }) {
        sales.push(data);
        return { id: "local-sale" };
      },
    },
    product: {
      async findMany() {
        return [{ id: "local-product", name: "Miel", costCents: 500 }];
      },
    },
    seller: {
      async findUnique(query) {
        lookups.push(query.where);
        return sellerExists && query.where.id === "local-seller"
          ? {
              id: "local-seller",
              name: "Eli",
              userId,
              commissions: [{ productId: "local-product", rateBps: 0 }],
            }
          : null;
      },
    },
    async $transaction(callback) {
      return callback(prisma);
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Buffer,
    console,
    process: {
      env: {
        EASYSTORE_WEBHOOK_SECRET: "test-secret",
        APP_OWNER_EMAIL: "fallback@example.com",
        EASYSTORE_WEBHOOK_USER_EMAIL: "fallback@example.com",
      },
    },
    require(id) {
      if (id === "@/lib/easystore-settings")
        return {
          async getActiveEasystoreWebhookSecret() {
            if (configurationError) throw new Error("private configuration");
            return enabled ? "test-secret" : null;
          },
        };
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
    id: "event-1",
    type: "sale.completed",
    version: 1,
    occurred_at: "2026-10-01T12:00:00.000Z",
    store: { id: "source-store", external_id: null },
    sale: {
      id: "source-sale",
      subtotal: 25,
      tax: 0,
      total: 25,
      payment_method: paymentMethod,
      created_at: "2026-10-01T12:00:00.000Z",
    },
    seller: { id: "source-user", external_id: externalId, name: "Lizeth" },
    items: [
      {
        product_id: "source-product",
        external_product_id: "local-product",
        name: "Miel",
        quantity: 1,
        unit_price: 25,
        stock_after_sale: 4,
      },
    ],
  });
  return new Request("https://example.com/api/webhooks/easystore", {
    method: "POST",
    body: rawBody,
    headers: {
      "x-easystore-event-id": "event-1",
      "x-easystore-event-type": "sale.completed",
      "x-easystore-timestamp": timestamp,
      "x-easystore-signature": webhook.createEasystoreSignature({
        secret: "test-secret",
        timestamp,
        rawBody,
      }),
    },
  });
}

test("rejects missing external seller ID", async () => {
  const h = harness();
  assert.equal((await h.POST(request(null))).status, 422);
  assert.equal(h.lookups.length, 0);
  assert.equal(h.sales.length, 0);
});

test("disabled webhook rejects events before looking up or writing sales", async () => {
  const h = harness({ enabled: false });
  const response = await h.POST(request("local-seller"));
  assert.equal(response.status, 503);
  assert.equal(h.lookups.length, 0);
  assert.equal(h.sales.length, 0);
});

test("configuration failures fail closed without exposing internal errors", async () => {
  const h = harness({ configurationError: true });
  const response = await h.POST(request("local-seller"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private configuration/);
  assert.equal(h.sales.length, 0);
});

test("rejects unknown seller instead of matching the source ID or name", async () => {
  const h = harness();
  assert.equal((await h.POST(request("unknown-seller"))).status, 422);
  assert.equal(h.lookups[0].id, "unknown-seller");
  assert.equal(h.sales.length, 0);
});

test("records the mapped seller and linked user even when source name differs", async () => {
  const h = harness();
  assert.equal((await h.POST(request("local-seller"))).status, 201);
  assert.equal(h.lookups[0].id, "local-seller");
  assert.equal(h.lookups.length, 1);
  assert.equal(h.sales.length, 1);
  assert.equal(h.sales[0].userId, "linked-user");
  assert.equal(h.sales[0].sellerId, "local-seller");
  assert.equal(h.sales[0].sellerName, "Eli");
  assert.equal(h.sales[0].cardRateBps, 0);
});

test("uses the owner when the seller has no linked user", async () => {
  const h = harness({ userId: null });
  assert.equal((await h.POST(request("local-seller"))).status, 201);
  assert.equal(h.lookups[1].role, "OWNER");
  assert.equal(h.sales[0].userId, "owner-user");
  assert.equal(h.sales[0].sellerId, "local-seller");
});

test("rejects a seller without a linked user when no owner exists", async () => {
  const h = harness({ userId: null, ownerExists: false });
  const response = await h.POST(request("local-seller"));
  assert.equal(response.status, 422);
  assert.match((await response.json()).error, /no existe un owner/);
  assert.equal(h.sales.length, 0);
});

test("card sales use the same default rate as the app", async () => {
  const h = harness();
  assert.equal((await h.POST(request("local-seller", "card"))).status, 201);
  assert.equal(h.sales[0].paidByCard, true);
  assert.equal(h.sales[0].cardRateBps, salesModule.DEFAULT_CARD_RATE_BPS);
  assert.equal(h.sales[0].cardRateBps, 406);
});

test("enabled webhook preserves idempotency for repeated deliveries", async () => {
  const h = harness();
  const first = await h.POST(request("local-seller"));
  assert.equal(first.status, 201);
  assert.equal((await first.json()).duplicate, false);
  const retry = await h.POST(request("local-seller"));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).duplicate, true);
  assert.equal(h.sales.length, 1);
});

test("enabled webhook still rejects stale timestamps before sale lookups", async () => {
  const h = harness();
  const event = request("local-seller");
  const rawBody = await event.text();
  const timestamp = String(Math.floor(Date.now() / 1000) - 301);
  event.headers.set("x-easystore-timestamp", timestamp);
  event.headers.set(
    "x-easystore-signature",
    webhook.createEasystoreSignature({ secret: "test-secret", timestamp, rawBody }),
  );
  const stale = new Request(event.url, { method: "POST", body: rawBody, headers: event.headers });
  assert.equal((await h.POST(stale)).status, 401);
  assert.equal(h.lookups.length, 0);
  assert.equal(h.sales.length, 0);
});
