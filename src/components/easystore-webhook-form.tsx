"use client";

import { useState } from "react";
import { updateEasystoreWebhookAction } from "@/app/easystore-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EasystoreWebhookForm({
  enabled,
  secretConfigured,
  secretVersion,
}: {
  enabled: boolean;
  secretConfigured: boolean;
  secretVersion: string | null;
}) {
  const [secret, setSecret] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmRotation, setConfirmRotation] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setSecret(undefined);
    setMessage(undefined);
    setError(undefined);
    setPending(true);
    setConfirmRotation(null);
    try {
      const result = await updateEasystoreWebhookAction(formData);
      setSecret(result.secret);
      setMessage(result.success);
      setError(result.error);
    } catch {
      setError(
        "No se pudo conectar con el servidor. Recarga para consultar el estado; si generaste un secreto y no lo recibiste, vuelve a generarlo.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook de EasyStore</CardTitle>
        <CardDescription>
          Recibe ventas en /api/webhooks/easystore. Solo el owner puede administrar esta
          integración.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Activado" : "Desactivado"}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {secretConfigured ? "Secreto configurado" : "Sin secreto configurado"}
          </p>
        </div>
        <form action={submit}>
          <Button
            type="submit"
            name="operation"
            value={enabled ? "disable" : "enable"}
            variant="outline"
            disabled={pending || (!enabled && !secretConfigured)}
          >
            {enabled ? "Desactivar webhook" : "Activar webhook"}
          </Button>
        </form>
        <form action={submit} className="grid gap-3">
          <input type="hidden" name="operation" value={confirmRotation ? "rotate" : "generate"} />
          <input type="hidden" name="secretVersion" value={confirmRotation ?? ""} />
          <p className="text-sm text-muted-foreground">
            El secreto nuevo se muestra una sola vez. Cópialo y configúralo en EasyStore antes de
            cerrar o recargar esta página.
          </p>
          {secretConfigured && !confirmRotation ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={pending}
              onClick={() => {
                setSecret(undefined);
                setConfirmRotation(secretVersion);
              }}
            >
              Regenerar secreto
            </Button>
          ) : (
            <>
              {confirmRotation ? (
                <p className="text-sm">
                  El secreto anterior dejará de funcionar inmediatamente. Deberás actualizarlo en
                  EasyStore.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {confirmRotation ? "Confirmar regeneración" : "Generar secreto"}
                </Button>
                {confirmRotation ? (
                  <Button type="button" variant="outline" onClick={() => setConfirmRotation(null)}>
                    Cancelar
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </form>
        {pending ? (
          <p role="status" className="text-sm">
            Guardando…
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {secret ? (
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-3" role="status">
            <p className="text-sm font-medium">Secreto nuevo · única vista</p>
            <code className="break-all select-all text-sm">{secret}</code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret);
                    setMessage("Secreto copiado.");
                  } catch {
                    setError("No se pudo copiar. Selecciona el secreto y cópialo manualmente.");
                  }
                }}
              >
                Copiar secreto
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSecret(undefined);
                  setMessage("Secreto oculto. Para obtener otro tendrás que regenerarlo.");
                }}
              >
                Ya lo guardé; ocultar
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
