import Image from "next/image";
import { KeyRound, RotateCcw } from "lucide-react";

import { enableTotpAction, regenerateTotpAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTotpQrDataUrl, createTotpSecret } from "@/lib/totp";
import { redirect } from "next/navigation";

export default async function TotpSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();

  if (user.totpEnabled) {
    redirect("/");
  }

  let totpSecret = user.totpSecret;

  if (!totpSecret) {
    totpSecret = createTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret },
    });
  }

  const { error } = await searchParams;
  const qrDataUrl = await createTotpQrDataUrl(user.email, totpSecret);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-lg rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="size-5" />
            Activar TOTP
          </CardTitle>
          <CardDescription>
            Escanea el QR con 1Password, Bitwarden, Google Authenticator o una app compatible.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex justify-center rounded-lg border bg-white p-4">
            <Image
              src={qrDataUrl}
              alt="Codigo QR para configurar TOTP"
              width={240}
              height={240}
              unoptimized
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Clave manual</p>
            <p className="mt-1 break-all font-mono text-sm">{totpSecret}</p>
          </div>

          <form action={enableTotpAction} className="grid gap-4">
            {error === "code" ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Codigo invalido. Revisa que la hora del dispositivo este sincronizada.
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="code">Codigo de 6 digitos</Label>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
            </div>
            <Button type="submit" size="lg">Activar y entrar</Button>
          </form>

          <form action={regenerateTotpAction}>
            <Button type="submit" variant="outline" className="w-full">
              <RotateCcw />
              Generar otro secreto
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
