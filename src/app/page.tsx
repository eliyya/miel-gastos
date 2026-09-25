import { EmptyState } from "@/components/empty-state";
import { NativeSelect } from "@/components/ui/native-select";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { CalendarDays, Plus, ReceiptText, Wallet, Trash2 } from "lucide-react";

import { createExpenseAction, deleteExpenseAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireTotpUser } from "@/lib/auth";

const categories = [
  "Insumos",
  "Envases",
  "Etiquetas",
  "Transporte",
  "Produccion",
  "Ventas",
  "Servicios",
  "General",
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireTotpUser();
  const { error } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = now.toISOString().slice(0, 10);

  const [expenses, totals] = await Promise.all([
    prisma.expense.findMany({
      orderBy: { spentAt: "desc" },
      take: 40,
    }),
    prisma.expense.aggregate({
      where: {
        spentAt: { gte: monthStart },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  const monthTotal = totals._sum.amountCents ?? 0;

  return (
    <AppShell user={user} title="Cada gasto, en su lugar" eyebrow="La libreta · Gastos" description="Cuida los detalles de tu negocio. Registra lo que inviertes y consulta tus movimientos.">
      <section aria-label="Resumen de gastos" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gastos del mes" value={formatMoney(monthTotal)} hint="Inversión en la operación" icon={Wallet} featured />
        <StatCard label="Movimientos del mes" value={totals._count} hint="Gastos registrados este mes" icon={ReceiptText} />
        <StatCard label="Hoy" value={formatDate(now)} hint="Un buen día para llevar las cuentas" icon={CalendarDays} />
      </section>
        <section className="grid items-start gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Registrar gasto</CardTitle>
              <CardDescription>
                Captura lo que se va pagando durante la operación diaria.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createExpenseAction} className="grid gap-4">
                {error === "expense" ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Revisa monto, fecha y descripción.
                  </p>
                ) : null}

                <div className="grid gap-2">
                  <Label htmlFor="amount">Monto</Label>
                  <Input
                    id="amount"
                    name="amount"
                    inputMode="decimal"
                    placeholder="350.00"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="spentAt">Fecha</Label>
                  <Input
                    id="spentAt"
                    name="spentAt"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Categoría</Label>
                  <NativeSelect id="category" name="category" defaultValue="Insumos">
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="vendor">Proveedor</Label>
                  <Input id="vendor" name="vendor" placeholder="Opcional" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Método de pago</Label>
                  <Input
                    id="paymentMethod"
                    name="paymentMethod"
                    placeholder="Efectivo, tarjeta, transferencia"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Frascos de vidrio, gasolina para entrega..."
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full">
                  <Plus />
                  Guardar gasto
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid min-w-0 content-start gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Gastos recientes</CardTitle>
                <CardDescription>
                  Últimos 40 registros capturados para el negocio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <EmptyState title="Tu libreta está lista" description="Registra tu primer gasto y empieza a cuidar las cuentas de tu miel." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Detalle</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>{formatDate(expense.spentAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[340px] whitespace-normal">
                            <div className="font-medium">{expense.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {[expense.vendor, expense.paymentMethod]
                                .filter(Boolean)
                                .join(" · ") || "Sin proveedor"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(expense.amountCents, expense.currency)}
                          </TableCell>
                          <TableCell>
                            <form action={deleteExpenseAction}>
                              <input type="hidden" name="id" value={expense.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Eliminar gasto"
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
          </div>
        </section>
    </AppShell>
  );
}
