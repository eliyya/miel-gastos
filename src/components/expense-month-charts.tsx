"use client";

import { useId, useState } from "react";
import { ReceiptText, Wallet, ShoppingBag, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Day = { day: number; amount: number; count: number };

export function ExpenseMonthCharts({ days, month, today }: { days: Day[]; month: string; today: number }) {
  return <section aria-label="Gráficas diarias de gastos del mes" className="grid gap-4 lg:grid-cols-2">
    <MonthChart days={days} month={month} today={today} metric="amount" />
    <MonthChart days={days} month={month} today={today} metric="count" />
  </section>;
}

export function SalesMonthCharts({ days, month, today }: { days: Day[]; month: string; today: number }) {
  return <section aria-label="Gráficas diarias de ventas del mes" className="grid gap-4 lg:grid-cols-2">
    <MonthChart days={days} month={month} today={today} metric="amount" sales />
    <MonthChart days={days} month={month} today={today} metric="count" sales />
  </section>;
}

function MonthChart({ days, month, today, metric, sales = false }: { days: Day[]; month: string; today: number; metric: "amount" | "count"; sales?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const featured = metric === "amount";
  const Icon = sales ? (featured ? ShoppingBag : Package) : (featured ? Wallet : ReceiptText);
  const label = sales ? (featured ? "Ventas del mes" : "Productos vendidos") : (featured ? "Gastos del mes" : "Movimientos del mes");
  const total = days.reduce((sum, day) => sum + day[metric], 0);
  const formatValue = (value: number) => featured ? formatMoney(value) : `${value} ${sales ? "productos" : "movimientos"}`;
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T12:00:00Z`));
  const maximum = Math.max(1, ...days.map(day => day[metric]));
  const x = (index: number) => 10 + index / (days.length - 1) * 380;
  const y = (value: number) => 106 - value / maximum * 86;
  // Future days stay unplotted rather than implying that they have no activity.
  const plotted = days.filter(day => day.day <= today || day.count > 0);
  const path = plotted.map((day, index) => `${index ? "L" : "M"}${x(day.day - 1)},${y(day[metric])}`).join(" ");
  const active = selected === null ? null : days[selected];
  const ink = featured ? "var(--chart-5)" : "var(--color-honey)";
  const muted = featured ? "text-primary-foreground/70" : "text-muted-foreground";

  return <Card className={cn("min-w-0 overflow-hidden", featured && "bg-primary text-primary-foreground ring-primary")}>
    <CardContent>
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-medium">{label}</h2><p className={cn("mt-1 text-xs capitalize", muted)}>{monthLabel}</p></div>
        <span className={cn("rounded-xl p-2.5", featured ? "bg-white/10 text-honey-light" : "bg-secondary text-honey")}><Icon className="size-4" aria-hidden="true" /></span>
      </div>
      <div className="mt-4 flex min-w-0 items-end gap-5">
        <div className="shrink-0 pb-5"><p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{featured ? formatMoney(total) : total}</p><p className={cn("mt-2 text-xs", muted)}>{featured ? "Total en MXN" : sales ? "Unidades vendidas" : "Gastos registrados"}</p></div>
        <svg viewBox="0 0 400 130" className="min-w-0 flex-1 overflow-visible" role="group" aria-label={`${label}: valores diarios de ${monthLabel}. Usa Tab para consultar cada día.`} onMouseLeave={() => setSelected(null)}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ink} stopOpacity="0.25" /><stop offset="100%" stopColor={ink} stopOpacity="0" /></linearGradient></defs>
          {[20, 63, 106].map(row => <line key={row} x1="10" x2="390" y1={row} y2={row} stroke="currentColor" opacity="0.1" strokeDasharray="3 6" />)}
          {plotted.length > 0 && <><path d={`${path} L${x(plotted.at(-1)!.day - 1)},106 L10,106 Z`} fill={`url(#${id})`} /><path d={path} fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></>}
          {[1, 15, days.length].map(day => <text key={day} x={x(day - 1)} y="127" textAnchor={day === 1 ? "start" : day === days.length ? "end" : "middle"} fill="currentColor" opacity="0.65" fontSize="11">{day}</text>)}
          {days.map((day, index) => <g key={day.day} tabIndex={0} role="button" aria-label={`${day.day} de ${monthLabel}: ${day.day > today && !day.count ? "día pendiente" : formatValue(day[metric])}`} onFocus={() => setSelected(index)} onBlur={() => setSelected(null)} onMouseEnter={() => setSelected(index)} onClick={() => setSelected(index)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(index); } }} className="cursor-pointer outline-none">
            <rect x={x(index) - 6} y="0" width="12" height="112" fill="transparent" />
            {selected === index && <><line x1={x(index)} x2={x(index)} y1="10" y2="106" stroke={ink} opacity="0.5" strokeDasharray="3 3" /><circle cx={x(index)} cy={y(day[metric])} r="4" fill={ink} /></>}
          </g>)}
        </svg>
      </div>
      <p aria-live="polite" className={cn("mt-3 min-h-4 text-xs", muted)}>{active ? `${active.day} de ${monthLabel} · ${active.day > today && !active.count ? "Día pendiente" : formatValue(active[metric])}` : total === 0 ? (sales ? "Sin ventas registradas este mes" : "Sin gastos registrados este mes") : featured ? (sales ? "Importe vendido por día" : "Importe gastado por día") : (sales ? "Unidades vendidas por día" : "Número de gastos por día")}</p>
    </CardContent>
  </Card>;
}
