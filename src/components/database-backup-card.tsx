'use client'

import { DatabaseBackup, Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DatabaseBackupCard() {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [downloaded, setDownloaded] = useState(false)

    async function downloadBackup() {
        if (pending) return
        setPending(true)
        setError(null)
        setDownloaded(false)

        try {
            const response = await fetch('/api/backup', { cache: 'no-store' })
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'No se pudo generar el respaldo.')
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download =
                response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ??
                'miel-gastos-respaldo.json'
            document.body.appendChild(link)
            link.click()
            link.remove()
            // Allow the browser to begin the download before releasing the blob.
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
            setDownloaded(true)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'No se pudo descargar el respaldo.')
        } finally {
            setPending(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <DatabaseBackup className="size-5" />
                    Respaldo de la base de datos
                </CardTitle>
                <CardDescription>
                    Descarga un archivo JSON con todos los gastos, ventas, catálogos, usuarios,
                    sesiones, tokens y configuración, junto con sus relaciones y la fecha del
                    respaldo.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <p className="text-sm text-muted-foreground">
                    El archivo contiene datos personales y de acceso. Guárdalo en un lugar seguro.
                </p>
                <Button onClick={downloadBackup} disabled={pending} className="w-fit">
                    {pending ? <LoaderCircle className="animate-spin" /> : <Download />}
                    {pending ? 'Generando respaldo…' : 'Descargar respaldo JSON'}
                </Button>
                {error ? (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                ) : null}
                <p role="status" className="text-sm text-muted-foreground">
                    {downloaded ? 'Respaldo generado. Revisa las descargas de tu navegador.' : ''}
                </p>
            </CardContent>
        </Card>
    )
}
