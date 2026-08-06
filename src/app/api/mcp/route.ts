import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAgentToken } from "@/lib/agent-tokens";
import { hashPassword } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTotpSecret } from "@/lib/totp";

const createExpenseSchema = z.object({
  amount: z.union([z.number(), z.string()]),
  category: z.string().trim().min(1).default("General"),
  description: z.string().trim().min(1),
  paymentMethod: z.string().trim().optional().nullable(),
  spentAt: z.string().trim().optional(),
  userEmail: z.string().trim().email().optional(),
  vendor: z.string().trim().optional().nullable(),
});

const createAdminSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().max(80).optional().nullable(),
  password: z.string().min(8),
});

function jsonRpc(id: unknown, result: unknown, status = 200) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { status });
}

function jsonRpcError(id: unknown, code: number, message: string, status = 400) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status },
  );
}

function toolText(text: string) {
  return {
    content: [{ type: "text", text }],
  };
}

async function createExpense(argumentsValue: unknown, fallbackUserId: string) {
  const input = createExpenseSchema.parse(argumentsValue);
  const amountCents = parseMoneyToCents(String(input.amount));

  if (!amountCents) {
    throw new Error("Invalid expense amount");
  }

  const user = input.userEmail
    ? await prisma.user.findUnique({ where: { email: input.userEmail } })
    : null;

  if (input.userEmail && !user) {
    throw new Error(`User not found: ${input.userEmail}`);
  }

  const expense = await prisma.expense.create({
    data: {
      userId: user?.id ?? fallbackUserId,
      amountCents,
      category: input.category,
      description: input.description,
      paymentMethod: input.paymentMethod || null,
      spentAt: input.spentAt ? new Date(`${input.spentAt}T12:00:00`) : new Date(),
      vendor: input.vendor || null,
    },
  });

  return toolText(
    JSON.stringify({
      id: expense.id,
      amountCents: expense.amountCents,
      category: expense.category,
      description: expense.description,
    }),
  );
}

async function createAdmin(argumentsValue: unknown) {
  const input = createAdminSchema.parse(argumentsValue);
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });

  if (existingUser) {
    throw new Error(`User already exists: ${input.email}`);
  }

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name || null,
      role: "ADMIN",
      passwordHash: await hashPassword(input.password),
      totpSecret: createTotpSecret(),
      totpEnabled: false,
    },
  });

  return toolText(
    JSON.stringify({
      id: user.id,
      email: user.email,
      role: user.role,
      totpEnabled: user.totpEnabled,
    }),
  );
}

export async function POST(request: NextRequest) {
  let body: { id?: unknown; method?: string; params?: Record<string, unknown> };

  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  if (body.method === "initialize") {
    return jsonRpc(body.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "miel-gastos", version: "0.1.0" },
      capabilities: { tools: {} },
    });
  }

  const agentToken = await authenticateAgentToken(request.headers.get("authorization"));

  if (!agentToken) {
    return jsonRpcError(body.id, -32001, "Unauthorized", 401);
  }

  if (body.method === "tools/list") {
    return jsonRpc(body.id, {
      tools: [
        {
          name: "create_expense",
          description: "Registra un gasto del negocio de miel.",
          inputSchema: {
            type: "object",
            required: ["amount", "description"],
            properties: {
              amount: { type: ["number", "string"] },
              category: { type: "string" },
              description: { type: "string" },
              paymentMethod: { type: "string" },
              spentAt: { type: "string", description: "YYYY-MM-DD" },
              userEmail: { type: "string" },
              vendor: { type: "string" },
            },
          },
        },
        {
          name: "create_admin_user",
          description: "Crea una cuenta administradora con TOTP pendiente.",
          inputSchema: {
            type: "object",
            required: ["email", "password"],
            properties: {
              email: { type: "string" },
              name: { type: "string" },
              password: { type: "string" },
            },
          },
        },
      ],
    });
  }

  if (body.method === "tools/call") {
    const name = String(body.params?.name ?? "");
    const argumentsValue = body.params?.arguments ?? {};

    try {
      if (name === "create_expense") {
        return jsonRpc(
          body.id,
          await createExpense(argumentsValue, agentToken.createdById),
        );
      }

      if (name === "create_admin_user") {
        return jsonRpc(body.id, await createAdmin(argumentsValue));
      }
    } catch (error) {
      return jsonRpcError(
        body.id,
        -32602,
        error instanceof Error ? error.message : "Invalid tool arguments",
      );
    }

    return jsonRpcError(body.id, -32601, `Unknown tool: ${name}`, 404);
  }

  return jsonRpcError(body.id, -32601, `Unknown method: ${body.method}`, 404);
}

export async function GET() {
  return NextResponse.json({
    name: "miel-gastos",
    transport: "http",
    endpoint: "/api/mcp",
  });
}
