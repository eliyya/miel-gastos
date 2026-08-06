import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_PREFIX = "miel_agent";
const TOKEN_BYTES = 32;

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAgentTokenValue() {
  return `${TOKEN_PREFIX}_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function getAgentTokenPrefix(token: string) {
  return token.slice(0, 18);
}

export async function authenticateAgentToken(authorization: string | null) {
  const [scheme, token] = authorization?.split(/\s+/, 2) ?? [];

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  const agentToken = await prisma.agentToken.findUnique({
    where: { tokenHash: hashAgentToken(token) },
    include: { createdBy: true },
  });

  if (!agentToken || agentToken.revokedAt) {
    return null;
  }

  await prisma.agentToken.update({
    where: { id: agentToken.id },
    data: { lastUsedAt: new Date() },
  });

  return agentToken;
}
