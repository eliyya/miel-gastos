import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { DEFAULT_CARD_RATE_BPS } from "@/lib/sales";
import {
  EASYSTORE_EVENT_TYPE,
  EASYSTORE_WEBHOOK_MAX_BODY_BYTES,
  isCardPaymentMethod,
  MAX_IMPORTED_SALE_CENTS,
  mexicoDate,
  moneyToCents,
  normalizeComparableName,
  parseEasystoreSaleCompletedEvent,
  validateEasystoreEventBounds,
  verifyEasystoreSignature,
} from "@/lib/easystore-webhook";

export const runtime = "nodejs";

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

type ImportedLineItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number;
  commissionBps: number;
};

export async function POST(request: Request) {
  const secret = process.env.EASYSTORE_WEBHOOK_SECRET?.trim();
  if (!secret) return errorResponse("El webhook de EasyStore no está configurado.", 503);

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("No se pudo leer el cuerpo del webhook.", 400);
  }

  if (Buffer.byteLength(rawBody, "utf8") > EASYSTORE_WEBHOOK_MAX_BODY_BYTES) {
    return errorResponse("El cuerpo del webhook es demasiado grande.", 413);
  }

  const eventId = request.headers.get("x-easystore-event-id")?.trim() || null;
  const eventType = request.headers.get("x-easystore-event-type")?.trim() || null;
  const signatureIsValid = verifyEasystoreSignature({
    secret,
    timestamp: request.headers.get("x-easystore-timestamp"),
    signature: request.headers.get("x-easystore-signature"),
    rawBody,
  });
  if (!signatureIsValid) return errorResponse("Firma de webhook inválida o expirada.", 401);
  if (!eventId || eventType !== EASYSTORE_EVENT_TYPE) {
    return errorResponse("Faltan encabezados del evento o el tipo no es compatible.", 422);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("El cuerpo del webhook no contiene JSON válido.", 400);
  }

  const parsed = parseEasystoreSaleCompletedEvent(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    return errorResponse(`El evento no cumple el contrato de EasyStore${path}.`, 422);
  }
  const event = parsed.data;
  const boundsError = validateEasystoreEventBounds(event);
  if (boundsError) return errorResponse(boundsError, 422);

  if (event.id !== eventId || event.type !== eventType) {
    return errorResponse("El ID o tipo del encabezado no coincide con el cuerpo.", 422);
  }

  const expectedStoreId = process.env.EASYSTORE_STORE_EXTERNAL_ID?.trim();
  if (expectedStoreId && event.store.external_id !== expectedStoreId) {
    return errorResponse("La tienda del evento no está autorizada.", 403);
  }

  if (!event.seller.external_id) {
    return errorResponse("Falta seller.external_id: debe ser el ID de un usuario de Miel Gastos.", 422);
  }
  const user = await prisma.user.findUnique({
    where: { id: event.seller.external_id },
    select: { id: true },
  });
  if (!user) return errorResponse("seller.external_id no corresponde a un usuario de Miel Gastos.", 422);

  const existing = await prisma.sale.findUnique({
    where: { externalEventId: event.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, event_id: event.id, sale_id: existing.id });
  }

  const productKeys = event.items.map((item) => item.external_product_id ?? item.product_id);
  if (new Set(productKeys).size !== productKeys.length) {
    return errorResponse("El evento contiene productos repetidos.", 422);
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productKeys } },
    select: { id: true, name: true, costCents: true },
  });
  const productsById = new Map(products.map((product) => [product.id, product]));
  const missingProduct = productKeys.find((productKey) => !productsById.has(productKey));
  if (missingProduct) {
    return errorResponse(`No existe un producto con ID ${missingProduct}. Configúralo como ID externo en EasyStore.`, 422);
  }

  const sellers = await prisma.seller.findMany({
    include: { commissions: true },
  });
  const sellerBySourceId = sellers.find((seller) => seller.id === event.seller.id);
  const matchingSellers = sellers.filter(
    (seller) => normalizeComparableName(seller.name) === normalizeComparableName(event.seller.name),
  );
  const seller = sellerBySourceId ?? (matchingSellers.length === 1 ? matchingSellers[0] : undefined);
  if (!seller) {
    return errorResponse(`No se pudo mapear al vendedor ${event.seller.name}. Usa un nombre único en el catálogo de vendedores.`, 422);
  }

  const lineItems: ImportedLineItem[] = [];
  for (const item of event.items) {
    const productKey = item.external_product_id ?? item.product_id;
    const product = productsById.get(productKey)!;
    const unitPriceCents = moneyToCents(item.unit_price);
    if (unitPriceCents === null) {
      return errorResponse(`El precio del producto ${item.name} no es válido.`, 422);
    }
    const commission = seller.commissions.find((value) => value.productId === product.id);
    if (!commission) {
      return errorResponse(`No hay comisión configurada para ${seller.name} y ${product.name}.`, 422);
    }
    lineItems.push({
      productId: product.id,
      productName: item.name,
      quantity: item.quantity,
      unitPriceCents,
      unitCostCents: product.costCents,
      commissionBps: commission.rateBps,
    });
  }

  const computedSubtotalCents = lineItems.reduce(
    (total, item) => total + item.quantity * item.unitPriceCents,
    0,
  );
  const declaredSubtotalCents = moneyToCents(event.sale.subtotal);
  const taxCents = moneyToCents(event.sale.tax);
  const declaredTotalCents = moneyToCents(event.sale.total);
  if (
    declaredSubtotalCents === null ||
    taxCents === null ||
    declaredTotalCents === null ||
    computedSubtotalCents > MAX_IMPORTED_SALE_CENTS ||
    declaredSubtotalCents !== computedSubtotalCents ||
    taxCents !== 0 ||
    declaredTotalCents !== declaredSubtotalCents + taxCents
  ) {
    return errorResponse("Los importes del evento no coinciden con sus productos o incluyen impuestos no soportados.", 422);
  }

  const soldAt = mexicoDate(event.sale.created_at);
  const createdAt = new Date(event.sale.created_at);
  const paidByCard = isCardPaymentMethod(event.sale.payment_method);
  const importedCardRateBps = paidByCard ? DEFAULT_CARD_RATE_BPS : 0;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.sale.findUnique({
          where: { externalEventId: event.id },
          select: { id: true },
        });
        if (duplicate) return { duplicate: true, saleId: duplicate.id };

        const sale = await tx.sale.create({
          data: {
            externalEventId: event.id,
            userId: user.id,
            soldAt: new Date(`${soldAt}T00:00:00.000Z`),
            customer: null,
            sellerId: seller.id,
            sellerName: event.seller.name,
            paidByCard,
            cardRateBps: importedCardRateBps,
            createdAt,
            items: { create: lineItems },
          },
          select: { id: true },
        });
        return { duplicate: false, saleId: sale.id };
      },
      { isolationLevel: "Serializable" },
    );

    if (result.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true, event_id: event.id, sale_id: result.saleId });
    }

    revalidatePath("/");
    revalidatePath("/sales");
    revalidatePath("/statistics");
    return NextResponse.json({ ok: true, duplicate: false, event_id: event.id, sale_id: result.saleId }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const duplicate = await prisma.sale.findUnique({
        where: { externalEventId: event.id },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ ok: true, duplicate: true, event_id: event.id, sale_id: duplicate.id });
      }
    }
    console.error("No se pudo registrar el webhook de EasyStore", error);
    return errorResponse("No se pudo registrar la venta.", 500);
  }
}
