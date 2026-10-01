import { createHmac, timingSafeEqual } from "node:crypto";

import {
  saleCompletedWebhookSchema,
  type SaleCompletedWebhookPayload,
} from "@oasiscode/easystore";

export const EASYSTORE_EVENT_TYPE = "sale.completed" as const;
export const EASYSTORE_WEBHOOK_MAX_BODY_BYTES = 1_000_000;
export const EASYSTORE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;
export const MAX_IMPORTED_SALE_CENTS = 2_000_000_000;

export const easystoreSaleCompletedEventSchema = saleCompletedWebhookSchema;

export type EasystoreSaleCompletedEvent = SaleCompletedWebhookPayload;

export function parseEasystoreSaleCompletedEvent(value: unknown) {
  return easystoreSaleCompletedEventSchema.safeParse(value);
}

export function validateEasystoreEventBounds(event: EasystoreSaleCompletedEvent) {
  if (
    event.id.length > 128 ||
    event.store.id.length > 128 ||
    event.sale.id.length > 128 ||
    event.seller.id.length > 128 ||
    (event.store.external_id?.length ?? 0) > 128 ||
    (event.seller.external_id?.length ?? 0) > 128 ||
    event.sale.payment_method.length > 80 ||
    event.seller.name.length > 120 ||
    event.items.length > 100
  ) {
    return "El evento excede los límites de texto o de partidas permitidos.";
  }

  if (
    event.items.some(
      (item) =>
        item.product_id.length > 128 ||
        (item.external_product_id?.length ?? 0) > 128 ||
        item.name.length > 120 ||
        item.quantity > 10_000,
    )
  ) {
    return "El evento contiene una partida fuera de los límites permitidos.";
  }

  return null;
}

export function createEasystoreSignature({
  secret,
  timestamp,
  rawBody,
}: {
  secret: string;
  timestamp: string;
  rawBody: string;
}) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}

export function verifyEasystoreSignature({
  secret,
  timestamp,
  signature,
  rawBody,
  now = Date.now(),
}: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now?: number;
}) {
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(now / 1000 - timestampSeconds) > EASYSTORE_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = createEasystoreSignature({ secret, timestamp, rawBody });
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function moneyToCents(value: number | string): number | null {
  if (typeof value === "string") {
    const raw = value.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
    const [whole, fraction = ""] = raw.split(".");
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
    return Number.isSafeInteger(cents) && cents <= MAX_IMPORTED_SALE_CENTS ? cents : null;
  }

  if (!Number.isFinite(value) || value < 0 || value > MAX_IMPORTED_SALE_CENTS / 100) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Math.abs(value - cents / 100) < 0.000001 ? cents : null;
}

export function mexicoDate(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function normalizeComparableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

export function isCardPaymentMethod(value: string) {
  return /card|tarjet|cr[eé]dit|d[eé]bit|terminal|visa|mastercard|amex/i.test(value);
}
