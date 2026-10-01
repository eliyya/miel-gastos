import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as sales from "../src/lib/sales.ts";

const source = readFileSync(new URL("../src/app/sales/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function harness({ userExists = true, linkedSellerId = null, writeError = null } = {}) {
  const writes = [];
  const invalidated = [];
  const products = [{ id: "product-1", name: "Miel", active: true, priceCents: 2500, costCents: 500 }];
  const seller = { id: "seller-1", name: "Vendedor", active: true, userId: "another-user", commissions: [{ productId: "product-1", rateBps: 0 }] };
  async function write(query) {
    if (writeError) throw { code: writeError };
    writes.push(query);
    return seller;
  }
  const prisma = {
    user: { async findUnique() { return userExists ? { id: "user-1" } : null; } },
    seller: {
      async findUnique({ where }) { return where.userId ? (linkedSellerId ? { id: linkedSellerId } : null) : seller; },
      create: write, update: write,
    },
    product: { async findMany() { return products; } },
    sellerCommission: { async deleteMany(query) { writes.push(query); }, async createMany(query) { writes.push(query); } },
    sale: { create: write },
    async $transaction(callback) { return callback(prisma); },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, FormData, Date,
    require(id) {
      if (id === "@/lib/prisma") return { prisma };
      if (id === "@/lib/sales") return sales;
      if (id === "@/lib/auth") return { async requireTotpUser() { return { id: "user-1" }; } };
      if (id === "next/cache") return { revalidatePath(path) { invalidated.push(path); } };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return { ...exports, writes, invalidated, products, seller };
}

function sellerForm(userId = "user-1", id = "") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ id, name: "Vendedor", userId, active: "on", "commission:product-1": "0" })) form.set(key, value);
  return form;
}

test("creates a seller with an optional user and preserves zero commission", async () => {
  const h = harness();
  assert.ok((await h.saveSellerAction({}, sellerForm())).success);
  assert.equal(h.writes[0].data.userId, "user-1");
  assert.equal(h.writes[2].data[0].rateBps, 0);
  assert.deepEqual(h.invalidated, ["/sales/catalog", "/sales"]);
});

test("can remove a seller's user association", async () => {
  const h = harness();
  assert.ok((await h.saveSellerAction({}, sellerForm("", "seller-1"))).success);
  assert.equal(h.writes[0].where.id, "seller-1");
  assert.equal(h.writes[0].data.userId, null);
});

test("allows keeping the same association while editing", async () => {
  const h = harness({ linkedSellerId: "seller-1" });
  assert.ok((await h.saveSellerAction({}, sellerForm("user-1", "seller-1"))).success);
});

test("rejects unknown users without writing", async () => {
  const h = harness({ userExists: false });
  assert.match((await h.saveSellerAction({}, sellerForm())).error, /ya no existe/);
  assert.equal(h.writes.length, 0);
});

test("rejects a user linked to another seller without writing", async () => {
  const h = harness({ linkedSellerId: "seller-other" });
  assert.match((await h.saveSellerAction({}, sellerForm())).error, /otro vendedor/);
  assert.equal(h.writes.length, 0);
});

test("handles a concurrent duplicate user association", async () => {
  const h = harness({ writeError: "P2002" });
  assert.match((await h.saveSellerAction({}, sellerForm())).error, /otro vendedor/);
  assert.equal(h.invalidated.length, 0);
});

test("an administrator can record a sale for a seller associated to another user", async () => {
  const h = harness();
  const form = new FormData();
  const items = [{ productId: "product-1", quantity: 1 }];
  for (const [key, value] of Object.entries({ soldAt: "2026-10-01", sellerId: "seller-1", productId: "product-1", quantity: "1", unitPrice: "25.00", snapshot: JSON.stringify(sales.saleSnapshot(h.products, h.seller, items)) })) form.set(key, value);
  assert.ok((await h.createSaleAction(form)).success);
  assert.equal(h.writes[0].data.sellerId, "seller-1");
  assert.equal(h.writes[0].data.userId, "user-1");
});
