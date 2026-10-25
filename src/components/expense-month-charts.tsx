"use client";

import { useId, useState } from "react";
import { ReceiptText, Wallet, ShoppingBag, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Day = { date: string; amount: number; count: number };

export function ExpenseMonthCharts({ days }: { days: Day[] }) {
  return (
    <section
      aria-label="Gráficas diarias de gastos · últimos 30 días"
      className="grid gap-4 lg:grid-cols-2"
    >
      <MonthChart days={days} metric="amount" />
      <MonthChart days={days} metric="count" />
    </section>
  );
}

export function SalesMonthCharts({ days }: { days: Day[] }) {
  return (
    <section
      aria-label="Gráficas diarias de ventas · últimos 30 días"
      className="grid gap-4 lg:grid-cols-2"
    >
      <MonthChart days={days} metric="amount" sales />
      <MonthChart days={days} metric="count" sales />
    </section>
  );
}

function MonthChart({
  days,
  metric,
  sales = false,
}: {
  days: Day[];
  metric: "amount" | "count";
  sales?: boolean;
}) {
  const id = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const featured = metric === "amount";
  const Icon = sales ? (featured ? ShoppingBag : Package) : featured ? Wallet : ReceiptText;
  const label = sales
    ? featured
      ? "Ventas · últimos 30 días"
      : "Productos vendidos"
    : featured
      ? "Gastos · últimos 30 días"
      : "Movimientos · últimos 30 días";
  const total = days.reduce((sum, day) => sum + day[metric], 0);
  const formatValue = (value: number) =>
    featured ? formatMoney(value) : `${value} ${sales ? "productos" : "movimientos"}`;
  const dateLabel = (date: string, year = false) =>
    new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const rangeLabel = `${dateLabel(days[0].date, true)} – ${dateLabel(days.at(-1)!.date, true)}`;
  const maximum = Math.max(1, ...days.map((day) => day[metric]));
  const x = (index: number) => 10 + (index / (days.length - 1)) * 380;
  const y = (value: number) => 106 - (value / maximum) * 86;
  const path = days
    .map((day, index) => `${index ? "L" : "M"}${x(index)},${y(day[metric])}`)
    .join(" ");
  const active = selected === null ? null : days[selected];
  const ink = featured ? "var(--chart-5)" : "var(--color-honey)";
  const muted = featured ? "text-primary-foreground/70" : "text-muted-foreground";

  return (
    <Card
      className={cn(
        "min-w-0 overflow-hidden",
        featured && "bg-primary text-primary-foreground ring-primary",
      )}
    >
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{label}</h2>
            <p className={cn("mt-1 text-xs", muted)}>{rangeLabel}</p>
          </div>
          <span
            className={cn(
              "rounded-xl p-2.5",
              featured ? "bg-white/10 text-honey-light" : "bg-secondary text-honey",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-4 flex min-w-0 items-end gap-5">
          <div className="shrink-0 pb-5">
            <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
              {featured ? formatMoney(total) : total}
            </p>
            <p className={cn("mt-2 text-xs", muted)}>
              {featured ? "Total en MXN" : sales ? "Unidades vendidas" : "Gastos registrados"}
            </p>
          </div>
          <svg
            viewBox="0 0 400 130"
            className="min-w-0 flex-1 overflow-visible"
            role="group"
            aria-label={`${label}: valores diarios de ${rangeLabel}. Usa Tab para consultar cada día.`}
            onMouseLeave={() => setSelected(null)}
          >
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ink} stopOpacity="0.25" />
                <stop offset="100%" stopColor={ink} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 63, 106].map((row) => (
              <line
                key={row}
                x1="10"
                x2="390"
                y1={row}
                y2={row}
                stroke="currentColor"
                opacity="0.1"
                strokeDasharray="3 6"
              />
            ))}
            {days.length > 0 && (
              <>
                <path d={`${path} L${x(days.length - 1)},106 L10,106 Z`} fill={`url(#${id})`} />
                <path
                  d={path}
                  fill="none"
                  stroke={ink}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            )}
            {[0, 14, days.length - 1].map((index) => (
              <text
                key={index}
                x={x(index)}
                y="127"
                textAnchor={index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}
                fill="currentColor"
                opacity="0.65"
                fontSize="11"
              >
                {dateLabel(days[index].date)}
              </text>
            ))}
            {days.map((day, index) => (
              <g
                key={day.date}
                tabIndex={0}
                role="button"
                aria-label={`${dateLabel(day.date, true)}: ${formatValue(day[metric])}`}
                onFocus={() => setSelected(index)}
                onBlur={() => setSelected(null)}
                onMouseEnter={() => setSelected(index)}
                onClick={() => setSelected(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(index);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect x={x(index) - 6} y="0" width="12" height="112" fill="transparent" />
                {selected === index && (
                  <>
                    <line
                      x1={x(index)}
                      x2={x(index)}
                      y1="10"
                      y2="106"
                      stroke={ink}
                      opacity="0.5"
                      strokeDasharray="3 3"
                    />
                    <circle cx={x(index)} cy={y(day[metric])} r="4" fill={ink} />
                  </>
                )}
              </g>
            ))}
          </svg>
        </div>
        <p aria-live="polite" className={cn("mt-3 min-h-4 text-xs", muted)}>
          {active
            ? `${dateLabel(active.date, true)} · ${formatValue(active[metric])}`
            : total === 0
              ? sales
                ? "Sin ventas registradas en los últimos 30 días"
                : "Sin gastos registrados en los últimos 30 días"
              : featured
                ? sales
                  ? "Importe vendido por día"
                  : "Importe gastado por día"
                : sales
                  ? "Unidades vendidas por día"
                  : "Número de gastos por día"}
        </p>
      </CardContent>
    </Card>
  );
}
