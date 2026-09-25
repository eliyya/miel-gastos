import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, icon: Icon, featured = false }: { label: string; value: string | number; hint: string; icon: LucideIcon; featured?: boolean }) {
  return <Card className={cn(featured && "bg-primary text-primary-foreground ring-primary")}><CardContent>
    <div className="flex items-center justify-between gap-3"><p className={cn("text-sm", featured ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</p><span className={cn("rounded-xl p-2.5", featured ? "bg-white/10 text-honey-light" : "bg-secondary text-honey")}><Icon className="size-4" aria-hidden="true" /></span></div>
    <p className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">{value}</p><p className={cn("mt-2 text-xs", featured ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</p>
  </CardContent></Card>;
}
