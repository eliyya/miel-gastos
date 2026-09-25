# Gastos de Miel

App interna para registrar gastos del negocio de miel Martin del Campo.
Todos los usuarios creados manualmente trabajan sobre la misma libreta del negocio.

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

Los gastos son compartidos entre todos los usuarios del negocio. La cuenta que captura el movimiento queda guardada como referencia interna.

## Ventas

`/sales` consulta las ventas del negocio, con paginación de 40 registros. Cada fila
se despliega con clic o con el botón accesible por teclado para mostrar productos,
cantidades, precios, subtotales, costos y comisiones. El botón «Registrar venta» abre
un modal para capturar varios productos, fecha, cliente opcional, vendedor y tarjeta.
La tasa de tarjeta inicia en 4.06% y puede cambiarse. El modal calcula una vista previa;
el servidor valida los datos y guarda todos los valores históricos en una transacción.
Si el catálogo cambia durante la captura, solicita revisar los nuevos importes.
El precio unitario se puede ajustar por partida para dar un precio especial (incluido
cero para cortesías), sin modificar el catálogo. Los costos y porcentajes se obtienen
del servidor; las comisiones se calculan sobre el importe efectivamente vendido.
Cada venta puede eliminarse desde la tabla mediante un modal de confirmación
asíncrono. Espera la respuesta, muestra errores y elimina también sus partidas;
los totales se actualizan al terminar.

`/sales/catalog` permite administrar productos, vendedores y porcentajes por
producto. Desactivar un registro conserva el historial. Una comisión vacía significa
sin configurar; 0% significa que el vendedor no cobra comisión.

El esquema separa `Sale` y `SaleItem`. Cada partida conserva el nombre, precio y
costo unitarios del producto y el porcentaje del vendedor. La venta conserva el
nombre del vendedor, fecha sin hora, cliente opcional y tasa de tarjeta (cero sin
tarjeta). Los importes se almacenan en centavos y los porcentajes en puntos base:
4.06% = 406. Los subtotales, producción, pago al vendedor, costo total y ganancia
se calculan usando exclusivamente esos valores históricos, sin metadata duplicada.
La comisión se redondea al centavo por partida y la tarjeta sobre el subtotal total.
La ganancia es el margen de la venta; no descuenta de nuevo los gastos de la libreta.

Aplicar el esquema antes de usar estas pantallas: `pnpm exec prisma migrate deploy`.
Pruebas de cálculos: `node --test scripts/sales.test.mjs` (Node 24).

## Usuarios

El registro publico esta cerrado. Para crear un usuario:

```bash
pnpm user:create
```

El comando solicita correo, nombre opcional, rol (ADMIN por defecto u OWNER) y contraseña con confirmación. La contraseña no se muestra mientras se escribe ni se pasa como argumento al comando. Usa Ctrl+C para cancelar. Requiere una terminal interactiva y crea la cuenta en la base configurada en `DATABASE_URL`.

En el primer inicio de sesion, deja vacio el codigo TOTP. La app enviara al usuario a configurar su QR.

## Datos iniciales

`pnpm db:seed` crea el usuario owner si no existe y registra el gasto inicial de envases:

- $60.00 MXN por 20 botellas para miel a $3.00 cada una.

## Comandos utiles

```bash
pnpm lint
pnpm build
pnpm db:studio
pnpm user:create
```
