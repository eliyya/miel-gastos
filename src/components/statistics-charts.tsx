"use client";

import { useId, useState } from "react";
import { formatMoney } from "@/lib/format";
import { periodLabel, type Period } from "@/lib/statistics";

const compactMoney = (cents: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);

/** SVG charts keep the dashboard light; the complete values also live in the period table. */
export function HistoryChart({ periods, cumulative = false }: { periods: Period[]; cumulative?: boolean }) {
  const titleId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  if (!periods.length) return <p className="py-16 text-center text-sm text-muted-foreground">Sin movimientos para graficar.</p>;
  const width = 760; const height = 275; const left = 78; const right = 15; const top = 20; const bottom = 45;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const values = periods.flatMap((p) => cumulative ? [p.cumulative] : [p.income, p.expenses]);
  const minimum = Math.min(0, ...values); const maximum = Math.max(100, ...values);
  const span = maximum - minimum;
  const y = (value: number) => top + (maximum - value) / span * plotHeight;
  const step = plotWidth / periods.length;
  const x = (index: number) => left + step * (index + 0.5);
  const active = periods[selected ?? periods.length - 1] ?? periods[periods.length - 1];
  const path = periods.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.cumulative)}`).join(" ");
  return <div className="min-w-0">
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {cumulative ? <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />Balance acumulado del período</span> : <><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-chart-1" />Ingresos por ventas</span><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-chart-3" />Gastos registrados</span></>}
    </div>
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/30 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full min-w-[520px]" role="group" aria-labelledby={titleId}>
        <title id={titleId}>{`${cumulative ? "Balance acumulado: ventas menos gastos registrados" : "Comparación histórica de ingresos y gastos"}. Usa Tab o toca un período para ver los importes. La tabla inferior contiene todos los datos.`}</title>
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = minimum + span * tick / 4;
          return <g key={tick}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="var(--border)" strokeDasharray="3 5" /><text x={left - 10} y={y(value) + 4} textAnchor="end" fontSize="11" fill="var(--muted-foreground)">{compactMoney(value)}</text></g>;
        })}
        <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="var(--muted-foreground)" strokeWidth="1" />
        {cumulative && <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" />}
        {periods.map((period, index) => <g key={period.key} tabIndex={0} role="button" aria-label={`${periodLabel(period.key)}: ${cumulative ? `acumulado ${formatMoney(period.cumulative)}` : `ingresos ${formatMoney(period.income)}, gastos ${formatMoney(period.expenses)}`}`} onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(index); } }} className="cursor-pointer outline-none focus-visible:[&>rect:first-of-type]:stroke-primary">
          <title>{`${periodLabel(period.key)} · ${cumulative ? formatMoney(period.cumulative) : `${formatMoney(period.income)} ingresos / ${formatMoney(period.expenses)} gastos`}`}</title>
          <rect x={left + step * index} y={top} width={step} height={plotHeight} fill={selected === index ? "var(--accent)" : "transparent"} opacity="0.3" />
          {cumulative ? <circle cx={x(index)} cy={y(period.cumulative)} r={periods.length > 60 ? 2 : 4} fill="var(--primary)" /> : <>
            <rect x={x(index) - step * 0.32} y={y(period.income)} width={step * 0.28} height={Math.max(0, y(0) - y(period.income))} rx="2" fill="var(--chart-1)" />
            <rect x={x(index) + step * 0.04} y={y(period.expenses)} width={step * 0.28} height={Math.max(0, y(0) - y(period.expenses))} rx="2" fill="var(--chart-3)" />
          </>}
          {((index % Math.max(1, Math.ceil(periods.length / 6)) === 0 && index < periods.length - Math.ceil(periods.length / 6)) || index === periods.length - 1) && <text x={x(index)} y={height - 15} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">{periodLabel(period.key)}</text>}
        </g>)}
      </svg>
    </div>
    <p aria-live="polite" className="mt-3 min-h-10 text-xs leading-5 text-muted-foreground"><span className="font-semibold text-foreground">{periodLabel(active.key)}</span> · {cumulative ? `Acumulado: ${formatMoney(active.cumulative)}` : `Ingresos: ${formatMoney(active.income)} · Gastos: ${formatMoney(active.expenses)} · Balance: ${formatMoney(active.balance)}`}</p>
  </div>;
}

export function CategoryChart({ categories }: { categories: { name: string; amount: number; count: number }[] }) {
  if (!categories.length) return <p className="py-12 text-center text-sm text-muted-foreground">No hay gastos en este período.</p>;
  const maximum = Math.max(1, ...categories.map((c) => c.amount));
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  return <ul className="space-y-4">{categories.map((category) => <li key={category.name}>
    <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{category.name}</span><span className="tabular-nums">{formatMoney(category.amount)}</span></div>
    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-chart-1" style={{ width: `${category.amount / maximum * 100}%` }} /></div>
    <p className="mt-1.5 text-xs text-muted-foreground">{category.count} gastos · {total ? (category.amount / total * 100).toFixed(1) : "0.0"}% del total</p>
  </li>)}</ul>;
}
