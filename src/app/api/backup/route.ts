import { getCurrentUser } from '@/lib/auth'
import { createDatabaseBackup } from '@/lib/database-backup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
}

export async function GET() {
    try {
        const user = await getCurrentUser()
        if (!user) {
            return Response.json(
                { error: 'Inicia sesión para descargar el respaldo.' },
                { status: 401, headers },
            )
        }
        if (user.role !== 'OWNER' || !user.totpEnabled) {
            return Response.json(
                {
                    error: 'Solo el propietario con segundo factor activo puede descargar el respaldo.',
                },
                { status: 403, headers },
            )
        }

        const backup = await createDatabaseBackup()
        const timestamp = backup.exportedAt.replace(/[:.]/g, '-')
        return new Response(JSON.stringify(backup, null, 2), {
            headers: {
                ...headers,
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Disposition': `attachment; filename="miel-gastos-respaldo-${timestamp}.json"`,
            },
        })
    } catch {
        return Response.json(
            { error: 'No se pudo generar el respaldo. Inténtalo de nuevo.' },
            { status: 500, headers },
        )
    }
}
