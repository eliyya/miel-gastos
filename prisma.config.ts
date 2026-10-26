import { defineConfig, prisma7Schema } from '@prisma/orm-postgres/config'
import { definePrismaConfig } from 'prisma/config'

try {
    process.loadEnvFile()
} catch {}

export default definePrismaConfig({
    orm: defineConfig({
        contract: prisma7Schema('prisma/schema.prisma'),
        output: 'src/generated/prisma8',
        db: {
            connection: process.env['DATABASE_URL'],
        },
    }),
})
