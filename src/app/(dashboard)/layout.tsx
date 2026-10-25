import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { requireTotpUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireTotpUser();
  return (
    <div className="min-h-svh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3"
      >
        Saltar al contenido
      </a>
      <AppHeader user={user} />
      {children}
    </div>
  );
}
