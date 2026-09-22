import Link from "next/link";
import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesCatalog } from "@/components/sales-catalog";
import { buttonVariants } from "@/components/ui/button";

export default async function CatalogPage() {
  await requireTotpUser();
  const [products, sellers] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.seller.findMany({ include: { commissions: true }, orderBy: { name: "asc" } }),
  ]);
  return <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-5 sm:px-6"><header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4"><div><h1 className="text-2xl font-semibold">Catálogos de ventas</h1><p className="mt-1 text-sm text-muted-foreground">Los cambios solo se aplican a ventas nuevas. Puedes desactivar productos o vendedores sin perder su historial.</p></div><Link href="/sales" className={buttonVariants({ variant: "outline" })}>Volver a ventas</Link></header><SalesCatalog products={products} sellers={sellers} /></main>;
}
