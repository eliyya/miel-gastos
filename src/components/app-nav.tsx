"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChartNoAxesCombined, ReceiptText, Settings2, ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Gastos", icon: ReceiptText },
  { href: "/sales", label: "Ventas", icon: ShoppingBag },
  { href: "/statistics", label: "Estadísticas", icon: ChartNoAxesCombined },
  { href: "/sales/catalog", label: "Catálogos", icon: BookOpen },
  { href: "/settings", label: "Mi cuenta", icon: Settings2 },
];

export function AppNav() {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal" className="grid w-full grid-cols-5 gap-0.5 pb-1 sm:flex sm:w-auto sm:gap-1">
    {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn(buttonVariants({ variant: "ghost" }), "h-auto min-w-0 flex-col gap-1 px-0.5 py-2 text-[9px] text-muted-foreground min-[380px]:text-[10px] sm:h-10 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm lg:px-4", pathname === href && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground")}><Icon aria-hidden="true" />{label}</Link>)}
  </nav>;
}
