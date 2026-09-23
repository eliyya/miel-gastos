"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button, buttonVariants } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

/** Promise-based confirmation: resolves after success or cancellation; failures stay open. */
export function useAsyncConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const resolve = useRef<((confirmed: boolean) => void) | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);

  function finish(confirmed: boolean) {
    const complete = resolve.current;
    resolve.current = null;
    setOptions(null);
    complete?.(confirmed);
  }

  function confirm(next: ConfirmOptions): Promise<boolean> {
    if (resolve.current) return Promise.resolve(false);
    setError("");
    setOptions(next);
    return new Promise((complete) => { resolve.current = complete; });
  }

  const modal = <Dialog.Root open={options !== null} disablePointerDismissal onOpenChange={(open) => {
    if (!open && !busy.current) finish(false);
  }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45" />
      <Dialog.Popup initialFocus={cancelButton} aria-busy={pending} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-6 shadow-xl">
        <Dialog.Title className="text-lg font-semibold">{options?.title}</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">{options?.description}</Dialog.Description>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Dialog.Close ref={cancelButton} disabled={pending} className={buttonVariants({ variant: "outline" })}>Cancelar</Dialog.Close>
          <Button variant="destructive" disabled={pending} onClick={async () => {
            if (busy.current || !options) return;
            busy.current = true;
            setPending(true);
            setError("");
            try { await options.onConfirm(); finish(true); }
            catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo completar la operación. Inténtalo de nuevo."); }
            finally { busy.current = false; setPending(false); }
          }}>{pending ? "Eliminando…" : options?.confirmLabel}</Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
  return { confirm, modal };
}
