import { AppShell } from '@/components/app-shell'
import { SalesCatalog } from '@/components/sales-catalog'
import { requireTotpUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function CatalogPage() {
    await requireTotpUser()
    const [products, sellers, users] = await Promise.all([
        prisma.product.findMany({ orderBy: { name: 'asc' } }),
        prisma.seller.findMany({ include: { commissions: true }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({
            select: { id: true, name: true, email: true },
            orderBy: { email: 'asc' },
        }),
    ])
    return (
        <AppShell
            title="Lo que hace posible cada venta"
            eyebrow="La libreta · Catálogos"
            description="Organiza tus productos, vendedores y comisiones. Los cambios se aplican a ventas nuevas; tu historial se conserva."
        >
            <SalesCatalog products={products} sellers={sellers} users={users} />
        </AppShell>
    )
}
