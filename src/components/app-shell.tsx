import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  eyebrow: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AppShell({ title, description, eyebrow, actions, children }: Props) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] space-y-7 px-4 py-7 outline-none sm:px-8 sm:py-9 lg:px-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl"><p className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-honey uppercase">{eyebrow}</p><h1 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p></div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
      <footer className="flex flex-wrap justify-between gap-2 border-t pt-5 text-[11px] text-muted-foreground"><span>Martín del Campo · Miel de abeja</span><span>Hecho con cuidado, en cada detalle.</span></footer>
    </main>
  );
}
