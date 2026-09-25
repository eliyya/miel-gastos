import { calculateSale, type SaleLine } from "./sales";

export type DateRange = { start?: string; end?: string };
export type Granularity = "day" | "month" | "year";
export type StatisticsSale = {
  soldAt: Date;
  createdAt?: Date;
  sellerId: string;
  sellerName: string;
  paidByCard: boolean;
  cardRateBps: number;
  items: (SaleLine & { productId: string; productName: string })[];
};
export type StatisticsExpense = { spentAt: Date; amountCents: number; category: string; currency: string };
export type Period = { key: string; income: number; expenses: number; balance: number; cumulative: number; sales: number; margin: number };
type Ranking = { id: string; name: string; income: number; units: number; margin: number; commissions: number };

const businessDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" });
export function mexicoDate(date: Date) { return businessDate.format(date); }

export function parseStatisticsRange(start: unknown, end: unknown): { range: DateRange; error?: string } {
  const range: DateRange = {};
  for (const [name, value] of [["start", start], ["end", end]] as const) {
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000") ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      return { range: {}, error: "Escribe fechas válidas para el inicio y el fin del período." };
    }
    range[name] = value;
  }
  if (range.start && range.end && range.start > range.end) return { range, error: "La fecha inicial debe ser anterior o igual a la fecha final." };
  return { range };
}

function inRange(day: string, range: DateRange) {
  return (!range.start || day >= range.start) && (!range.end || day <= range.end);
}
function bucketKey(day: string, grouping: Granularity) {
  return day.slice(0, grouping === "day" ? 10 : grouping === "month" ? 7 : 4);
}
function periodCount(start: string, end: string, grouping: Granularity) {
  if (grouping === "day") return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  if (grouping === "year") return Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1;
  return (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7)) + 1;
}
function nextKey(key: string, grouping: Granularity) {
  if (grouping === "year") return String(Number(key) + 1).padStart(4, "0");
  if (grouping === "month") {
    const year = Number(key.slice(0, 4)); const month = Number(key.slice(5, 7));
    return month === 12 ? `${String(year + 1).padStart(4, "0")}-01` : `${key.slice(0, 4)}-${String(month + 1).padStart(2, "0")}`;
  }
  return new Date(Date.parse(key) + 86_400_000).toISOString().slice(0, 10);
}

/** All money remains in integer cents. Sale costs and ledger expenses are separate views. */
export function buildStatistics(allSales: StatisticsSale[], allExpenses: StatisticsExpense[], range: DateRange = {}, requestedGrouping: Granularity = "month") {
  // Date-only sales must never be shifted to the previous day by a time zone.
  const sales = allSales.filter((s) => inRange(s.soldAt.toISOString().slice(0, 10), range)).sort((a, b) => b.soldAt.getTime() - a.soldAt.getTime() || (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  const inPeriodExpenses = allExpenses.filter((e) => inRange(mexicoDate(e.spentAt), range));
  const expenses = inPeriodExpenses.filter((e) => e.currency === "MXN");
  const days = [...sales.map((s) => s.soldAt.toISOString().slice(0, 10)), ...expenses.map((e) => mexicoDate(e.spentAt))].sort();
  const firstDay = days[0] ?? null;
  const lastDay = days.at(-1) ?? null;
  const from = range.start ?? firstDay;
  const to = range.end ?? lastDay;
  let grouping = requestedGrouping;
  if (from && to && periodCount(from, to, grouping) > 120) grouping = grouping === "day" ? "month" : "year";
  if (from && to && periodCount(from, to, grouping) > 120) grouping = "year";
  const periods = new Map<string, Period>();
  // Empty bounded periods are useful; unbounded empty history has no fabricated dates.
  if (from && to && from <= to) {
    const last = bucketKey(to, grouping);
    for (let key = bucketKey(from, grouping); ; key = nextKey(key, grouping)) {
      periods.set(key, { key, income: 0, expenses: 0, balance: 0, cumulative: 0, sales: 0, margin: 0 });
      if (key === last) break;
    }
  }
  const products = new Map<string, Ranking>();
  const sellers = new Map<string, Ranking & { sales: number }>();
  const categories = new Map<string, { name: string; amount: number; count: number }>();
  const payments = { card: { income: 0, count: 0 }, other: { income: 0, count: 0 } };
  const totals = { income: 0, expenses: 0, balance: 0, production: 0, commissions: 0, cardFees: 0, cost: 0, margin: 0, units: 0, sales: sales.length, expenseCount: expenses.length };
  for (const sale of sales) {
    const amounts = calculateSale(sale.items, sale.cardRateBps);
    totals.income += amounts.subtotal; totals.production += amounts.production;
    totals.commissions += amounts.sellerPayment; totals.cardFees += amounts.cardFee;
    totals.cost += amounts.cost; totals.margin += amounts.profit;
    const period = periods.get(bucketKey(sale.soldAt.toISOString().slice(0, 10), grouping))!;
    period.income += amounts.subtotal; period.sales++; period.margin += amounts.profit;
    const payment = sale.paidByCard ? payments.card : payments.other;
    payment.income += amounts.subtotal; payment.count++;
    const seller = sellers.get(sale.sellerId) ?? { id: sale.sellerId, name: sale.sellerName, income: 0, units: 0, margin: 0, commissions: 0, sales: 0 };
    seller.income += amounts.subtotal; seller.margin += amounts.profit; seller.commissions += amounts.sellerPayment; seller.sales++;
    sale.items.forEach((item, index) => {
      totals.units += item.quantity; seller.units += item.quantity;
      const product = products.get(item.productId) ?? { id: item.productId, name: item.productName, income: 0, units: 0, margin: 0, commissions: 0 };
      const line = amounts.lines[index];
      product.income += line.subtotal; product.units += item.quantity;
      // Card fees belong to the sale, not a product; do not invent an allocation.
      product.margin += line.subtotal - line.production - line.sellerPayment;
      product.commissions += line.sellerPayment;
      products.set(item.productId, product);
    });
    sellers.set(sale.sellerId, seller);
  }
  for (const expense of expenses) {
    totals.expenses += expense.amountCents;
    periods.get(bucketKey(mexicoDate(expense.spentAt), grouping))!.expenses += expense.amountCents;
    const name = expense.category.trim() || "Sin categoría";
    const category = categories.get(name) ?? { name, amount: 0, count: 0 };
    category.amount += expense.amountCents; category.count++; categories.set(name, category);
  }
  totals.balance = totals.income - totals.expenses;
  let cumulative = 0;
  for (const period of periods.values()) {
    period.balance = period.income - period.expenses;
    cumulative += period.balance; period.cumulative = cumulative;
  }
  return {
    totals, payments, firstDay, lastDay, from, to, grouping,
    excludedExpenses: inPeriodExpenses.length - expenses.length,
    averageTicket: totals.sales ? Math.round(totals.income / totals.sales) : null,
    marginPercent: totals.income ? totals.margin / totals.income * 100 : null,
    periods: [...periods.values()],
    products: [...products.values()].sort((a, b) => b.income - a.income || a.name.localeCompare(b.name)),
    sellers: [...sellers.values()].sort((a, b) => b.income - a.income || a.name.localeCompare(b.name)),
    categories: [...categories.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
  };
}

export function periodLabel(key: string) {
  if (key.length === 4) return key;
  return new Intl.DateTimeFormat("es-MX", key.length === 7
    ? { month: "short", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(key.length === 7 ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`));
}
