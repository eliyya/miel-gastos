"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Plus, Trash2, X } from "lucide-react";
import { createSaleAction } from "@/app/sales/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { calculateSale, parseHundredths, saleSnapshot, type CatalogProduct, type CatalogSeller } from "@/lib/sales";

const selectClass = "h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2";
type Row = { key: number; productId: string; quantity: string; unitPrice?: string };

export function SaleDialog({ products, sellers, today }: {
  products: CatalogProduct[];
  sellers: CatalogSeller[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [soldAt, setSoldAt] = useState(today);
  const [customer, setCustomer] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [paidByCard, setPaidByCard] = useState(false);
  const [cardRate, setCardRate] = useState("4.06");
  const [rows, setRows] = useState<Row[]>([{ key: 0, productId: "", quantity: "1" }]);
  const nextKey = useRef(1);
  const seller = sellers.find((s) => s.id === sellerId);
  const snapshot = seller ? saleSnapshot(products, seller, rows.map((r) => ({ productId: r.productId, quantity: Number(r.quantity), unitPriceCents: r.unitPrice === undefined ? undefined : parseHundredths(r.unitPrice) ?? 0 }))) : null;
  const missingCommission = !!seller && rows.some((r) => r.productId && !seller.commissions.some((c) => c.productId === r.productId));
  const previewItems = rows.map((row) => {
    const product = products.find((p) => p.id === row.productId);
    return {
      quantity: /^\d+$/.test(row.quantity) ? Math.min(Number(row.quantity), 10_000) : 0,
      unitPriceCents: row.unitPrice === undefined ? product?.priceCents ?? 0 : parseHundredths(row.unitPrice) ?? 0, unitCostCents: product?.costCents ?? 0,
      commissionBps: seller?.commissions.find((c) => c.productId === row.productId)?.rateBps ?? 0,
    };
  });
  const totals = calculateSale(previewItems, paidByCard ? parseHundredths(cardRate, 10_000) ?? 0 : 0);
  const updateRow = (key: number, patch: Partial<Row>) => setRows((current) => current.map((r) => r.key === key ? { ...r, ...patch } : r));

  function reset() {
    setSoldAt(today); setCustomer(""); setSellerId(""); setPaidByCard(false); setCardRate("4.06");
    setRows([{ key: nextKey.current++, productId: "", quantity: "1" }]); setError("");
  }

  return <div className="flex flex-wrap items-center gap-3">
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    <Dialog.Root open={open} disablePointerDismissal onOpenChange={(value) => {
      if (submitting.current) return;
      if (value) { reset(); setSuccess(""); }
      setOpen(value);
    }}>
      <Dialog.Trigger className={buttonVariants()}><Plus />Registrar venta</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
            <div><Dialog.Title className="text-xl font-semibold">Registrar venta</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Incluye todos los productos de la venta y revisa los importes antes de guardar.</Dialog.Description></div>
            <Dialog.Close disabled={pending} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Cerrar"><X /></Dialog.Close>
          </div>
          {!products.length || !sellers.length ? <div className="space-y-4 p-5"><p className="text-sm">Necesitas al menos un producto y un vendedor activos para registrar una venta.</p><Link href="/sales/catalog" className={buttonVariants({ variant: "outline" })}>Ir a catálogos</Link></div> :
            <form className="min-h-0 overflow-y-auto" onSubmit={(event) => {
              event.preventDefault();
              if (submitting.current) return;
              const form = new FormData(event.currentTarget);
              submitting.current = true;
              setError("");
              startTransition(async () => {
                try {
                  const result = await createSaleAction(form);
                  if (result.error) setError(result.error);
                  else { setOpen(false); setSuccess(result.success ?? "Venta registrada."); router.refresh(); }
                } catch {
                  setError("No se pudo confirmar el guardado. Revisa la tabla de ventas antes de volver a intentarlo.");
                } finally { submitting.current = false; }
              });
            }}>
              <input type="hidden" name="snapshot" value={snapshot ? JSON.stringify(snapshot) : ""} />
              <fieldset disabled={pending} className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2 text-sm">Fecha<Input type="date" name="soldAt" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} required /></label>
                  <label className="grid gap-2 text-sm">Cliente (opcional)<Input name="customer" maxLength={160} value={customer} onChange={(e) => setCustomer(e.target.value)} /></label>
                  <label className="grid gap-2 text-sm">Vendedor<select className={selectClass} name="sellerId" value={sellerId} onChange={(e) => setSellerId(e.target.value)} required><option value="">Selecciona un vendedor</option>{sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                </div>
                <div className="space-y-3">
                  {rows.map((row, i) => <div key={row.key} className="grid grid-cols-2 items-end gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_85px_100px_100px_32px]">
                    <label className="col-span-2 grid gap-2 text-sm sm:col-span-1">Producto {i + 1}<select className={selectClass} name="productId" value={row.productId} onChange={(e) => updateRow(row.key, { productId: e.target.value, unitPrice: undefined })} required><option value="">Selecciona un producto</option>{products.map((p) => <option key={p.id} value={p.id} disabled={rows.some((r) => r.key !== row.key && r.productId === p.id)}>{p.name}</option>)}</select></label>
                    <label className="grid gap-2 text-sm">Cantidad<Input type="number" name="quantity" min={1} max={10000} step={1} value={row.quantity} onChange={(e) => updateRow(row.key, { quantity: e.target.value })} required /></label>
                    <label className="grid gap-2 text-sm">Precio unitario<Input type="number" name="unitPrice" min="0" max="1000000" step="0.01" required value={row.unitPrice ?? (previewItems[i].unitPriceCents / 100).toFixed(2)} onChange={(e) => updateRow(row.key, { unitPrice: e.target.value })} /></label>
                    <div className="text-sm"><p className="text-xs text-muted-foreground">Subtotal</p><p className="py-2 font-medium tabular-nums">{formatMoney(totals.lines[i].subtotal)}</p></div>
                    <Button type="button" variant="ghost" size="icon" disabled={rows.length === 1} aria-label={`Quitar producto ${i + 1}`} onClick={() => setRows(rows.filter((r) => r.key !== row.key))}><Trash2 /></Button>
                  </div>)}
                  <Button type="button" variant="outline" disabled={rows.length >= Math.min(products.length, 100)} onClick={() => setRows([...rows, { key: nextKey.current++, productId: "", quantity: "1" }])}><Plus />Agregar producto</Button>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="paidByCard" checked={paidByCard} onChange={(e) => setPaidByCard(e.target.checked)} />Pago con tarjeta</label>
                  {paidByCard && <label className="flex items-center gap-2 text-sm">Comisión de tarjeta (%)<Input className="w-24" type="number" name="cardRate" min={0} max={100} step="0.01" required value={cardRate} onChange={(e) => setCardRate(e.target.value)} /></label>}
                </div>
                {missingCommission && <p role="alert" className="text-sm text-destructive">Falta configurar la comisión del vendedor para uno de los productos en Catálogos. Usa 0% si no cobra comisión.</p>}
                <dl className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4 sm:grid-cols-3">
                  {[["Subtotal", totals.subtotal], ["Producción", totals.production], ["Pago al vendedor", totals.sellerPayment], ["Comisión tarjeta", totals.cardFee], ["Costo total", totals.cost], ["Ganancia", totals.profit]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(Number(value))}</dd></div>)}
                </dl>
                <p className="text-xs text-muted-foreground">Puedes ajustar el precio unitario para esta venta sin cambiar el catálogo. La producción incluye producto, envase y etiqueta. La comisión del vendedor corresponde a cada producto.</p>
                {error && <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-sm"><p className="text-destructive">{error}</p><Button type="button" variant="outline" onClick={() => { router.refresh(); setError(""); }}>Actualizar catálogo</Button></div>}
              </fieldset>
              <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-5 py-4">
                <Dialog.Close disabled={pending} className={buttonVariants({ variant: "outline" })}>Cancelar</Dialog.Close>
                <Button type="submit" disabled={pending || !snapshot || missingCommission}>{pending ? "Guardando…" : "Guardar venta"}</Button>
              </div>
            </form>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  </div>;
}
