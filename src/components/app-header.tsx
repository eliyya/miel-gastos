import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = { user: { name: string | null; email: string; role: string } };

export function AppHeader({ user }: Props) {
  return (
    <header className="border-b bg-card/90">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between gap-4 py-5">
          <Link
            href="/"
            aria-label="Martín del Campo · Inicio"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Image src="/brand/mmdc-logo.svg" alt="" width={48} height={48} priority />
            <div>
              <p className="font-serif text-sm sm:text-base">Martín del Campo</p>
              <p className="mt-1 text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                La libreta de nuestra miel
              </p>
            </div>
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-48 truncate text-sm font-medium">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground">
                {user.role === "OWNER" ? "Propietario" : "Administrador"}
              </p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="icon" aria-label="Cerrar sesión">
                <LogOut aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 pb-3">
          <AppNav />
          <Badge variant="outline" className="hidden gap-1.5 text-muted-foreground lg:inline-flex">
            <ShieldCheck className="size-3.5" /> Acceso protegido
          </Badge>
        </div>
      </div>
    </header>
  );
}
