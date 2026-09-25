"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createSession,
  destroySession,
  hashPassword,
  requireTotpUser,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import {
  createAgentTokenValue,
  getAgentTokenPrefix,
  hashAgentToken,
} from "@/lib/agent-tokens";
import { parseMoneyToCents } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTotpSecret, verifyTotpToken } from "@/lib/totp";
import type { LoginState } from "@/lib/login-state";

const emailSchema = z.string().trim().email().toLowerCase();
const nameSchema = z.string().trim().max(80);

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireOwner() {
  const user = await requireTotpUser();

  if (user.role !== "OWNER") {
    redirect("/settings?error=owner");
  }

  return user;
}

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formString(formData, "email"));
  // Passwords are opaque: whitespace can be part of the user's password.
  const password = String(formData.get("password") ?? "");
  const totpCode = formString(formData, "totpCode").replace(/\s/g, "");
  const fields: LoginState["fields"] = {};
  if (!email.success) fields.email = "Escribe un correo electrónico válido.";
  if (!password) fields.password = "Escribe tu contraseña.";
  if (totpCode && !/^\d{6}$/.test(totpCode)) fields.totpCode = "El código debe tener 6 dígitos.";
  if (!email.success || Object.keys(fields).length) {
    return { error: "Revisa los campos señalados para continuar.", fields };
  }

  let destination: string;
  try {
    const user = await prisma.user.findUnique({ where: { email: email.data } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "El correo o la contraseña no coinciden. Revisa tus datos e inténtalo de nuevo." };
    }
    if (user.totpEnabled) {
      if (!totpCode) {
        return { error: "Falta la verificación de seguridad.", fields: { totpCode: "Abre tu app de autenticación e ingresa el código de 6 dígitos." } };
      }
      if (!user.totpSecret || !verifyTotpToken(totpCode, user.totpSecret)) {
        return { error: "No pudimos verificar tu código.", fields: { totpCode: "El código es incorrecto o ya venció. Usa el código actual de tu app." } };
      }
    }
    await createSession(user.id);
    destination = user.totpEnabled ? "/" : "/totp/setup";
  } catch {
    return { error: "No pudimos conectar con el servicio de acceso. Espera un momento e inténtalo de nuevo." };
  }
  redirect(destination);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function updateProfileAction(formData: FormData) {
  const user = await requireTotpUser();
  const email = emailSchema.parse(formString(formData, "email"));
  const name = nameSchema.parse(formString(formData, "name")) || null;

  if (email !== user.email) {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.id !== user.id) {
      redirect("/settings?error=email");
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email, name },
  });

  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/settings?updated=profile");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireTotpUser();
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    redirect("/settings?error=current-password");
  }

  if (newPassword.length < 8 || newPassword !== confirmPassword) {
    redirect("/settings?error=new-password");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.session.deleteMany({
      where: {
        userId: user.id,
        tokenHash: { not: "" },
      },
    }),
  ]);

  await createSession(user.id);
  redirect("/settings?updated=password");
}

export async function createAdminUserAction(formData: FormData) {
  await requireOwner();

  const email = emailSchema.parse(formString(formData, "adminEmail"));
  const name = nameSchema.parse(formString(formData, "adminName")) || null;
  const password = formString(formData, "adminPassword");
  const confirmPassword = formString(formData, "adminConfirmPassword");
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    redirect("/settings?error=admin-exists");
  }

  if (password.length < 8 || password !== confirmPassword) {
    redirect("/settings?error=admin-password");
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
      totpSecret: createTotpSecret(),
      totpEnabled: false,
    },
  });

  redirect(`/settings?createdAdmin=${encodeURIComponent(email)}`);
}

export async function createAgentTokenAction(
  _previousState: { token?: string; error?: string } | null,
  formData: FormData,
) {
  const user = await requireOwner();
  const name = nameSchema.parse(formString(formData, "tokenName")) || "Agente";
  const token = createAgentTokenValue();

  await prisma.agentToken.create({
    data: {
      name,
      tokenHash: hashAgentToken(token),
      tokenPrefix: getAgentTokenPrefix(token),
      createdById: user.id,
    },
  });

  revalidatePath("/settings");
  return { token };
}

export async function revokeAgentTokenAction(formData: FormData) {
  const user = await requireOwner();
  const id = formString(formData, "id");

  await prisma.agentToken.updateMany({
    where: { id, createdById: user.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings");
  redirect("/settings?updated=token-revoked");
}

export async function enableTotpAction(formData: FormData) {
  const user = await requireUser();
  const code = formString(formData, "code");

  if (!user.totpSecret || !verifyTotpToken(code, user.totpSecret)) {
    redirect("/totp/setup?error=code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  redirect("/");
}

export async function regenerateTotpAction() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpSecret: createTotpSecret(),
      totpEnabled: false,
    },
  });

  redirect("/totp/setup");
}

export async function createExpenseAction(formData: FormData) {
  const user = await requireTotpUser();
  const amountCents = parseMoneyToCents(formData.get("amount"));
  const description = formString(formData, "description");
  const category = formString(formData, "category") || "General";
  const vendor = formString(formData, "vendor") || null;
  const paymentMethod = formString(formData, "paymentMethod") || null;
  const spentAtInput = formString(formData, "spentAt");

  if (!amountCents || !description || !spentAtInput) {
    redirect("/?error=expense");
  }

  await prisma.expense.create({
    data: {
      userId: user.id,
      amountCents,
      description,
      category,
      vendor,
      paymentMethod,
      spentAt: new Date(`${spentAtInput}T12:00:00`),
    },
  });

  revalidatePath("/");
  redirect("/");
}

export async function deleteExpenseAction(formData: FormData) {
  await requireTotpUser();
  const id = formString(formData, "id");

  await prisma.expense.deleteMany({
    where: {
      id,
    },
  });

  revalidatePath("/");
  redirect("/");
}
