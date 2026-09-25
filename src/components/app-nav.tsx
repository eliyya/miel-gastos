"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ReceiptText, Settings2, ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Gastos", icon: ReceiptText },
  { href: "/sales", label: "Ventas", icon: ShoppingBag },
  { href: "/sales/catalog", label: "Catálogos", icon: BookOpen },
  { href: "/settings", label: "Mi cuenta", icon: Settings2 },
];

export function AppNav() {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal" className="grid w-full grid-cols-4 gap-1 pb-1 sm:flex sm:w-auto">
    {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn(buttonVariants({ variant: "ghost" }), "h-auto flex-col gap-1 px-2 py-2 text-xs text-muted-foreground sm:h-10 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm", pathname === href && "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground")}><Icon aria-hidden="true" />{label}</Link>)}
  </nav>;
}
