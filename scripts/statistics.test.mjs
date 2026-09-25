import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as salesModule from "../src/lib/sales.ts";

// Run the actual aggregation module, resolving its existing TypeScript dependency.
const source = readFileSync(new URL("../src/lib/statistics.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require(id) { if (id === "./sales") return salesModule; throw new Error(`Unexpected dependency: ${id}`); } });
const { buildStatistics, parseStatisticsRange, mexicoDate } = exports;

const item = (extra = {}) => ({ productId: "honey", productName: "Miel", quantity: 2, unitPriceCents: 10000, unitCostCents: 3000, commissionBps: 2000, ...extra });
const sale = (day = "2026-07-01", extra = {}) => ({ soldAt: new Date(`${day}T00:00:00Z`), sellerId: "seller", sellerName: "Equipo", paidByCard: false, cardRateBps: 0, items: [item()], ...extra });
const expense = (day = "2026-07-01", extra = {}) => ({ spentAt: new Date(`${day}T12:00:00Z`), amountCents: 6000, currency: "MXN", category: "Insumos", ...extra });

test("ledger balance and sales margin stay separate to avoid duplicate production costs", () => {
  const s = buildStatistics([sale()], [expense()]);
  assert.equal(s.totals.income, 20000);
  assert.equal(s.totals.expenses, 6000);
  assert.equal(s.totals.balance, 14000);
  assert.equal(s.totals.production, 6000);
  assert.equal(s.totals.commissions, 4000);
  assert.equal(s.totals.margin, 10000);
  assert.equal(s.marginPercent, 50);
});

test("history includes every record, even beyond the listing's 40 rows", () => {
  const s = buildStatistics(Array.from({ length: 85 }, () => sale()), Array.from({ length: 64 }, () => expense()));
  assert.equal(s.totals.sales, 85); assert.equal(s.totals.expenseCount, 64);
  assert.equal(s.totals.income, 85 * 20000); assert.equal(s.totals.expenses, 64 * 6000);
});

test("date-only sales and Mexico expense timestamps use inclusive calendar boundaries", () => {
  const s = buildStatistics([sale("2026-06-30"), sale("2026-07-01"), sale("2026-07-02")], [
    expense("2026-07-01", { spentAt: new Date("2026-07-01T05:59:59.999Z"), amountCents: 1 }),
    expense("2026-07-01", { spentAt: new Date("2026-07-01T06:00:00Z"), amountCents: 2 }),
    expense("2026-07-02", { spentAt: new Date("2026-07-02T05:59:59.999Z"), amountCents: 3 }),
    expense("2026-07-02", { spentAt: new Date("2026-07-02T06:00:00Z"), amountCents: 4 }),
  ], { start: "2026-07-01", end: "2026-07-01" }, "day");
  assert.equal(s.totals.sales, 1); assert.equal(s.totals.expenseCount, 2); assert.equal(s.totals.expenses, 5);
  assert.equal(s.periods[0].key, "2026-07-01");
  assert.equal(mexicoDate(new Date("2026-07-01T05:59:59.999Z")), "2026-06-30");
});

test("validates real dates, reversed ranges, duplicate query parameters and open ranges", () => {
  for (const value of ["2026-02-29", "2026-04-31", "nonsense", "0000-01-01", ["2026-01-01", "2026-01-02"]]) assert.ok(parseStatisticsRange(value).error);
  assert.ok(parseStatisticsRange("2026-08-02", "2026-08-01").error);
  assert.equal(parseStatisticsRange("2024-02-29", "").range.start, "2024-02-29");
  assert.equal(parseStatisticsRange(undefined, "2026-07-31").range.end, "2026-07-31");
  assert.equal(buildStatistics([sale("2026-06-01"), sale()], [], { start: "2026-07-01" }).totals.sales, 1);
  assert.equal(buildStatistics([sale("2026-06-01"), sale()], [], { end: "2026-06-30" }).totals.sales, 1);
});

test("fills missing months and preserves negative accumulated balances", () => {
  const s = buildStatistics([sale("2026-03-12")], [expense("2026-01-12", { amountCents: 30000 })]);
  assert.equal(s.periods.length, 3);
  assert.equal(s.periods[1].key, "2026-02"); assert.equal(s.periods[1].income, 0);
  assert.equal(s.periods[1].cumulative, -30000); assert.equal(s.periods[2].cumulative, -10000);
  assert.equal(s.periods[2].cumulative, s.totals.balance);
});

test("resets accumulation to zero for the chosen period, without carrying older balances", () => {
  const s = buildStatistics([sale("2026-07-01")], [expense("2026-06-01")], { start: "2026-07-01" });
  assert.equal(s.periods[0].cumulative, 20000);
});

test("empty history, expenses-only periods and free sales avoid invalid percentages", () => {
  const empty = buildStatistics([], []); assert.equal(empty.periods.length, 0); assert.equal(empty.averageTicket, null); assert.equal(empty.marginPercent, null);
  const expensesOnly = buildStatistics([], [expense()]); assert.equal(expensesOnly.totals.balance, -6000); assert.equal(expensesOnly.averageTicket, null);
  const free = buildStatistics([sale(undefined, { items: [item({ unitPriceCents: 0 })] })], []);
  assert.equal(free.totals.units, 2); assert.equal(free.averageTicket, 0); assert.equal(free.marginPercent, null); assert.equal(free.totals.margin, -6000);
});

test("rounds line commissions and the full-sale card fee exactly as original sales", () => {
  const items = [item({ quantity: 1, unitPriceCents: 1, unitCostCents: 0, commissionBps: 5000 }), item({ productId: "other", quantity: 1, unitPriceCents: 1, unitCostCents: 0, commissionBps: 5000 })];
  const s = buildStatistics([sale(undefined, { items, paidByCard: true, cardRateBps: 5000 })], []);
  assert.equal(s.totals.commissions, 2); assert.equal(s.totals.cardFees, 1); assert.equal(s.totals.margin, -1);
  assert.equal(s.products.reduce((sum, p) => sum + p.margin, 0), s.totals.margin + s.totals.cardFees);
  assert.equal(s.sellers[0].margin, s.totals.margin);
});

test("groups snapshots by identifiers and retains the most recent names", () => {
  const s = buildStatistics([sale("2026-01-01"), sale("2026-02-01", { sellerName: "Nombre nuevo", items: [item({ productName: "Miel nueva", unitPriceCents: 12000 })] })], []);
  assert.equal(s.products.length, 1); assert.equal(s.products[0].name, "Miel nueva"); assert.equal(s.products[0].income, 44000);
  assert.equal(s.sellers.length, 1); assert.equal(s.sellers[0].name, "Nombre nuevo"); assert.equal(s.sellers[0].sales, 2);
  const sameDay = buildStatistics([
    sale("2026-07-01", { createdAt: new Date("2026-07-01T12:00:00Z") }),
    sale("2026-07-01", { createdAt: new Date("2026-07-01T13:00:00Z"), sellerName: "Último nombre" }),
  ], []);
  assert.equal(sameDay.sellers[0].name, "Último nombre");
});

test("payment and category subtotals reconcile; foreign currencies are not added as pesos", () => {
  const s = buildStatistics([sale(), sale(undefined, { paidByCard: true, cardRateBps: 406 })], [expense(), expense(undefined, { category: "Envases", amountCents: 1000 }), expense(undefined, { currency: "USD", amountCents: 99999 })]);
  assert.equal(s.payments.card.income + s.payments.other.income, s.totals.income);
  assert.equal(s.categories.reduce((sum, c) => sum + c.amount, 0), s.totals.expenses);
  assert.equal(s.totals.expenses, 7000); assert.equal(s.excludedExpenses, 1);
});

test("long daily ranges expand grouping; leap days and final supported year terminate", () => {
  const long = buildStatistics([sale("2025-01-01"), sale("2026-12-31")], [], {}, "day");
  assert.equal(long.grouping, "month"); assert.equal(long.periods.length, 24);
  const leap = buildStatistics([], [], { start: "2024-02-28", end: "2024-03-01" }, "day");
  assert.equal(leap.periods.length, 3); assert.equal(leap.periods[1].key, "2024-02-29");
  assert.equal(buildStatistics([], [], { start: "9999-01-01", end: "9999-12-31" }, "year").periods.length, 1);
});
