"use server";

import { revalidatePath } from "next/cache";
import { requireTotpUser } from "@/lib/auth";
import { generateEasystoreWebhookSecret, setEasystoreWebhookEnabled } from "@/lib/easystore-settings";

export async function updateEasystoreWebhookAction(formData: FormData): Promise<{ error?: string; secret?: string; success?: string }> {
  const user = await requireTotpUser();
  if (user.role !== "OWNER") return { error: "Solo el owner puede administrar el webhook." };

  const operation = formData.get("operation");
  if (!["generate", "rotate", "enable", "disable"].includes(String(operation))) {
    return { error: "Operación no válida." };
  }
  const expectedVersion = formData.get("secretVersion");
  if (operation === "rotate" && (
    typeof expectedVersion !== "string" ||
    !Number.isFinite(Date.parse(expectedVersion)) ||
    new Date(expectedVersion).toISOString() !== expectedVersion
  )) {
    return { error: "Recarga la página y confirma la regeneración del secreto actual." };
  }
  let secret: string | undefined;
  try {
    if (operation === "generate" || operation === "rotate") {
      const generatedSecret = await generateEasystoreWebhookSecret(operation === "rotate" ? expectedVersion as string : null);
      if (!generatedSecret) {
        revalidatePath("/settings");
        return { error: "El secreto cambió en otra pestaña o sesión. Revisa el estado actualizado y confirma la regeneración si deseas reemplazarlo." };
      }
      secret = generatedSecret;
    } else if (!(await setEasystoreWebhookEnabled(operation === "enable"))) {
      return { error: "Genera un secreto antes de activar el webhook." };
    }
  } catch {
    // Prisma errors can contain query arguments: never log or return them.
    return { error: "No se pudo actualizar el webhook. Revisa la configuración del servidor e inténtalo de nuevo." };
  }
  revalidatePath("/settings");
  return secret ? { secret } : { success: operation === "enable" ? "Webhook activado." : "Webhook desactivado." };
}
