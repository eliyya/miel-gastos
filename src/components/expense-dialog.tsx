"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { saveExpenseAction } from "@/app/actions";
import { ExpenseFields } from "@/components/expense-fields";
import { vendorCache } from "@/lib/vendor-cache";
import { Button, buttonVariants } from "@/components/ui/button";

export function ExpenseDialog({ today, primary = false }: { today: string; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return <div className="flex flex-wrap items-center gap-3">
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    <Dialog.Root open={open} disablePointerDismissal onOpenChange={(value) => {
      if (submitting.current) return;
      if (value) { setError(""); setSuccess(""); }
      setOpen(value);
    }}>
      <Dialog.Trigger className={buttonVariants({ variant: primary ? "default" : "outline" })}><Plus />Registrar gasto</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-primary/35 backdrop-blur-sm" />
        <Dialog.Popup ref={popupRef} initialFocus={() => popupRef.current?.querySelector<HTMLInputElement>('input[id$="-amount"]')} className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div><Dialog.Title className="font-serif text-2xl">Registrar gasto</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Captura lo que se va pagando durante la operación diaria.</Dialog.Description></div>
            <Dialog.Close disabled={pending} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Cerrar"><X /></Dialog.Close>
          </div>
          <form className="min-h-0 overflow-y-auto" onSubmit={(event) => {
            event.preventDefault();
            if (submitting.current) return;
            const form = new FormData(event.currentTarget);
            submitting.current = true;
            setError("");
            startTransition(async () => {
              try {
                const result = await saveExpenseAction(form);
                if (result.error) setError(result.error);
                else { vendorCache.remember(String(form.get("vendor") ?? "")); setOpen(false); setSuccess(result.success ?? "Gasto registrado."); router.refresh(); }
              } catch {
                setError("No se pudo confirmar el guardado. Revisa la sección de gastos antes de volver a intentarlo.");
              } finally { submitting.current = false; }
            });
          }}>
            <fieldset disabled={pending} className="grid gap-4 p-5">
              <ExpenseFields today={today} />
              <p className="text-xs text-muted-foreground">Los campos marcados con * son obligatorios.</p>
              {error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
            </fieldset>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-card px-5 py-4">
              <Dialog.Close disabled={pending} className={buttonVariants({ variant: "outline" })}>Cancelar</Dialog.Close>
              <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar gasto"}</Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
