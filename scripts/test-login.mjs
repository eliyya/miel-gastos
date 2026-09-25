import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { test } from 'node:test';

// Exercise the real server action with isolated storage/session dependencies.
const source = readFileSync(new URL('../src/app/actions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness({ user = null, outage = false, validCode = true } = {}) {
  const sessions = [];
  const passwords = [];
  const exports = {};
  const dependencies = {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(path) { throw Object.assign(new Error('redirect'), { path }); } },
    zod: { z },
    '@/lib/auth': { async verifyPassword(value) { passwords.push(value); return value === ' secret '; }, async createSession(id) { sessions.push(id); } },
    '@/lib/agent-tokens': {}, '@/lib/format': {},
    '@/lib/prisma': { prisma: { user: { async findUnique() { if (outage) throw new Error('database details'); return user; } } } },
    '@/lib/totp': { verifyTotpToken() { return validCode; } },
  };
  vm.runInNewContext(compiled, { exports, require: (id) => dependencies[id] });
  return { sessions, passwords, async login(values) {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return exports.loginAction({}, data);
  } };
}
const user = { id: 'test-user', passwordHash: 'hash', totpEnabled: true, totpSecret: 'secret' };
const credentials = { email: 'person@example.com', password: ' secret ' };
test('invalid fields return actionable errors without creating a session', async () => {
  const h = harness(); const result = await h.login({ email: 'invalid', password: '', totpCode: 'abc' });
  assert.ok(result.fields.email); assert.ok(result.fields.password); assert.ok(result.fields.totpCode); assert.equal(h.sessions.length, 0);
});
test('unknown account and wrong password share the same error', async () => {
  const unknown = await harness().login(credentials);
  const wrong = await harness({ user }).login({ ...credentials, password: 'wrong' });
  assert.equal(unknown.error, wrong.error);
});
test('missing and expired TOTP do not create sessions', async () => {
  const h = harness({ user }); assert.ok((await h.login(credentials)).fields.totpCode); assert.equal(h.sessions.length, 0);
  const expired = harness({ user, validCode: false }); assert.ok((await expired.login({ ...credentials, totpCode: '123456' })).fields.totpCode); assert.equal(expired.sessions.length, 0);
});
test('valid TOTP creates session and redirects; password whitespace is preserved', async () => {
  const h = harness({ user }); await assert.rejects(h.login({ ...credentials, totpCode: '123 456' }), (e) => e.path === '/');
  assert.deepEqual(h.sessions, ['test-user']); assert.deepEqual(h.passwords, [' secret ']);
});
test('first access redirects to setup', async () => {
  const h = harness({ user: { ...user, totpEnabled: false } }); await assert.rejects(h.login(credentials), (e) => e.path === '/totp/setup'); assert.equal(h.sessions.length, 1);
});
test('service outage is explained without leaking internal details', async () => {
  const result = await harness({ outage: true }).login(credentials); assert.match(result.error, /servicio de acceso/); assert.doesNotMatch(result.error, /database/);
});
