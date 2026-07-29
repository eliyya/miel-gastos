import { CalendarDays, LogOut, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { createExpenseAction, deleteExpenseAction, logoutAction } from "@/app/actions";
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
      where: { userId: user.id },
      orderBy: { spentAt: "desc" },
      take: 40,
    }),
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        spentAt: { gte: monthStart },
      },
      _sum: { amountCents: true },
      _count: true,
    }),
  ]);

  const monthTotal = totals._sum.amountCents ?? 0;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                Gastos de Miel
              </h1>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" />
                TOTP activo
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.name || user.email} · Martin del Campo
            </p>
          </div>
          <form action={logoutAction}>
            <Button variant="outline" type="submit">
              <LogOut />
              Salir
            </Button>
          </form>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(320px,420px)_1fr]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Registrar gasto</CardTitle>
              <CardDescription>
                Captura lo que se va pagando durante la operacion diaria.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createExpenseAction} className="grid gap-4">
                {error === "expense" ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Revisa monto, fecha y descripcion.
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
                  <Label htmlFor="category">Categoria</Label>
                  <select
                    id="category"
                    name="category"
                    defaultValue="Insumos"
                    className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="vendor">Proveedor</Label>
                  <Input id="vendor" name="vendor" placeholder="Opcional" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="paymentMethod">Metodo de pago</Label>
                  <Input
                    id="paymentMethod"
                    name="paymentMethod"
                    placeholder="Efectivo, tarjeta, transferencia"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Descripcion</Label>
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

          <div className="grid content-start gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="rounded-lg" size="sm">
                <CardHeader>
                  <CardDescription>Este mes</CardDescription>
                  <CardTitle className="text-2xl">
                    {formatMoney(monthTotal)}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-lg" size="sm">
                <CardHeader>
                  <CardDescription>Movimientos</CardDescription>
                  <CardTitle className="text-2xl">{totals._count}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="rounded-lg" size="sm">
                <CardHeader>
                  <CardDescription>Fecha</CardDescription>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="size-4" />
                    {formatDate(now)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Gastos recientes</CardTitle>
                <CardDescription>
                  Ultimos 40 registros capturados en esta cuenta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <div className="flex min-h-52 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Aun no hay gastos registrados.
                  </div>
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
      </div>
    </main>
  );
}
