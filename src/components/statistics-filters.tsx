"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarRange, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { Granularity } from "@/lib/statistics";

export function StatisticsFilters({ start, end, grouping, today }: { start: string; end: string; grouping: Granularity; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><CalendarRange className="size-4 text-honey" aria-hidden="true" />Elige tu período</p><div className="flex flex-wrap gap-2">
      <Link href="/statistics" className={buttonVariants({ variant: "outline", size: "sm" })}>Todo el historial</Link>
      <Link href={`/statistics?start=${today.slice(0, 4)}-01-01&end=${today}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Este año</Link>
      <Link href={`/statistics?start=${today.slice(0, 7)}-01&end=${today}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>Este mes</Link>
    </div></div>
    <form action="/statistics" method="get" aria-busy={pending} onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const from = String(data.get("start") ?? ""); const to = String(data.get("end") ?? "");
      if (from && to && from > to) { setError("La fecha inicial debe ser anterior o igual a la fecha final."); return; }
      setError("");
      const query = new URLSearchParams();
      for (const [key, value] of data) if (value) query.set(key, String(value));
      startTransition(() => router.push(`/statistics?${query}`));
    }} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <div className="grid min-w-0 gap-2"><Label htmlFor="stats-start">Fecha inicial</Label><Input id="stats-start" name="start" type="date" defaultValue={start} disabled={pending} aria-describedby="stats-dates-help" /></div>
      <div className="grid min-w-0 gap-2"><Label htmlFor="stats-end">Fecha final</Label><Input id="stats-end" name="end" type="date" defaultValue={end} disabled={pending} aria-describedby="stats-dates-help" /></div>
      <div className="grid min-w-0 gap-2"><Label htmlFor="stats-group">Agrupar por</Label><NativeSelect id="stats-group" name="group" defaultValue={grouping} disabled={pending}><option value="day">Día</option><option value="month">Mes</option><option value="year">Año</option></NativeSelect></div>
      <Button type="submit" disabled={pending} className="h-11">{pending ? <LoaderCircle className="motion-safe:animate-spin" /> : <SlidersHorizontal />} {pending ? "Actualizando…" : "Aplicar filtros"}</Button>
    </form>
    <p id="stats-dates-help" className="text-xs leading-5 text-muted-foreground">Ambas fechas se incluyen. Deja una fecha vacía para consultar sin ese límite.</p>
    <p role="status" className="sr-only">{pending ? "Actualizando estadísticas…" : ""}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
