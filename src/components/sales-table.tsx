"use client";

import { EmptyState } from "@/components/empty-state";
import { Fragment, useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calculateSale, type SaleLine } from "@/lib/sales";
import { formatMoney } from "@/lib/format";

import { useRouter } from "next/navigation";
import { deleteSaleAction } from "@/app/sales/actions";
import { useAsyncConfirm } from "@/components/async-confirm";
import { Button } from "@/components/ui/button";

type SaleRow = { id: string; soldAt: string; customer: string | null; sellerName: string; paidByCard: boolean; cardRateBps: number; items: (SaleLine & { id: string; productName: string })[] };

export function SalesTable({ sales }: { sales: SaleRow[] }) {
  const router = useRouter();
  const { confirm, modal } = useAsyncConfirm();
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  function toggle(id: string) {
    setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  if (!sales.length) return <EmptyState title="Cada frasco tiene una historia" description="Registra tu primera venta para ver aquí sus productos, costos y ganancias." />;
  return <>{modal}{message && <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}<Table>
    <TableHeader><TableRow>{["", "Fecha", "Cliente", "Vendedor", "Subtotal", "Pago vendedor", "Tarjeta", "Producción", "Costo", "Ganancia", "Acciones"].map((label, i) => <TableHead key={i} className={i >= 4 ? "text-right" : ""}>{label}</TableHead>)}</TableRow></TableHeader>
    <TableBody>{sales.map((sale) => {
      const totals = calculateSale(sale.items, sale.cardRateBps);
      const open = expanded.has(sale.id);
      const date = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(sale.soldAt));
      return <Fragment key={sale.id}>
        <TableRow className="cursor-pointer" onClick={() => toggle(sale.id)}>
          <TableCell><button type="button" className="rounded p-1 focus-visible:outline-2" aria-label={`${open ? "Ocultar" : "Ver"} productos de la venta del ${date}${sale.customer ? ` a ${sale.customer}` : ""}`} aria-expanded={open} aria-controls={`detail-${sale.id}`} onClick={(e) => { e.stopPropagation(); toggle(sale.id); }}><ChevronRight className={`size-4 transition-transform ${open ? "rotate-90" : ""}`} /></button></TableCell>
          <TableCell>{date}</TableCell><TableCell>{sale.customer || "—"}</TableCell><TableCell>{sale.sellerName}</TableCell>
          <TableCell className="text-right tabular-nums">{formatMoney(totals.subtotal)}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(totals.sellerPayment)}</TableCell>
          <TableCell className="text-right tabular-nums">{formatMoney(totals.cardFee)}<div className="text-xs text-muted-foreground">{sale.paidByCard ? `${sale.cardRateBps / 100}%` : "Sin tarjeta"}</div></TableCell>
          <TableCell className="text-right tabular-nums">{formatMoney(totals.production)}</TableCell><TableCell className="text-right tabular-nums">{formatMoney(totals.cost)}</TableCell><TableCell className={`text-right font-semibold tabular-nums ${totals.profit < 0 ? "text-destructive" : "text-emerald-700"}`}>{formatMoney(totals.profit)}</TableCell>
          <TableCell><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar venta del ${date}`} onClick={async (event) => {
            event.stopPropagation();
            const deleted = await confirm({
              title: "Eliminar venta",
              description: `Se eliminará la venta del ${date}${sale.customer ? ` a ${sale.customer}` : ""}, de ${sale.sellerName}, por ${formatMoney(totals.subtotal)}, junto con sus productos. Esta acción no se puede deshacer.`,
              confirmLabel: "Eliminar venta",
              onConfirm: async () => {
                try {
                  const result = await deleteSaleAction(sale.id);
                  if (result.error) throw new Error(result.error);
                } catch { throw new Error("No se pudo confirmar la eliminación. Puedes volver a intentarlo."); }
              },
            });
            if (deleted) { setMessage("Venta eliminada correctamente."); router.refresh(); }
          }}><Trash2 /></Button></TableCell>
        </TableRow>
        <TableRow id={`detail-${sale.id}`} hidden={!open} className="bg-muted/30 hover:bg-muted/30"><TableCell colSpan={11} className="px-6 py-4">
          {open && <Table><TableHeader><TableRow>{["Producto", "Cantidad", "Precio unitario", "Subtotal", "Costo unitario", "Producción", "Comisión", "Pago vendedor"].map((label, i) => <TableHead key={label} className={i ? "text-right" : ""}>{label}</TableHead>)}</TableRow></TableHeader><TableBody>{sale.items.map((item, i) => <TableRow key={item.id}><TableCell>{item.productName}</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{formatMoney(item.unitPriceCents)}</TableCell><TableCell className="text-right">{formatMoney(totals.lines[i].subtotal)}</TableCell><TableCell className="text-right">{formatMoney(item.unitCostCents)}</TableCell><TableCell className="text-right">{formatMoney(totals.lines[i].production)}</TableCell><TableCell className="text-right">{item.commissionBps / 100}%</TableCell><TableCell className="text-right">{formatMoney(totals.lines[i].sellerPayment)}</TableCell></TableRow>)}</TableBody></Table>}
        </TableCell></TableRow>
      </Fragment>;
    })}</TableBody>
  </Table></>;
}
