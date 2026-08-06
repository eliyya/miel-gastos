import "dotenv/config";

import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generateSecret } from "otplib";
import pg from "pg";

const { Client } = pg;

const ownerEmail = process.env.APP_OWNER_EMAIL || "eli@local.test";
const ownerName = process.env.APP_OWNER_NAME || "Eli";
const ownerPassword = process.env.APP_OWNER_PASSWORD || "change-me-12345";
const ownerRole = "OWNER";

const expense = {
  amountCents: 6000,
  currency: "MXN",
  spentAt: "2026-07-29T12:00:00.000",
  category: "Envases",
  vendor: "Botellas",
  description: "20 botellas para miel (20 x $3.00)",
  paymentMethod: null,
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin");

  const existingUser = await client.query(
    'select id, "totpSecret" from "User" where email = $1 limit 1',
    [ownerEmail],
  );

  let userId = existingUser.rows[0]?.id;

  if (!userId) {
    userId = randomUUID();
    const passwordHash = await hash(ownerPassword, 12);

    await client.query(
      `insert into "User"
        (id, email, name, role, "passwordHash", "totpSecret", "totpEnabled", "createdAt", "updatedAt")
       values ($1, $2, $3, $4::"UserRole", $5, $6, false, now(), now())`,
      [userId, ownerEmail, ownerName, ownerRole, passwordHash, generateSecret()],
    );
  } else {
    await client.query(
      'update "User" set role = $1::"UserRole", "updatedAt" = now() where id = $2',
      [ownerRole, userId],
    );
  }

  if (existingUser.rows[0] && !existingUser.rows[0].totpSecret) {
    await client.query(
      'update "User" set "totpSecret" = $1, "updatedAt" = now() where id = $2',
      [generateSecret(), userId],
    );
  }

  const existingExpense = await client.query(
    `select id from "Expense"
     where "userId" = $1
       and "amountCents" = $2
       and category = $3
       and description = $4
       and "spentAt" = $5::timestamp
     limit 1`,
    [
      userId,
      expense.amountCents,
      expense.category,
      expense.description,
      expense.spentAt,
    ],
  );

  let expenseId = existingExpense.rows[0]?.id;

  if (!expenseId) {
    expenseId = randomUUID();

    await client.query(
      `insert into "Expense"
        (id, "userId", "amountCents", currency, "spentAt", category, vendor, description, "paymentMethod", "createdAt", "updatedAt")
       values ($1, $2, $3, $4, $5::timestamp, $6, $7, $8, $9, now(), now())`,
      [
        expenseId,
        userId,
        expense.amountCents,
        expense.currency,
        expense.spentAt,
        expense.category,
        expense.vendor,
        expense.description,
        expense.paymentMethod,
      ],
    );
  }

  await client.query("commit");

  console.log(
    JSON.stringify(
      {
        ownerEmail,
        userCreated: !existingUser.rows[0],
        expenseId,
        expenseCreated: !existingExpense.rows[0],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
