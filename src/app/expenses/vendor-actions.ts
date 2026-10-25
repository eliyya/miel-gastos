'use server'

import { requireTotpUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function getExpenseVendors(): Promise<string[]> {
    await requireTotpUser()
    const vendors = await prisma.expense.groupBy({
        by: ['vendor'],
        where: { vendor: { not: null } },
        orderBy: { vendor: 'asc' },
    })
    return vendors.flatMap(({ vendor }) => (vendor?.trim() ? [vendor.trim()] : []))
}
