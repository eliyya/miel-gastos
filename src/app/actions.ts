"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  createSession,
  destroySession,
  requireTotpUser,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTotpSecret, verifyTotpToken } from "@/lib/totp";

const emailSchema = z.string().trim().email().toLowerCase();

function formString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
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
  const user = await requireTotpUser();
  const id = formString(formData, "id");

  await prisma.expense.deleteMany({
    where: {
      id,
      userId: user.id,
    },
  });

  revalidatePath("/");
  redirect("/");
}
