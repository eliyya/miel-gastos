import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { loginAction } from "@/app/actions";
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
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.totpEnabled ? "/" : "/totp/setup");
  }

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LockKeyhole className="size-5" />
            Entrar
          </CardTitle>
          <CardDescription>
            Usa tu correo, contrasena y el codigo de tu app TOTP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="grid gap-4">
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error === "totp"
                  ? "Codigo TOTP invalido."
                  : "Correo o contrasena invalidos."}
              </p>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contrasena</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="totpCode">Codigo TOTP</Label>
              <Input
                id="totpCode"
                name="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
              />
            </div>
            <Button type="submit" size="lg">Entrar</Button>
            <p className="text-center text-sm text-muted-foreground">
              Sin cuenta?{" "}
              <Link className="font-medium text-foreground underline" href="/register">
                Crear una
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
