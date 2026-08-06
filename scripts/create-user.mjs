import "dotenv/config";

import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { generateSecret } from "otplib";
import pg from "pg";

const { Client } = pg;

const [, , emailArg, passwordArg, roleArg = "ADMIN", ...nameParts] = process.argv;
const email = emailArg?.trim().toLowerCase();
const password = passwordArg ?? "";
const role = roleArg.trim().toUpperCase();
const name = nameParts.join(" ").trim() || null;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

if (!email || !email.includes("@")) {
  throw new Error('Usage: pnpm user:create email@example.com password ADMIN "Name"');
}

if (password.length < 8) {
  throw new Error("Password must be at least 8 characters");
}

if (!["OWNER", "ADMIN"].includes(role)) {
  throw new Error("Role must be OWNER or ADMIN");
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const existingUser = await client.query(
    'select id from "User" where email = $1 limit 1',
    [email],
  );

  if (existingUser.rows[0]) {
    throw new Error(`User already exists: ${email}`);
  }

  const userId = randomUUID();
  const passwordHash = await hash(password, 12);

  await client.query(
    `insert into "User"
      (id, email, name, role, "passwordHash", "totpSecret", "totpEnabled", "createdAt", "updatedAt")
     values ($1, $2, $3, $4::"UserRole", $5, $6, false, now(), now())`,
    [userId, email, name, role, passwordHash, generateSecret()],
  );

  console.log(
    JSON.stringify(
      {
        email,
        name,
        role,
        created: true,
        totpEnabled: false,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
