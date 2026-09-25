import "dotenv/config";

import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { generateSecret } from "otplib";
import pg from "pg";

const { Client } = pg;

if (process.argv.length > 2) {
  console.error("Usa pnpm user:create sin argumentos. Los datos se solicitan de forma interactiva.");
  process.exit(1);
}

if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error("Ejecuta pnpm user:create desde una terminal interactiva.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

let hidden = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  },
});
const prompts = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
prompts.on("SIGINT", () => {
  prompts.close();
  process.stdout.write("\nCancelado.\n");
  process.exit(130);
});

async function secret(label) {
  process.stdout.write(label);
  hidden = true;
  try {
    return await prompts.question("");
  } finally {
    hidden = false;
    process.stdout.write("\n");
  }
}

let email, name, role, password;
try {
  console.log("Crear usuario · Ctrl+C para cancelar\n");
  do {
    email = (await prompts.question("Correo: ")).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.log("Escribe un correo válido.");
      email = "";
    }
  } while (!email);
  name = (await prompts.question("Nombre (opcional): ")).trim() || null;
  do {
    role = (await prompts.question("Rol [ADMIN/OWNER] (Enter = ADMIN): ")).trim().toUpperCase() || "ADMIN";
    if (!["OWNER", "ADMIN"].includes(role)) console.log("Elige ADMIN u OWNER.");
  } while (!["OWNER", "ADMIN"].includes(role));
  while (true) {
    password = await secret("Contraseña (oculta, mínimo 8 caracteres): ");
    if (password.length < 8 || password !== password.trim()) {
      console.log("Usa al menos 8 caracteres, sin espacios al inicio ni al final.");
      continue;
    }
    if (password !== await secret("Confirma la contraseña: ")) {
      console.log("Las contraseñas no coinciden. Inténtalo de nuevo.");
      continue;
    }
    break;
  }
} finally {
  prompts.close();
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
