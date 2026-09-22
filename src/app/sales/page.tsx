import Link from "next/link";
import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import { SalesTable } from "@/components/sales-table";
import { SaleDialog } from "@/components/sale-dialog";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireTotpUser();
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
  return <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white"><div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4"><div><h1 className="text-2xl font-semibold">Ventas de Miel</h1><p className="mt-1 text-sm text-muted-foreground">Martin del Campo · Registro de ventas y ganancias</p></div><nav className="flex gap-2"><Link href="/" className={buttonVariants({ variant: "outline" })}>Gastos</Link><Link href="/sales/catalog" className={buttonVariants({ variant: "outline" })}>Catálogos</Link></nav></header>
    <section aria-label="Totales de todas las ventas" className="grid gap-4 sm:grid-cols-3">
      {[["Vendido", totals.subtotal], ["Costo total", totals.cost], ["Ganancia", totals.profit]].map(([label, value]) => <Card key={label}><CardHeader><CardDescription>{label} · todas las ventas</CardDescription><CardTitle className="text-2xl tabular-nums">{formatMoney(Number(value))}</CardTitle></CardHeader></Card>)}
    </section>
    <div className="flex justify-end"><SaleDialog products={products} sellers={sellers} today={today} /></div>
    <Card><CardHeader><CardTitle>Ventas registradas</CardTitle><CardDescription>{count} ventas · Haz clic en una fila para ver los productos y sus cantidades.</CardDescription></CardHeader><CardContent><SalesTable sales={sales.map((sale) => ({ ...sale, soldAt: sale.soldAt.toISOString() }))} /><div className="mt-4 flex items-center justify-end gap-3 text-sm">{page > 1 && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page - 1}`}>Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page + 1}`}>Siguiente</Link>}</div></CardContent></Card>
  </div></main>;
}
