import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { prisma } from '@/lib/prisma'

const where = { id: 'easystore' }

function encryptionKey() {
    const value = process.env.EASYSTORE_WEBHOOK_ENCRYPTION_KEY
    if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
        throw new Error('Webhook encryption key unavailable')
    }
    const key = Buffer.from(value, 'base64')
    if (key.length !== 32) throw new Error('Webhook encryption key invalid')
    return key
}

export async function getEasystoreWebhookStatus() {
    // Never fetch the encrypted secret for a page render or status response.
    const settings = await prisma.easystoreWebhookSettings.findUnique({
        where,
        select: { enabled: true, secretUpdatedAt: true },
    })
    return {
        enabled: settings?.enabled ?? false,
        secretConfigured: settings?.secretUpdatedAt != null,
        secretVersion: settings?.secretUpdatedAt?.toISOString() ?? null,
    }
}

export async function generateEasystoreWebhookSecret(expectedVersion: string | null = null) {
    const key = encryptionKey()
    const secret = randomBytes(32).toString('base64url')
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(Buffer.from('easystore-webhook:v1'))
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
    const secretEncrypted = [
        'v1',
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        ciphertext.toString('base64'),
    ].join(':')
    const expectedUpdatedAt = expectedVersion === null ? null : new Date(expectedVersion)
    // Advance the version even if two confirmed rotations occur in one millisecond.
    const secretUpdatedAt = new Date(
        Math.max(Date.now(), expectedUpdatedAt ? expectedUpdatedAt.getTime() + 1 : 0),
    )
    if (expectedVersion === null) {
        await prisma.easystoreWebhookSettings.upsert({
            where,
            create: where,
            update: {},
            select: { id: true },
        })
    }
    // Initial generation only fills an empty slot. Rotation replaces exactly the
    // version the owner confirmed, atomically, so stale tabs cannot overwrite it.
    const result = await prisma.easystoreWebhookSettings.updateMany({
        where: { ...where, secretUpdatedAt: expectedUpdatedAt },
        data: { secretEncrypted, secretUpdatedAt },
    })
    return result.count === 1 ? secret : null
}

export async function setEasystoreWebhookEnabled(enabled: boolean) {
    if (enabled) {
        // Check and update atomically; enabling never creates an unconfigured row.
        const result = await prisma.easystoreWebhookSettings.updateMany({
            where: { ...where, secretEncrypted: { not: null } },
            data: { enabled: true },
        })
        return result.count === 1
    }
    await prisma.easystoreWebhookSettings.upsert({
        where,
        create: { ...where, enabled: false },
        update: { enabled: false },
        select: { id: true },
    })
    return true
}

export async function getActiveEasystoreWebhookSecret() {
    const settings = await prisma.easystoreWebhookSettings.findUnique({
        where,
        select: { enabled: true, secretEncrypted: true },
    })
    if (!settings?.enabled || !settings.secretEncrypted) return null
    const [version, iv, tag, ciphertext] = settings.secretEncrypted.split(':')
    if (version !== 'v1' || !iv || !tag || !ciphertext)
        throw new Error('Invalid webhook configuration')
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
    decipher.setAAD(Buffer.from('easystore-webhook:v1'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
    ]).toString('utf8')
}
