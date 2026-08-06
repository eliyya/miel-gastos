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

export async function loginAction(formData: FormData) {
  const email = emailSchema.parse(formString(formData, "email"));
  const password = formString(formData, "password");
  const totpCode = formString(formData, "totpCode");

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=credentials");
  }

  if (user.totpEnabled) {
    if (!user.totpSecret || !verifyTotpToken(totpCode, user.totpSecret)) {
      redirect("/login?error=totp");
    }
  }

  await createSession(user.id);
  redirect(user.totpEnabled ? "/" : "/totp/setup");
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
