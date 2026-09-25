import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { ShoppingBag, Wallet, TrendingUp } from "lucide-react";
import Link from "next/link";
import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { SalesTable } from "@/components/sales-table";
import { SaleDialog } from "@/components/sale-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireTotpUser();
  const params = await searchParams;
  const [products, sellers] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.seller.findMany({ where: { active: true }, include: { commissions: true }, orderBy: { name: "asc" } }),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const requestedPage = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const count = await prisma.sale.count();
  const pages = Math.max(1, Math.ceil(count / 40));
  const page = Math.min(Math.floor(requestedPage), pages);
  const sales = await prisma.sale.findMany({ include: { items: { orderBy: { id: "asc" } } }, orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 40, skip: (page - 1) * 40 });
  // Aggregate from snapshots, rounding seller commission per line and card fee per sale.
  const [totals] = await prisma.$queryRaw<{ subtotal: number; cost: number; profit: number }[]>`
    WITH amounts AS (
      SELECT s."id", s."cardRateBps",
        SUM(i."quantity"::numeric * i."unitPriceCents") AS subtotal,
        SUM(i."quantity"::numeric * i."unitCostCents"
          + ROUND(i."quantity"::numeric * i."unitPriceCents" * i."commissionBps" / 10000)) AS base_cost
      FROM "Sale" s JOIN "SaleItem" i ON i."saleId" = s."id"
      GROUP BY s."id", s."cardRateBps"
    ), costs AS (
      SELECT subtotal, base_cost + ROUND(subtotal * "cardRateBps" / 10000) AS cost FROM amounts
    )
    SELECT COALESCE(SUM(subtotal), 0)::double precision AS subtotal,
      COALESCE(SUM(cost), 0)::double precision AS cost,
      COALESCE(SUM(subtotal - cost), 0)::double precision AS profit FROM costs
  `;
  return <AppShell user={user} title="El fruto de tu trabajo" eyebrow="La libreta · Ventas" description="Tus ventas, costos y ganancias en un solo lugar. Cada frasco cuenta." actions={<SaleDialog products={products} sellers={sellers} today={today} />}>
    <section aria-label="Totales de todas las ventas" className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Total vendido" value={formatMoney(totals.subtotal)} hint="Todas las ventas registradas" icon={ShoppingBag} />
      <StatCard label="Costo total" value={formatMoney(totals.cost)} hint="Producción y comisiones" icon={Wallet} />
      <StatCard label="Ganancia" value={formatMoney(totals.profit)} hint="Antes de los gastos de la libreta" icon={TrendingUp} featured />
    </section>
    <Card><CardHeader><CardTitle>Ventas registradas</CardTitle><CardDescription>{count} ventas · Haz clic en una fila para ver los productos y sus cantidades.</CardDescription></CardHeader><CardContent><SalesTable sales={sales.map((sale) => ({ ...sale, soldAt: sale.soldAt.toISOString() }))} /><div className="mt-4 flex items-center justify-end gap-3 text-sm">{page > 1 && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page - 1}`}>Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page + 1}`}>Siguiente</Link>}</div></CardContent></Card>
  </AppShell>;
}
