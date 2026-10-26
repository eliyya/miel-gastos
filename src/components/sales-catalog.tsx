'use client'

import { Package, Users } from 'lucide-react'
import { useActionState, useState } from 'react'

import { saveProductAction, saveSellerAction } from '@/app/sales/actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { isInputEdited, RetornableInput } from '@/components/ui/retornable-input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { CatalogProduct, CatalogSeller, CatalogUser, SalesFormState } from '@/lib/sales'

function Feedback({ state }: { state: SalesFormState }) {
    return (
        <>
            {state.error && (
                <p role="alert" className="text-sm text-destructive">
                    {state.error}
                </p>
            )}
            {state.success && (
                <p role="status" className="text-sm text-emerald-700">
                    {state.success}
                </p>
            )}
        </>
    )
}

function ProductForm({ product }: { product?: CatalogProduct }) {
    const original = {
        name: product?.name ?? '',
        price: product ? (product.priceCents / 100).toFixed(2) : '',
        cost: product ? (product.costCents / 100).toFixed(2) : '',
        active: product?.active ?? true,
    }
    const [values, setValues] = useState(original)
    const [state, action, pending] = useActionState(
        async (previous: SalesFormState, form: FormData) => {
            const result = await saveProductAction(previous, form)
            if (result.success && !product) setValues(original)
            return result
        },
        {},
    )
    const hasChanges =
        !product ||
        isInputEdited(values.name, original.name) ||
        isInputEdited(values.price, original.price, 'number') ||
        isInputEdited(values.cost, original.cost, 'number') ||
        values.active !== original.active

    return (
        <form
            action={action}
            className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
            onSubmit={event => {
                if (pending || !hasChanges) event.preventDefault()
            }}
        >
            <input type="hidden" name="id" value={product?.id ?? ''} />
            {product && (
                <p className="text-xs text-muted-foreground">
                    ID del producto:{' '}
                    <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                        {product.id}
                    </code>
                </p>
            )}
            <fieldset disabled={pending} className="space-y-3">
                <div className="grid items-end gap-3 lg:grid-cols-2">
                    <RetornableInput
                        label="Nombre"
                        name="name"
                        value={values.name}
                        originalValue={product ? original.name : undefined}
                        onValueChange={name => setValues(current => ({ ...current, name }))}
                        maxLength={120}
                        required
                    />
                    <div
                        className="grid items-end gap-3"
                        style={{
                            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 12rem), 1fr))',
                        }}
                    >
                        <RetornableInput
                            label="Precio (MXN)"
                            type="number"
                            name="price"
                            min="0.01"
                            max="1000000"
                            step="0.01"
                            value={values.price}
                            originalValue={product ? original.price : undefined}
                            onValueChange={price => setValues(current => ({ ...current, price }))}
                            required
                        />
                        <RetornableInput
                            label="Costo de producción (MXN)"
                            type="number"
                            name="cost"
                            min="0"
                            max="1000000"
                            step="0.01"
                            value={values.cost}
                            originalValue={product ? original.cost : undefined}
                            onValueChange={cost => setValues(current => ({ ...current, cost }))}
                            required
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <Switch
                            name="active"
                            checked={values.active}
                            onCheckedChange={active =>
                                setValues(current => ({ ...current, active }))
                            }
                        />
                        Disponible para nuevas ventas
                    </label>
                    <Button type="submit" disabled={pending || !hasChanges}>
                        {pending ? 'Guardando…' : product ? 'Guardar producto' : 'Agregar producto'}
                    </Button>
                </div>
            </fieldset>
            <Feedback state={state} />
        </form>
    )
}

function SellerForm({
    seller,
    products,
    users,
    sellers,
}: {
    seller?: CatalogSeller
    products: CatalogProduct[]
    users: CatalogUser[]
    sellers: CatalogSeller[]
}) {
    const original = {
        name: seller?.name ?? '',
        userId: seller?.userId ?? '',
        active: seller?.active ?? true,
        commissions: Object.fromEntries(
            products.map(product => {
                const commission = seller?.commissions.find(c => c.productId === product.id)
                return [product.id, commission ? (commission.rateBps / 100).toFixed(2) : '']
            }),
        ),
    }
    const [values, setValues] = useState(original)
    const [state, action, pending] = useActionState(
        async (previous: SalesFormState, form: FormData) => {
            const result = await saveSellerAction(previous, form)
            if (result.success && !seller) setValues(original)
            return result
        },
        {},
    )
    const hasChanges =
        !seller ||
        isInputEdited(values.name, original.name) ||
        values.userId !== original.userId ||
        values.active !== original.active ||
        products.some(product =>
            isInputEdited(
                values.commissions[product.id] ?? original.commissions[product.id],
                original.commissions[product.id],
                'number',
            ),
        )

    return (
        <form
            action={action}
            className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
            onSubmit={event => {
                if (pending || !hasChanges) event.preventDefault()
            }}
        >
            <input type="hidden" name="id" value={seller?.id ?? ''} />
            {seller && (
                <p className="text-xs text-muted-foreground">
                    ID del vendedor:{' '}
                    <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                        {seller.id}
                    </code>
                </p>
            )}
            <fieldset disabled={pending} className="space-y-4">
                <RetornableInput
                    label="Nombre del vendedor"
                    name="name"
                    value={values.name}
                    originalValue={seller ? original.name : undefined}
                    onValueChange={name => setValues(current => ({ ...current, name }))}
                    maxLength={120}
                    required
                />
                <label className="grid gap-2 text-sm">
                    Usuario asociado (opcional)
                    <NativeSelect
                        name="userId"
                        value={values.userId}
                        onChange={event =>
                            setValues(current => ({ ...current, userId: event.target.value }))
                        }
                    >
                        <option value="">Sin usuario asociado</option>
                        {users.map(user => (
                            <option
                                key={user.id}
                                value={user.id}
                                disabled={sellers.some(
                                    other => other.id !== seller?.id && other.userId === user.id,
                                )}
                            >
                                {user.name ? `${user.name} · ${user.email}` : user.email}
                            </option>
                        ))}
                    </NativeSelect>
                </label>
                <p className="text-xs text-muted-foreground">
                    Al registrar una venta, este vendedor se seleccionará por defecto para el
                    usuario asociado. El usuario podrá elegir otro vendedor. Cada usuario puede
                    asociarse a un solo vendedor.
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {products.map(product => (
                        <RetornableInput
                            key={product.id}
                            label={`${product.name}${!product.active ? ' (inactivo)' : ''} · comisión (%)`}
                            type="number"
                            name={`commission:${product.id}`}
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="Sin configurar"
                            value={
                                values.commissions[product.id] ?? original.commissions[product.id]
                            }
                            originalValue={seller ? original.commissions[product.id] : undefined}
                            onValueChange={value =>
                                setValues(current => ({
                                    ...current,
                                    commissions: { ...current.commissions, [product.id]: value },
                                }))
                            }
                        />
                    ))}
                </div>
                <p className="text-xs text-muted-foreground">
                    Escribe 0 si no cobra comisión. Un campo vacío impide vender ese producto con
                    este vendedor.
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <Switch
                            name="active"
                            checked={values.active}
                            onCheckedChange={active =>
                                setValues(current => ({ ...current, active }))
                            }
                        />
                        Disponible para nuevas ventas
                    </label>
                    <Button type="submit" disabled={pending || !hasChanges}>
                        {pending ? 'Guardando…' : seller ? 'Guardar vendedor' : 'Agregar vendedor'}
                    </Button>
                </div>
            </fieldset>
            <Feedback state={state} />
        </form>
    )
}

export function SalesCatalog({
    products,
    sellers,
    users,
}: {
    products: CatalogProduct[]
    sellers: CatalogSeller[]
    users: CatalogUser[]
}) {
    return (
        <Tabs defaultValue="products">
            <TabsList aria-label="Catálogos de ventas">
                <TabsTrigger value="products">
                    <Package className="size-4" />
                    Productos <Badge variant="secondary">{products.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="sellers">
                    <Users className="size-4" />
                    Vendedores <Badge variant="secondary">{sellers.length}</Badge>
                </TabsTrigger>
            </TabsList>
            <TabsContent value="products">
                <Card>
                    <CardHeader>
                        <CardTitle>Productos de nuestra miel</CardTitle>
                        <CardDescription>
                            El costo unitario incluye el producto, su envase y su etiqueta.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <details
                            className="rounded-xl border border-dashed bg-secondary/30 p-4"
                            open={!products.length}
                        >
                            <summary className="font-medium">Agregar producto</summary>
                            <div className="mt-4">
                                <ProductForm />
                            </div>
                        </details>
                        {products.map(product => (
                            <ProductForm key={JSON.stringify(product)} product={product} />
                        ))}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="sellers">
                <Card>
                    <CardHeader>
                        <CardTitle>El equipo detrás de cada venta</CardTitle>
                        <CardDescription>
                            Administra vendedores y define su comisión por producto.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <details
                            className="rounded-xl border border-dashed bg-secondary/30 p-4"
                            open={!sellers.length}
                        >
                            <summary className="font-medium">Agregar vendedor</summary>
                            <div className="mt-4">
                                <SellerForm products={products} users={users} sellers={sellers} />
                            </div>
                        </details>
                        {sellers.map(seller => (
                            <SellerForm
                                key={JSON.stringify(seller)}
                                seller={seller}
                                products={products}
                                users={users}
                                sellers={sellers}
                            />
                        ))}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
