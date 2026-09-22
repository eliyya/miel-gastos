"use server";

import { revalidatePath } from "next/cache";

import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateSale, parseHundredths, parseSaleInput, saleSnapshot, type SalesFormState } from "@/lib/sales";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function createSaleAction(form: FormData): Promise<SalesFormState> {
  const user = await requireTotpUser();
  const input = parseSaleInput(form);
  if (!input) return { error: "Revisa la fecha, el vendedor, la tasa de tarjeta y las cantidades. No repitas productos." };

  const result = await prisma.$transaction(async (tx) => {
    const seller = await tx.seller.findUnique({ where: { id: input.sellerId }, include: { commissions: true } });
    const products = await tx.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) }, active: true } });
    if (!seller?.active) return { error: "El vendedor ya no está disponible. Actualiza el catálogo y revisa la venta." };
    const snapshot = saleSnapshot(products, seller, input.items);
    if (!snapshot) return { error: "Revisa que los productos estén activos y que el vendedor tenga una comisión configurada para cada uno (0% si no cobra)." };
    if (text(form, "snapshot") !== JSON.stringify(snapshot)) {
      return { error: "Cambió un precio, costo o comisión. Actualiza el catálogo y revisa los importes antes de guardar." };
    }
    const totals = calculateSale(snapshot.items, input.cardRateBps);
    if (totals.subtotal > 2_000_000_000 || totals.cost > 2_000_000_000) return { error: "El importe de la venta supera el límite permitido." };
    await tx.sale.create({ data: {
      userId: user.id, soldAt: new Date(`${input.soldAt}T00:00:00.000Z`), customer: input.customer,
      sellerId: seller.id, sellerName: snapshot.sellerName, paidByCard: input.paidByCard,
      cardRateBps: input.cardRateBps, items: { create: snapshot.items },
    } });
    return { success: "Venta registrada correctamente." };
  }, { isolationLevel: "RepeatableRead" });
  if (result.success) revalidatePath("/sales");
  return result;
}

export async function saveProductAction(_: SalesFormState, form: FormData): Promise<SalesFormState> {
  await requireTotpUser();
  const id = text(form, "id");
  const name = text(form, "name");
  const priceCents = parseHundredths(form.get("price"));
  const costCents = parseHundredths(form.get("cost"));
  if (!name || name.length > 120 || priceCents === null || priceCents <= 0 || costCents === null) {
    return { error: "Revisa el nombre, el precio (mayor a cero) y el costo. Usa hasta dos decimales." };
  }
  const data = { name, priceCents, costCents, active: form.get("active") === "on" };
  if (id) {
    const result = await prisma.product.updateMany({ where: { id }, data });
    if (!result.count) return { error: "El producto ya no existe." };
  } else {
    await prisma.product.create({ data });
  }
  revalidatePath("/sales/catalog");
  revalidatePath("/sales");
  return { success: "Producto guardado. Las ventas anteriores conservan sus valores." };
}

export async function saveSellerAction(_: SalesFormState, form: FormData): Promise<SalesFormState> {
  await requireTotpUser();
  const id = text(form, "id");
  const name = text(form, "name");
  if (!name || name.length > 120) return { error: "Escribe un nombre de hasta 120 caracteres." };
  const products = await prisma.product.findMany({ select: { id: true } });
  const commissions: { productId: string; rateBps: number }[] = [];
  for (const product of products) {
    const value = text(form, `commission:${product.id}`);
    // An empty rate means unconfigured, never an implicit zero commission.
    if (!value) continue;
    const rateBps = parseHundredths(value, 10_000);
    if (rateBps === null) return { error: "Las comisiones deben estar entre 0 y 100%, con hasta dos decimales." };
    commissions.push({ productId: product.id, rateBps });
  }
  await prisma.$transaction(async (tx) => {
    const seller = id
      ? await tx.seller.update({ where: { id }, data: { name, active: form.get("active") === "on" } })
      : await tx.seller.create({ data: { name, active: form.get("active") === "on" } });
    // Only replace fields actually present in this form; preserve concurrently added products.
    const submittedIds = products.filter((p) => form.has(`commission:${p.id}`)).map((p) => p.id);
    await tx.sellerCommission.deleteMany({ where: { sellerId: seller.id, productId: { in: submittedIds } } });
    await tx.sellerCommission.createMany({ data: commissions.map((c) => ({ ...c, sellerId: seller.id })) });
  });
  revalidatePath("/sales/catalog");
  revalidatePath("/sales");
  return { success: "Vendedor y comisiones guardados." };
}
