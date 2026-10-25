import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { parseMoneyToCents } from "../src/lib/format.ts";

const source = readFileSync(new URL("../src/app/actions.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ authenticated = true } = {}) {
  const writes = [];
  const invalidated = [];
  const exports = {};
  const dependencies = {
    "next/cache": {
      revalidatePath(path) {
        invalidated.push(path);
      },
    },
    "next/navigation": {
      redirect(path) {
        throw Object.assign(new Error("redirect"), { path });
      },
    },
    zod: { z },
    "@/lib/auth": {
      async requireTotpUser() {
        if (!authenticated) throw new Error("unauthorized");
        return { id: "user-1" };
      },
    },
    "@/lib/agent-tokens": {},
    "@/lib/totp": {},
    "@/lib/format": { parseMoneyToCents },
    "@/lib/prisma": {
      prisma: {
        expense: {
          async create(query) {
            writes.push(query);
          },
          async deleteMany(query) {
            writes.push(query);
          },
        },
      },
    },
  };
  vm.runInNewContext(compiled, { exports, Date, require: (id) => dependencies[id] });
  return { ...exports, writes, invalidated };
}

function expenseForm(amount = "350.00") {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    amount,
    spentAt: "2026-10-10",
    description: "Frascos",
    category: "Envases",
    paymentMethod: "Efectivo",
  }))
    form.set(key, value);
  return form;
}

test("dashboard expense submission returns success without redirecting and refreshes both pages", async () => {
  const h = harness();
  assert.ok((await h.saveExpenseAction(expenseForm())).success);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].data.userId, "user-1");
  assert.equal(h.writes[0].data.amountCents, 35000);
  assert.deepEqual(h.invalidated, ["/", "/expenses"]);
});

test("invalid dashboard submission returns an error without writing", async () => {
  const h = harness();
  assert.ok((await h.saveExpenseAction(expenseForm("0"))).error);
  assert.equal(h.writes.length, 0);
  assert.equal(h.invalidated.length, 0);
});

test("expense action saves currency input cents without multiplying them twice", async () => {
  const h = harness();
  assert.ok((await h.saveExpenseAction(expenseForm("0.05"))).success);
  assert.ok((await h.saveExpenseAction(expenseForm("53.00"))).success);
  assert.equal(h.writes[0].data.amountCents, 5);
  assert.equal(h.writes[1].data.amountCents, 5300);
});

test("expense page submission and validation redirect to its new route", async () => {
  const h = harness();
  await assert.rejects(h.createExpenseAction(expenseForm()), (error) => error.path === "/expenses");
  await assert.rejects(
    h.createExpenseAction(expenseForm("0")),
    (error) => error.path === "/expenses?error=expense",
  );
  assert.equal(h.writes.length, 1);
});

test("expense deletion returns to the listing and refreshes the dashboard", async () => {
  const h = harness();
  const form = new FormData();
  form.set("id", "expense-1");
  await assert.rejects(h.deleteExpenseAction(form), (error) => error.path === "/expenses");
  assert.equal(h.writes[0].where.id, "expense-1");
  assert.deepEqual(h.invalidated, ["/", "/expenses"]);
});

test("dashboard expense submission still requires authentication", async () => {
  const h = harness({ authenticated: false });
  await assert.rejects(h.saveExpenseAction(expenseForm()), /unauthorized/);
  assert.equal(h.writes.length, 0);
});

test("expense payment method is required and rejects unknown choices", async () => {
  const h = harness();
  for (const method of [null, "", "Tarjeta", "Desconocido"]) {
    const form = expenseForm();
    if (method === null) form.delete("paymentMethod");
    else form.set("paymentMethod", method);
    assert.match((await h.saveExpenseAction(form)).error, /método de pago/);
  }
  assert.equal(h.writes.length, 0);
});

test("expense action preserves each supported payment method", async () => {
  const h = harness();
  for (const method of ["Efectivo", "Débito", "Crédito", "Transferencia"]) {
    const form = expenseForm();
    form.set("paymentMethod", method);
    assert.ok((await h.saveExpenseAction(form)).success);
    assert.equal(h.writes.at(-1).data.paymentMethod, method);
  }
});
