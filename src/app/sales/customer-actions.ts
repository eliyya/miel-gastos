"use server";

import { requireTotpUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getSaleCustomers(): Promise<string[]> {
  await requireTotpUser();
  const customers = await prisma.sale.groupBy({
    by: ["customer"],
    where: { customer: { not: null } },
    orderBy: { customer: "asc" },
  });
  return customers.flatMap(({ customer }) => customer?.trim() ? [customer.trim()] : []);
}
