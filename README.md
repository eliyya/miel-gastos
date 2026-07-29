# Gastos de Miel

App interna para registrar gastos del negocio de miel Martin del Campo.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 6
- Tailwind CSS 4
- shadcn/ui sobre Base UI
- PostgreSQL
- Prisma 7
- Sesiones con correo, contrasena y TOTP

## Desarrollo

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

La app usa `DATABASE_URL` de `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?uselibpqcompat=true&sslmode=require"
APP_OWNER_EMAIL="elimacmun@gmail.com"
APP_OWNER_NAME="Eli"
APP_OWNER_PASSWORD="change-me-12345"
```

En esta maquina, `.env` apunta a la base de Supabase del proyecto.

## Flujo de usuario

1. Crea cuenta con correo y contrasena.
2. Escanea el QR TOTP.
3. Confirma el codigo de 6 digitos.
4. Registra gastos desde el tablero principal.

## Datos iniciales

`pnpm db:seed` crea el usuario owner si no existe y registra el gasto inicial de envases:

- $60.00 MXN por 20 botellas para miel a $3.00 cada una.

## Comandos utiles

```bash
pnpm lint
pnpm build
pnpm db:studio
```
