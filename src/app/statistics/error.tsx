"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function StatisticsError({ unstable_retry }: { unstable_retry: () => void }) {
  return <main className="mx-auto flex min-h-svh w-full max-w-xl items-center px-4 py-10"><Card><CardHeader><CardTitle>No pudimos cargar las estadísticas</CardTitle><CardDescription>La consulta no se completó. Intenta de nuevo en un momento para ver los datos actualizados.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button onClick={() => unstable_retry()}><RefreshCw />Reintentar</Button><Link href="/" className={buttonVariants({ variant: "outline" })}>Volver a gastos</Link></CardContent></Card></main>;
}
