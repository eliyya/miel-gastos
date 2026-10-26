import { defineConfig } from '@prisma/prisma7/config'

try {
    process.loadEnvFile()
} catch {}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env['DATABASE_URL'],
    },
})
