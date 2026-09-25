import { AppShell } from "@/components/app-shell";
import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesCatalog } from "@/components/sales-catalog";

export default async function CatalogPage() {
  const user = await requireTotpUser();
  const [products, sellers] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.seller.findMany({ include: { commissions: true }, orderBy: { name: "asc" } }),
  ]);
  return <AppShell user={user} title="Lo que hace posible cada venta" eyebrow="La libreta · Catálogos" description="Organiza tus productos, vendedores y comisiones. Los cambios se aplican a ventas nuevas; tu historial se conserva."><SalesCatalog products={products} sellers={sellers} /></AppShell>;
}
