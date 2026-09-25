import type { Metadata } from "next";
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CircleHelp, Package, ReceiptText, Scale, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { StatisticsFilters } from "@/components/statistics-filters";
import { CategoryChart, HistoryChart } from "@/components/statistics-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireTotpUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { buildStatistics, mexicoDate, parseStatisticsRange, periodLabel, type Granularity } from "@/lib/statistics";

export const metadata: Metadata = { title: "Estadísticas · Miel" };
type Params = { start?: string | string[]; end?: string | string[]; group?: string | string[] };
const groupingNames = { day: "día", month: "mes", year: "año" };
const signedClass = (value: number) => value < 0 ? "text-destructive" : "text-emerald-700";

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireTotpUser();
  const params = await searchParams;
  const { range, error } = parseStatisticsRange(params.start, params.end);
  const grouping: Granularity = params.group === "day" || params.group === "year" ? params.group : "month";
  const filters = <StatisticsFilters key={`${range.start}:${range.end}:${grouping}`} start={range.start ?? ""} end={range.end ?? ""} grouping={grouping} today={mexicoDate(new Date())} />;
  if (error) return <AppShell user={user} title="Los números de tu miel" eyebrow="La libreta · Estadísticas" description="Consulta el historial completo o elige un período para entender cómo va tu negocio.">{filters}<p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{error}</p></AppShell>;

  // Read the entire selected history, independently of the 40-row listing pages.
  // Fetch a broad timestamp window for expenses, then apply Mexico calendar dates.
  const start = range.start ? new Date(`${range.start}T00:00:00Z`) : undefined;
  const end = range.end ? new Date(`${range.end}T00:00:00Z`) : undefined;
  const [sales, expenses] = await prisma.$transaction([
    prisma.sale.findMany({
      where: { soldAt: { gte: start, lte: end } },
      select: { soldAt: true, createdAt: true, sellerId: true, sellerName: true, paidByCard: true, cardRateBps: true, items: { select: { productId: true, productName: true, quantity: true, unitPriceCents: true, unitCostCents: true, commissionBps: true } } },
    }),
    prisma.expense.findMany({
      where: { spentAt: { gte: start, lt: end ? new Date(end.getTime() + 2 * 86_400_000) : undefined } },
      select: { spentAt: true, amountCents: true, currency: true, category: true },
    }),
  ], { isolationLevel: "RepeatableRead" });
  const stats = buildStatistics(sales, expenses, range, grouping);
  const t = stats.totals;
  const hasData = t.sales + t.expenseCount > 0;
  const strongest = t.sales ? [...stats.periods].sort((a, b) => b.income - a.income)[0] : null;
  return <AppShell user={user} title="Los números de tu miel" eyebrow="La libreta · Estadísticas" description="Una mirada a tus ventas, gastos y márgenes. Del primer registro hasta hoy, o justo el período que necesitas.">
    {filters}
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <Badge variant="secondary">{!range.start && !range.end ? "Historial completo" : "Período personalizado"}</Badge>
      <span>{stats.firstDay && stats.lastDay ? `Movimientos del ${periodLabel(stats.firstDay)} al ${periodLabel(stats.lastDay)} · ` : ""}{t.sales} ventas y {t.expenseCount} gastos · MXN</span>
    </div>
    {stats.excludedExpenses > 0 && <p role="status" className="rounded-xl border bg-card p-4 text-sm">Se excluyeron {stats.excludedExpenses} gastos en otra moneda. Los importes de este análisis están en MXN y no se convierten entre monedas.</p>}
    <section aria-label="Resumen del período" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Ingresos por ventas" value={formatMoney(t.income)} hint={`${t.sales} ventas registradas`} icon={ArrowUpRight} />
      <StatCard label="Egresos de la libreta" value={formatMoney(t.expenses)} hint={`${t.expenseCount} gastos registrados`} icon={ArrowDownLeft} />
      <StatCard label="Balance registrado" value={formatMoney(t.balance)} hint="Ventas menos gastos de la libreta" icon={Scale} featured />
      <StatCard label="Margen de las ventas" value={formatMoney(t.margin)} hint={stats.marginPercent === null ? "Sin ingresos para calcular porcentaje" : `${stats.marginPercent.toFixed(1)}% de los ingresos · antes de gastos`} icon={ChartNoAxesCombined} />
    </section>
    <div className="flex gap-3 rounded-xl border border-honey/20 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground"><CircleHelp aria-hidden="true" className="mt-1 size-4 shrink-0 text-honey" /><p>El <strong className="font-medium text-foreground">balance registrado</strong> compara ventas con gastos de la libreta. El <strong className="font-medium text-foreground">margen de las ventas</strong> descuenta producción y comisiones de cada venta. Se muestran por separado porque algunos costos podrían estar también registrados como gastos. Ninguno representa por sí solo la utilidad neta ni el saldo bancario.</p></div>
    {!hasData ? <EmptyState title="Este período está listo para empezar" description="No hay ventas ni gastos en MXN para estas fechas. Prueba otro rango o consulta todo el historial." /> : <>
      <section aria-label="Actividad del período" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ticket promedio" value={stats.averageTicket === null ? "—" : formatMoney(stats.averageTicket)} hint="Ingresos divididos entre ventas" icon={ReceiptText} />
        <StatCard label="Unidades vendidas" value={t.units.toLocaleString("es-MX")} hint={`${stats.products.length} productos con ventas`} icon={Package} />
        <StatCard label={`Mejor ${groupingNames[stats.grouping]} en ventas`} value={strongest ? formatMoney(strongest.income) : "—"} hint={strongest ? periodLabel(strongest.key) : "Sin ventas en el período"} icon={ShoppingBag} />
      </section>
      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className="min-w-0"><CardHeader><CardTitle>Ingresos frente a egresos</CardTitle><CardDescription>Totales por {groupingNames[stats.grouping]}. Incluye períodos sin movimientos.{stats.grouping !== grouping && " Agrupación ampliada para mantener legible el historial."}</CardDescription></CardHeader><CardContent><HistoryChart periods={stats.periods} /></CardContent></Card>
        <Card className="min-w-0"><CardHeader><CardTitle>Cómo evoluciona el balance</CardTitle><CardDescription>Acumulado de ventas menos gastos, empezando en cero al inicio del período seleccionado.</CardDescription></CardHeader><CardContent><HistoryChart periods={stats.periods} cumulative /></CardContent></Card>
      </section>
      <section className="grid items-start gap-5 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>¿En qué se está gastando?</CardTitle><CardDescription>Todas las categorías de la libreta, de mayor a menor importe.</CardDescription></CardHeader><CardContent><CategoryChart categories={stats.categories} /></CardContent></Card>
        <div className="grid gap-5">
          <Card><CardHeader><CardTitle>De la venta al margen</CardTitle><CardDescription>Costos guardados al registrar cada venta, aunque el catálogo haya cambiado después.</CardDescription></CardHeader><CardContent><dl className="space-y-3 text-sm">
            {[["Ingresos por ventas", t.income], ["Costo de producción", -t.production], ["Comisiones de vendedores", -t.commissions], ["Comisiones de tarjeta", -t.cardFees]].map(([label, amount]) => <div key={String(label)} className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{formatMoney(Number(amount))}</dd></div>)}
            <div className="flex flex-wrap justify-between gap-2 border-t pt-3 font-semibold"><dt>Margen de ventas</dt><dd className={`tabular-nums ${signedClass(t.margin)}`}>{formatMoney(t.margin)}</dd></div>
          </dl></CardContent></Card>
          <Card><CardHeader><CardTitle>Forma de pago en ventas</CardTitle><CardDescription>“Sin tarjeta” agrupa las ventas no marcadas como pago con tarjeta.</CardDescription></CardHeader><CardContent><dl className="grid gap-4 sm:grid-cols-2">{[["Con tarjeta", stats.payments.card], ["Sin tarjeta", stats.payments.other]].map(([label, payment]) => {
            const p = payment as typeof stats.payments.card;
            return <div key={String(label)} className="rounded-xl border bg-background/40 p-4"><dt className="text-sm text-muted-foreground">{String(label)}</dt><dd className="mt-2 text-lg font-semibold tabular-nums">{formatMoney(p.income)}</dd><dd className="mt-1 text-xs text-muted-foreground">{p.count} ventas · {t.income ? (p.income / t.income * 100).toFixed(1) : "0.0"}% de ingresos</dd></div>;
          })}</dl></CardContent></Card>
        </div>
      </section>
      <Card className="min-w-0"><CardHeader><CardTitle>Productos que mueven tu negocio</CardTitle><CardDescription>Todos los productos vendidos, ordenados por ingresos. El margen por producto descuenta producción y vendedor; no reparte la comisión de tarjeta.</CardDescription></CardHeader><CardContent>
        {!stats.products.length ? <p className="text-sm text-muted-foreground">No hay productos vendidos en este período.</p> : <Table><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">Ingresos</TableHead><TableHead className="text-right">% de ingresos</TableHead><TableHead className="text-right">Margen sin tarjeta</TableHead></TableRow></TableHeader><TableBody>{stats.products.map((p) => <TableRow key={p.id}><TableCell className="whitespace-normal font-medium">{p.name}</TableCell><TableCell className="text-right tabular-nums">{p.units}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(p.income)}</TableCell><TableCell className="text-right tabular-nums">{t.income ? (p.income / t.income * 100).toFixed(1) : "0.0"}%</TableCell><TableCell className={`text-right tabular-nums ${signedClass(p.margin)}`}>{formatMoney(p.margin)}</TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>Ventas por vendedor</CardTitle><CardDescription>Incluye vendedores inactivos con ventas en el período. Los nombres corresponden a su registro de venta más reciente dentro del rango.</CardDescription></CardHeader><CardContent>
        {!stats.sellers.length ? <p className="text-sm text-muted-foreground">No hay ventas de vendedores en este período.</p> : <Table><TableHeader><TableRow>{["Vendedor", "Ventas", "Unidades", "Ingresos", "Comisiones", "Margen de ventas"].map((label, i) => <TableHead key={label} className={i ? "text-right" : ""}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{stats.sellers.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell className="text-right tabular-nums">{s.sales}</TableCell><TableCell className="text-right tabular-nums">{s.units}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(s.income)}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(s.commissions)}</TableCell><TableCell className={`text-right tabular-nums ${signedClass(s.margin)}`}>{formatMoney(s.margin)}</TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>
      <Card className="min-w-0"><CardHeader><CardTitle>El historial, período por período</CardTitle><CardDescription>Los mismos importes de las gráficas, con detalle exacto en pesos mexicanos. Los períodos de los extremos pueden ser parciales según las fechas elegidas.</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow>{["Período", "Ventas", "Ingresos", "Egresos", "Balance", "Acumulado", "Margen de ventas"].map((label, i) => <TableHead key={label} className={i ? "text-right" : ""}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{stats.periods.map((p) => <TableRow key={p.key}><TableCell className="font-medium">{periodLabel(p.key)}</TableCell><TableCell className="text-right tabular-nums">{p.sales}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(p.income)}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(p.expenses)}</TableCell><TableCell className={`text-right tabular-nums ${signedClass(p.balance)}`}>{formatMoney(p.balance)}</TableCell><TableCell className={`text-right tabular-nums ${signedClass(p.cumulative)}`}>{formatMoney(p.cumulative)}</TableCell><TableCell className={`text-right tabular-nums ${signedClass(p.margin)}`}>{formatMoney(p.margin)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </>}
    <details className="rounded-xl border bg-card px-5 py-4 text-sm"><summary className="font-medium">Cómo leer estas estadísticas</summary><div className="mt-3 space-y-2 leading-6 text-muted-foreground"><p>Ingresos = importe de las ventas registradas. La app no distingue cobros pendientes, devoluciones ni movimientos bancarios. Egresos = gastos capturados en la libreta; las comisiones de venta no se agregan automáticamente.</p><p>Las ventas se agrupan por la fecha de venta y los gastos por su día en Ciudad de México. Se incluyen ambas fechas del filtro. El historial considera todos los registros disponibles, no solo los visibles en las tablas de captura.</p><p>El margen utiliza los precios, costos y comisiones históricos de cada partida. Los productos se agrupan por su identificador y muestran su nombre registrado más reciente en el período. Los cálculos conservan el redondeo de la venta original.</p></div></details>
  </AppShell>;
}
