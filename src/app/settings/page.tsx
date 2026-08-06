import Link from "next/link";
import { ArrowLeft, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";

import {
  changePasswordAction,
  logoutAction,
  regenerateTotpAction,
  updateProfileAction,
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireTotpUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";

const errorMessages: Record<string, string> = {
  email: "Ese correo ya esta asignado a otro usuario.",
  "current-password": "La contrasena actual no coincide.",
  "new-password": "La nueva contrasena debe tener 8 caracteres y coincidir.",
};

const updatedMessages: Record<string, string> = {
  profile: "Informacion de usuario actualizada.",
  password: "Contrasena actualizada.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const user = await requireTotpUser();
  const { error, updated } = await searchParams;
  const errorMessage = error ? errorMessages[error] : null;
  const updatedMessage = updated ? updatedMessages[updated] : null;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_42%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/"
              className={buttonVariants({
                variant: "ghost",
                className: "-ml-2 mb-2 w-fit",
              })}
            >
              <ArrowLeft />
              Volver
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-normal">
                Cuenta y seguridad
              </h1>
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" />
                TOTP activo
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.email} · Martin del Campo
            </p>
          </div>
          <form action={logoutAction}>
            <Button variant="outline" type="submit">
              Salir
            </Button>
          </form>
        </header>

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {updatedMessage ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {updatedMessage}
          </p>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="size-5" />
                Informacion de usuario
              </CardTitle>
              <CardDescription>
                Datos visibles dentro del registro interno.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateProfileAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={user.name ?? ""}
                    autoComplete="name"
                    maxLength={80}
                    placeholder="Eli"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    autoComplete="email"
                    required
                  />
                </div>

                <Button type="submit" className="w-fit">
                  <Save />
                  Guardar cambios
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-5" />
                Contrasena
              </CardTitle>
              <CardDescription>
                Cambia la clave y renueva la sesion activa.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={changePasswordAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="currentPassword">Contrasena actual</Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="newPassword">Nueva contrasena</Label>
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>

                <Button type="submit" className="w-fit">
                  <Save />
                  Actualizar contrasena
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Estado de acceso y segundo factor de la cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Segundo factor</p>
                <p className="mt-1 font-medium">
                  {user.totpEnabled ? "Activo" : "Pendiente"}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Usuario creado</p>
                <p className="mt-1 font-medium">{formatDate(user.createdAt)}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Ultimo cambio</p>
                <p className="mt-1 font-medium">{formatDate(user.updatedAt)}</p>
              </div>
            </div>

            <form action={regenerateTotpAction}>
              <Button type="submit" variant="outline" className="w-full md:w-auto">
                <KeyRound />
                Regenerar TOTP
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
