import { Suspense, cache } from "react";
import { ExpenseDialog } from "@/components/expense-dialog";
import { mexicoDate } from "@/lib/statistics";
import { EmptyState } from "@/components/empty-state";
import { AppShell } from "@/components/app-shell";
import { ExpenseMonthCharts } from "@/components/expense-month-charts";
import { Trash2 } from "lucide-react";

import { deleteExpenseAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireTotpUser } from "@/lib/auth";

// Share the session lookup only within the current server render.
const getUser = cache(requireTotpUser);

export default function ExpensesPage() {
  return <AppShell title="Cada gasto, en su lugar" eyebrow="La libreta · Gastos" description="Cuida los detalles de tu negocio. Registra lo que inviertes y consulta tus movimientos." actions={
    <Suspense fallback={<Button disabled aria-busy="true">Cargando registro…</Button>}>
      <ExpenseRegistration />
    </Suspense>
  }>
    <Suspense fallback={<ChartsLoading />}>
      <MonthlyExpenses />
    </Suspense>
    <Suspense fallback={<TableLoading />}>
      <RecentExpenses />
    </Suspense>
  </AppShell>;
}

async function ExpenseRegistration() {
  await getUser();
  return <ExpenseDialog today={mexicoDate(new Date())} primary />;
}

async function MonthlyExpenses() {
  await getUser();
  const today = mexicoDate(new Date());
  const month = today.slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00-06:00`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  const monthExpenses = await prisma.expense.findMany({
    where: { spentAt: { gte: monthStart, lt: nextMonth } },
    select: { spentAt: true, amountCents: true, currency: true },
  });

  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, amount: 0, count: 0 }));
  for (const expense of monthExpenses) {
    const day = days[Number(mexicoDate(expense.spentAt).slice(8)) - 1];
    day.count++;
    if (expense.currency === "MXN") day.amount += expense.amountCents;
  }
  return <ExpenseMonthCharts days={days} month={month} today={Number(today.slice(8))} />;
}

async function RecentExpenses() {
  await getUser();
  const expenses = await prisma.expense.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 40,
  });
  const registrationDate = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });

  return (
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Gastos recientes</CardTitle>
          <CardDescription>
            Últimos 40 registros del negocio, con proveedor, método de pago y responsable.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          {expenses.length === 0 ? (
            <EmptyState title="Tu libreta está lista" description="Registra tu primer gasto y empieza a cuidar las cuentas de tu miel." />
          ) : (
            <Table className="min-w-[1150px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha del gasto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Fecha de registro</TableHead>
                  <TableHead className="w-10"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{formatDate(expense.spentAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{expense.category}</Badge>
                    </TableCell>
                    <TableCell className="min-w-48 max-w-80 whitespace-normal break-words font-medium">
                      {expense.description}
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal break-words">{expense.vendor || "Sin proveedor"}</TableCell>
                    <TableCell className="max-w-40 whitespace-normal break-words">{expense.paymentMethod || "Sin especificar"}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(expense.amountCents, expense.currency)}
                    </TableCell>
                    <TableCell><Badge variant="outline">{expense.currency}</Badge></TableCell>
                    <TableCell className="max-w-52 whitespace-normal break-words">
                      <div className="font-medium">{expense.user.name || expense.user.email}</div>
                      {expense.user.name && <div className="text-xs text-muted-foreground">{expense.user.email}</div>}
                    </TableCell>
                    <TableCell>{registrationDate.format(expense.createdAt)}</TableCell>
                    <TableCell>
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="id" value={expense.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Eliminar gasto: ${expense.description}`}
                        >
                          <Trash2 />
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
  );
}

function ChartsLoading() {
  return <section aria-label="Cargando gráficas de gastos" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
    <span role="status" className="sr-only">Cargando gráficas de gastos…</span>
    {["Gastos del mes", "Movimientos del mes"].map((title, index) => <Card key={title} className={index === 0 ? "min-h-58 bg-primary text-primary-foreground ring-primary" : "min-h-58"}>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent aria-hidden="true" className="space-y-5 motion-safe:animate-pulse"><div className="h-8 w-28 rounded-lg bg-current opacity-10" /><div className="h-16 rounded-lg bg-current opacity-10" /></CardContent>
    </Card>)}
  </section>;
}

function TableLoading() {
  return <Card aria-busy="true">
    <CardHeader><CardTitle>Gastos recientes</CardTitle><CardDescription role="status">Cargando gastos…</CardDescription></CardHeader>
    <CardContent><div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse"><div className="h-11 rounded-xl bg-secondary" />{[0, 1, 2, 3, 4].map(row => <div key={row} className="h-16 rounded-lg bg-secondary/50" />)}</div></CardContent>
  </Card>;
}
