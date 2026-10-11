import { Suspense, cache } from "react";
import { AppShell } from "@/components/app-shell";
import { SalesMonthCharts } from "@/components/expense-month-charts";
import Link from "next/link";
import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesTable } from "@/components/sales-table";
import { SaleDialog } from "@/components/sale-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SalesParams = Promise<{ page?: string }>;
// Deduplicate authentication within this render, without caching across requests.
const getUser = cache(requireTotpUser);
const getToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function SalesPage({ searchParams }: { searchParams: SalesParams }) {
  return <AppShell title="El fruto de tu trabajo" eyebrow="La libreta · Ventas" description="Tus ventas, costos y ganancias en un solo lugar. Cada frasco cuenta." actions={
    <Suspense fallback={<Button disabled aria-busy="true">Cargando registro…</Button>}>
      <SaleRegistration />
    </Suspense>
  }>
    <Suspense fallback={<ChartsLoading />}>
      <MonthlySales />
    </Suspense>
    <Suspense fallback={<TableLoading />}>
      <RegisteredSales searchParams={searchParams} />
    </Suspense>
  </AppShell>;
}

async function SaleRegistration() {
  const user = await getUser();
  const [products, sellers] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.seller.findMany({ where: { active: true }, include: { commissions: true }, orderBy: { name: "asc" } }),
  ]);
  return <SaleDialog products={products} sellers={sellers} today={getToday()} defaultSellerId={sellers.find((seller) => seller.userId === user.id)?.id} />;
}

async function MonthlySales() {
  await getUser();
  const today = getToday();
  const month = today.slice(0, 7);
  // soldAt is a date-only value stored at UTC midnight.
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const monthSales = await prisma.sale.findMany({
    where: { soldAt: { gte: monthStart, lt: nextMonth } },
    select: { soldAt: true, items: { select: { quantity: true, unitPriceCents: true } } },
  });
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, amount: 0, count: 0 }));
  for (const sale of monthSales) {
    const day = days[sale.soldAt.getUTCDate() - 1];
    for (const item of sale.items) {
      day.amount += item.quantity * item.unitPriceCents;
      day.count += item.quantity;
    }
  }
  return <SalesMonthCharts days={days} month={month} today={Number(today.slice(8))} />;
}

async function RegisteredSales({ searchParams }: { searchParams: SalesParams }) {
  await getUser();
  const params = await searchParams;
  const requestedPage = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const count = await prisma.sale.count();
  const pages = Math.max(1, Math.ceil(count / 40));
  const page = Math.min(Math.floor(requestedPage), pages);
  const sales = await prisma.sale.findMany({ include: { items: { orderBy: { id: "asc" } } }, orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 40, skip: (page - 1) * 40 });
  return (
    <Card><CardHeader><CardTitle>Ventas registradas</CardTitle><CardDescription>{count} ventas · Haz clic en una fila para ver los productos y sus cantidades.</CardDescription></CardHeader><CardContent><SalesTable sales={sales.map((sale) => ({ ...sale, soldAt: sale.soldAt.toISOString() }))} /><div className="mt-4 flex items-center justify-end gap-3 text-sm">{page > 1 && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page - 1}`}>Anterior</Link>}<span>Página {page} de {pages}</span>{page < pages && <Link className={buttonVariants({ variant: "outline" })} href={`/sales?page=${page + 1}`}>Siguiente</Link>}</div></CardContent></Card>
  );
}

function ChartsLoading() {
  return <section aria-label="Cargando gráficas de ventas" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
    <span role="status" className="sr-only">Cargando gráficas de ventas…</span>
    {["Ventas del mes", "Productos vendidos"].map((title, index) => <Card key={title} className={index === 0 ? "min-h-58 bg-primary text-primary-foreground ring-primary" : "min-h-58"}>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent aria-hidden="true" className="space-y-5 motion-safe:animate-pulse"><div className="h-8 w-28 rounded-lg bg-current opacity-10" /><div className="h-16 rounded-lg bg-current opacity-10" /></CardContent>
    </Card>)}
  </section>;
}

function TableLoading() {
  return <Card aria-busy="true">
    <CardHeader><CardTitle>Ventas registradas</CardTitle><CardDescription role="status">Cargando ventas…</CardDescription></CardHeader>
    <CardContent><div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse"><div className="h-11 rounded-xl bg-secondary" />{[0, 1, 2, 3, 4].map(row => <div key={row} className="h-16 rounded-lg bg-secondary/50" />)}</div></CardContent>
  </Card>;
}
