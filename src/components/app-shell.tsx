import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  user: { name: string | null; email: string; role: string };
  title: string;
  description: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ user, title, description, eyebrow, actions, children }: Props) {
  return <div className="min-h-svh">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Saltar al contenido</a>
    <header className="border-b bg-card/90">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4 py-5">
          <Link href="/" aria-label="Martín del Campo · Inicio" className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
            <Image src="/brand/mmdc-logo.svg" alt="" width={48} height={48} priority />
            <div><p className="font-serif text-sm sm:text-base">Martín del Campo</p><p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">La libreta de nuestra miel</p></div>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block"><p className="max-w-48 truncate text-sm font-medium">{user.name || user.email}</p><p className="text-xs text-muted-foreground">{user.role === "OWNER" ? "Propietario" : "Administrador"}</p></div>
            <form action={logoutAction}><Button type="submit" variant="outline" size="icon" aria-label="Cerrar sesión"><LogOut aria-hidden="true" /></Button></form>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pb-3"><AppNav /><Badge variant="outline" className="hidden gap-1.5 text-muted-foreground lg:inline-flex"><ShieldCheck className="size-3.5" /> Acceso protegido</Badge></div>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] space-y-7 px-4 py-7 outline-none sm:px-8 sm:py-9 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl"><p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-honey uppercase">{eyebrow}</p><h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-[11px] text-muted-foreground"><span>Martín del Campo · Miel de abeja</span><span>Hecho con cuidado, en cada detalle.</span></footer>
    </main>
  </div>;
}
