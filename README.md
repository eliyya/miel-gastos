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

1. Crea usuarios manualmente desde consola.
2. El usuario entra con correo y contrasena temporal.
3. Escanea el QR TOTP.
4. Confirma el codigo de 6 digitos.
5. Registra gastos desde el tablero principal.

## Usuarios

El registro publico esta cerrado. Para crear un usuario:

```bash
pnpm user:create correo@ejemplo.com "password-temporal" "Nombre"
```

En el primer inicio de sesion, deja vacio el codigo TOTP. La app enviara al usuario a configurar su QR.

## Datos iniciales

`pnpm db:seed` crea el usuario owner si no existe y registra el gasto inicial de envases:

- $60.00 MXN por 20 botellas para miel a $3.00 cada una.

## Comandos utiles

```bash
pnpm lint
pnpm build
pnpm db:studio
pnpm user:create correo@ejemplo.com "password-temporal" "Nombre"
```
