"use client";

import { useActionState } from "react";
import { saveProductAction, saveSellerAction } from "@/app/sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogProduct, CatalogSeller, SalesFormState } from "@/lib/sales";

function Feedback({ state }: { state: SalesFormState }) {
  return <>{state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}{state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}</>;
}

function ProductForm({ product }: { product?: CatalogProduct }) {
  const [state, action, pending] = useActionState(saveProductAction, {});
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <input type="hidden" name="id" value={product?.id ?? ""} />
    <fieldset disabled={pending} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="grid gap-2 text-sm">Nombre<Input name="name" defaultValue={product?.name} maxLength={120} required /></label>
        <label className="grid gap-2 text-sm">Precio (MXN)<Input type="number" name="price" min="0.01" max="1000000" step="0.01" defaultValue={product ? (product.priceCents / 100).toFixed(2) : ""} required /></label>
        <label className="grid gap-2 text-sm">Costo de producción (MXN)<Input type="number" name="cost" min="0" max="1000000" step="0.01" defaultValue={product ? (product.costCents / 100).toFixed(2) : ""} required /></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={product?.active ?? true} />Disponible para nuevas ventas</label><Button type="submit" disabled={pending}>{pending ? "Guardando…" : product ? "Guardar producto" : "Agregar producto"}</Button></div>
    </fieldset><Feedback state={state} />
  </form>;
}

function SellerForm({ seller, products }: { seller?: CatalogSeller; products: CatalogProduct[] }) {
  const [state, action, pending] = useActionState(saveSellerAction, {});
  return <form action={action} className="space-y-3 rounded-lg border p-4">
    <input type="hidden" name="id" value={seller?.id ?? ""} />
    <fieldset disabled={pending} className="space-y-4">
      <label className="grid gap-2 text-sm">Nombre del vendedor<Input name="name" defaultValue={seller?.name} maxLength={120} required /></label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map((product) => {
        const commission = seller?.commissions.find((c) => c.productId === product.id);
        return <label key={product.id} className="grid gap-2 text-sm">{product.name}{!product.active ? " (inactivo)" : ""} · comisión (%)<Input type="number" name={`commission:${product.id}`} min="0" max="100" step="0.01" placeholder="Sin configurar" defaultValue={commission ? (commission.rateBps / 100).toFixed(2) : ""} /></label>;
      })}</div>
      <p className="text-xs text-muted-foreground">Escribe 0 si no cobra comisión. Un campo vacío impide vender ese producto con este vendedor.</p>
      <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={seller?.active ?? true} />Disponible para nuevas ventas</label><Button type="submit" disabled={pending}>{pending ? "Guardando…" : seller ? "Guardar vendedor" : "Agregar vendedor"}</Button></div>
    </fieldset><Feedback state={state} />
  </form>;
}

export function SalesCatalog({ products, sellers }: { products: CatalogProduct[]; sellers: CatalogSeller[] }) {
  return <div className="space-y-8">
    <section className="space-y-3"><div><h2 className="text-xl font-semibold">Productos</h2><p className="text-sm text-muted-foreground">El costo unitario incluye el producto, su envase y su etiqueta.</p></div><details className="rounded-lg border p-4" open={!products.length}><summary className="cursor-pointer font-medium">Agregar producto</summary><div className="mt-4"><ProductForm /></div></details>{products.map((product) => <ProductForm key={`${product.id}:${product.name}:${product.priceCents}:${product.costCents}:${product.active}`} product={product} />)}</section>
    <section className="space-y-3"><div><h2 className="text-xl font-semibold">Vendedores y comisiones</h2><p className="text-sm text-muted-foreground">Define el porcentaje sobre el subtotal de cada producto.</p></div><details className="rounded-lg border p-4" open={!sellers.length}><summary className="cursor-pointer font-medium">Agregar vendedor</summary><div className="mt-4"><SellerForm products={products} /></div></details>{sellers.map((seller) => <SellerForm key={JSON.stringify(seller)} seller={seller} products={products} />)}</section>
  </div>;
}
