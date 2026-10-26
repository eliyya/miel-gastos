import 'server-only'
import postgres from '@prisma/orm-postgres/runtime'
import { contractFromJson } from '@prisma/orm-postgres/static'

import type { Contract } from '@/generated/prisma8/contract.d'
import contractJson from '@/generated/prisma8/contract.json' with { type: 'json' }

const contract = contractFromJson<Contract>(contractJson)
const createPrisma8 = () => postgres({ url: process.env.DATABASE_URL!, contract })

const globalForPrisma8 = globalThis as unknown as {
    prisma8?: ReturnType<typeof createPrisma8>
}

export const prisma8 = globalForPrisma8.prisma8 ?? createPrisma8()

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma8.prisma8 = prisma8
}
