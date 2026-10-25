import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import {
  createEasystoreSignature,
  verifyEasystoreSignature,
} from "../src/lib/easystore-webhook.ts";

const require = createRequire(import.meta.url);
function load(file, dependencies, env) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    Buffer,
    Date,
    process: { env },
    require(id) {
      if (id in dependencies) return dependencies[id];
      if (id === "node:crypto") return require(id);
      throw new Error(`Unexpected dependency: ${id}`);
    },
  });
  return exports;
}

function harness({
  role = "OWNER",
  authenticated = true,
  totpEnabled = true,
  key = Buffer.alloc(32, 7).toString("base64"),
} = {}) {
  let row = null;
  const queries = [];
  const env = { EASYSTORE_WEBHOOK_ENCRYPTION_KEY: key };
  const model = {
    async findUnique(query) {
      queries.push(query);
      return row
        ? Object.fromEntries(Object.keys(query.select).map((key) => [key, row[key]]))
        : null;
    },
    async upsert({ create, update }) {
      row = row
        ? { ...row, ...update }
        : { enabled: false, secretEncrypted: null, secretUpdatedAt: null, ...create };
      return { id: row.id };
    },
    async updateMany({ where, data }) {
      if (!row) return { count: 0 };
      if (where.secretEncrypted && !row.secretEncrypted) return { count: 0 };
      if (
        "secretUpdatedAt" in where &&
        (row.secretUpdatedAt?.getTime() ?? null) !== (where.secretUpdatedAt?.getTime() ?? null)
      )
        return { count: 0 };
      row = { ...row, ...data };
      return { count: 1 };
    },
  };
  const settings = load(
    "../src/lib/easystore-settings.ts",
    { "server-only": {}, "@/lib/prisma": { prisma: { easystoreWebhookSettings: model } } },
    env,
  );
  const actions = load(
    "../src/app/easystore-actions.ts",
    {
      "@/lib/easystore-settings": settings,
      "@/lib/auth": {
        async requireTotpUser() {
          if (!authenticated) throw new Error("redirect:/login");
          if (!totpEnabled) throw new Error("redirect:/totp/setup");
          return { role };
        },
      },
      "next/cache": { revalidatePath() {} },
    },
    env,
  );
  return {
    settings,
    queries,
    env,
    get row() {
      return row;
    },
    async action(operation, secretVersion) {
      const form = new FormData();
      form.set("operation", operation);
      if (secretVersion !== undefined) form.set("secretVersion", secretVersion);
      return actions.updateEasystoreWebhookAction(form);
    },
  };
}

test("starts disabled and cannot enable without a generated secret", async () => {
  const h = harness();
  assert.equal(
    JSON.stringify(await h.settings.getEasystoreWebhookStatus()),
    '{"enabled":false,"secretConfigured":false,"secretVersion":null}',
  );
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), null);
  assert.match((await h.action("enable")).error, /Genera un secreto/);
  assert.equal(h.row, null);
});

test("generation returns a random secret once, stores authenticated ciphertext, and status never fetches it", async () => {
  const h = harness();
  const result = await h.action("generate");
  assert.match(result.secret, /^[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(JSON.stringify(h.row), new RegExp(result.secret));
  assert.match(h.row.secretEncrypted, /^v1:/);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), null);
  const status = await h.settings.getEasystoreWebhookStatus();
  assert.equal(status.enabled, false);
  assert.equal(status.secretConfigured, true);
  assert.equal(status.secretVersion, h.row.secretUpdatedAt.toISOString());
  assert.deepEqual(Object.keys(status), ["enabled", "secretConfigured", "secretVersion"]);
  assert.deepEqual(Object.keys(h.queries.at(-1).select), ["enabled", "secretUpdatedAt"]);
  assert.equal((await h.action("enable")).secret, undefined);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), result.secret);
  assert.equal((await h.action("disable")).secret, undefined);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), null);
  assert.equal((await h.action("enable")).secret, undefined);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), result.secret);
});

test("rotation preserves activation and immediately invalidates the previous signing secret", async () => {
  const h = harness();
  const first = (await h.action("generate")).secret;
  await h.action("enable");
  const second = (
    await h.action("rotate", (await h.settings.getEasystoreWebhookStatus()).secretVersion)
  ).secret;
  assert.notEqual(first, second);
  assert.equal(h.row.enabled, true);
  const secret = await h.settings.getActiveEasystoreWebhookSecret();
  assert.equal(secret, second);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = '{"id":"rotation-event"}';
  const verify = (signingSecret) =>
    verifyEasystoreSignature({
      secret,
      timestamp,
      rawBody,
      signature: createEasystoreSignature({ secret: signingSecret, timestamp, rawBody }),
    });
  assert.equal(verify(first), false);
  assert.equal(verify(second), true);
  assert.doesNotMatch(
    JSON.stringify(await h.settings.getEasystoreWebhookStatus()),
    new RegExp(second),
  );
});

test("ADMIN cannot generate, regenerate, enable or disable the webhook", async () => {
  const h = harness({ role: "ADMIN" });
  for (const operation of ["generate", "rotate", "enable", "disable"]) {
    assert.match((await h.action(operation)).error, /Solo el owner/);
    assert.equal(h.row, null);
  }
});

test("authentication and completed TOTP are required on direct action calls", async () => {
  for (const options of [{ authenticated: false }, { totpEnabled: false }]) {
    const h = harness(options);
    for (const operation of ["generate", "rotate", "enable", "disable"])
      await assert.rejects(h.action(operation), /redirect:/);
    assert.equal(h.row, null);
  }
});

test("invalid input and missing encryption key cannot mutate configuration or leak details", async () => {
  const h = harness({ key: "invalid-private-key" });
  assert.match((await h.action("bogus")).error, /no válida/);
  const result = await h.action("generate");
  assert.ok(result.error);
  assert.doesNotMatch(JSON.stringify(result), /invalid-private-key|secretEncrypted/);
  assert.equal(h.row, null);
  // Disabling remains possible even if the encryption key is unavailable.
  assert.ok((await h.action("disable")).success);
});

test("authenticated encryption rejects tampering or a changed server key", async () => {
  const h = harness();
  await h.action("generate");
  await h.action("enable");
  h.env.EASYSTORE_WEBHOOK_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
  await assert.rejects(h.settings.getActiveEasystoreWebhookSecret());
  h.env.EASYSTORE_WEBHOOK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const parts = h.row.secretEncrypted.split(":");
  const ciphertext = Buffer.from(parts[3], "base64");
  ciphertext[0] ^= 1;
  parts[3] = ciphertext.toString("base64");
  h.row.secretEncrypted = parts.join(":");
  await assert.rejects(h.settings.getActiveEasystoreWebhookSecret());
});

test("endpoint uses the managed state and the current secret after rotation", async () => {
  const h = harness();
  const { POST } = load(
    "../src/app/api/webhooks/easystore/route.ts",
    {
      "@/lib/easystore-settings": h.settings,
      "@/lib/prisma": { prisma: {} },
      "@/lib/sales": {},
      "@/lib/easystore-webhook": {
        verifyEasystoreSignature,
        EASYSTORE_EVENT_TYPE: "sale.completed",
        EASYSTORE_WEBHOOK_MAX_BODY_BYTES: 1_000_000,
      },
      "next/cache": {},
      "next/server": { NextResponse: { json: Response.json } },
    },
    h.env,
  );
  function request(secret) {
    const rawBody = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Request("https://example.com/api/webhooks/easystore", {
      method: "POST",
      body: rawBody,
      headers: {
        "x-easystore-timestamp": timestamp,
        "x-easystore-signature": createEasystoreSignature({ secret, timestamp, rawBody }),
      },
    });
  }
  const first = (await h.action("generate")).secret;
  assert.equal((await POST(request(first))).status, 503);
  await h.action("enable");
  // A 422 for missing event headers proves the signature passed verification.
  assert.equal((await POST(request(first))).status, 422);
  const second = (
    await h.action("rotate", (await h.settings.getEasystoreWebhookStatus()).secretVersion)
  ).secret;
  assert.equal((await POST(request(first))).status, 401);
  assert.equal((await POST(request(second))).status, 422);
  await h.action("disable");
  assert.equal((await POST(request(second))).status, 503);
});

test("stale initial-generation forms cannot replace an existing active secret", async () => {
  const h = harness();
  const first = (await h.action("generate")).secret;
  await h.action("enable");
  const before = JSON.stringify(h.row);
  const result = await h.action("generate");
  assert.match(result.error, /otra pestaña/);
  assert.equal(result.secret, undefined);
  assert.equal(JSON.stringify(h.row), before);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), first);
});

test("concurrent initial generations produce only one secret and cannot overwrite the winner", async () => {
  const h = harness();
  const results = await Promise.all([h.action("generate"), h.action("generate")]);
  assert.equal(results.filter((result) => result.secret).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  await h.action("enable");
  assert.equal(
    await h.settings.getActiveEasystoreWebhookSecret(),
    results.find((result) => result.secret).secret,
  );
});

test("rotation requires confirmation of a valid current version and rejects stale confirmations", async () => {
  const h = harness();
  await h.action("generate");
  await h.action("enable");
  const version = (await h.settings.getEasystoreWebhookStatus()).secretVersion;
  const before = JSON.stringify(h.row);
  for (const invalid of [undefined, "", "not-a-date"]) {
    const result = await h.action("rotate", invalid);
    assert.match(result.error, /confirma/);
    assert.equal(result.secret, undefined);
    assert.equal(JSON.stringify(h.row), before);
  }
  const results = await Promise.all([h.action("rotate", version), h.action("rotate", version)]);
  assert.equal(results.filter((result) => result.secret).length, 1);
  assert.equal(results.filter((result) => result.error).length, 1);
  const winner = results.find((result) => result.secret).secret;
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), winner);
  assert.notEqual((await h.settings.getEasystoreWebhookStatus()).secretVersion, version);
  assert.equal((await h.action("rotate", version)).secret, undefined);
  assert.equal(await h.settings.getActiveEasystoreWebhookSecret(), winner);
});

test("rotations within the same millisecond still advance the version", async () => {
  const h = harness();
  await h.action("generate");
  // Future version simulates a server clock that has not advanced yet.
  h.row.secretUpdatedAt = new Date(Date.now() + 60_000);
  const version = h.row.secretUpdatedAt.toISOString();
  assert.ok((await h.action("rotate", version)).secret);
  assert.ok(h.row.secretUpdatedAt.getTime() > Date.parse(version));
  assert.equal((await h.action("rotate", version)).secret, undefined);
});
