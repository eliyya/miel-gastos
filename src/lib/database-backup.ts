import 'server-only'
import { z } from 'zod'

import contract from '@/generated/prisma8/contract.json' with { type: 'json' }
import { prisma8 } from '@/lib/prisma8'

export async function createDatabaseBackup() {
    // One SQL statement guarantees a single snapshot across every table. Let
    // Postgres serialize all columns, preserving dates, nulls and stored secrets.
    const [result] = await prisma8.query(
        prisma8.raw.sql`
            SELECT jsonb_build_object(
                'User', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."User" t),
                'Session', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."Session" t),
                'AgentToken', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."AgentToken" t),
                'Expense', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."Expense" t),
                'Product', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."Product" t),
                'Seller', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."Seller" t),
                'SellerCommission', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t."sellerId", t."productId"), '[]'::jsonb) FROM public."SellerCommission" t),
                'Sale', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."Sale" t),
                'SaleItem', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."SaleItem" t),
                'EasystoreWebhookSettings', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public."EasystoreWebhookSettings" t)
            ) AS data
        `
            .returnsRow({ data: 'pg/jsonb@1' })
            .build(),
    )
    const data = z.record(z.string(), z.array(z.record(z.string(), z.json()))).parse(result?.data)
    // Fail rather than silently produce an incomplete backup after a new model is added.
    if (Object.keys(contract.roots).some(table => !(table in data))) {
        throw new Error('The backup must include every model in the database contract.')
    }

    return {
        format: 'miel-gastos-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        counts: Object.fromEntries(
            Object.entries(data).map(([table, rows]) => [table, rows.length]),
        ),
        schema: contract,
        data,
    }
}
