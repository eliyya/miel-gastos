# Webhook de ventas de EasyStore

Miel Gastos recibe eventos `sale.completed` de EasyStore en:

```text
POST /api/webhooks/easystore
```

La forma del payload se valida con el schema oficial de
`@oasiscode/easystore@0.2.1`.

El endpoint valida la firma HMAC-SHA256 que EasyStore envía en
`X-EasyStore-Signature`, usando los bytes exactos del cuerpo y el encabezado
`X-EasyStore-Timestamp`. También rechaza timestamps con más de cinco minutos de
desfase y cuerpos de más de 1 MB.

## Configuración

Define en el entorno de Miel Gastos:

```env
EASYSTORE_WEBHOOK_SECRET="el-mismo-secreto-configurado-en-easystore"
```

`seller.external_id` debe contener el ID de un vendedor existente de Miel
Gastos (`Seller.id`), visible en `/sales/catalog`. Si falta o no coincide,
el endpoint responde `422` y no registra la venta. El vendedor queda guardado
en `Sale.sellerId`. Para `Sale.userId` se usa su usuario vinculado (`Seller.userId`);
si no tiene uno, se usa el usuario con rol `OWNER` más antiguo (por fecha de
creación y luego ID). Si tampoco existe un owner, se responde `422`.

`EASYSTORE_STORE_EXTERNAL_ID` es opcional; cuando existe,
solo se aceptan eventos cuyo `store.external_id` coincida. Si el pago se hizo
con tarjeta, se aplica la misma tasa predeterminada del formulario de ventas:
4.06%. Ambos usan `DEFAULT_CARD_RATE_BPS`. Para otros pagos, la tasa es cero.

En EasyStore configura la URL pública HTTPS del endpoint y el mismo secreto.

## Mapeo de catálogo

Para cada producto, configura en EasyStore el campo `ID externo` con el ID que
se muestra en `/sales/catalog` en Miel Gastos. El endpoint usa
`external_product_id` para localizar el producto y toma de Miel el costo y la
comisión vigentes al momento de importar la venta; esos valores quedan
guardados como una instantánea en la venta.

El vendedor se busca exclusivamente comparando `seller.external_id` con
`Seller.id` de Miel Gastos. `seller.id` es el ID interno del usuario de
EasyStore y no se usa para buscar en Miel. Tampoco se usa el nombre para mapear
vendedores. El nombre y las comisiones se toman del vendedor de Miel.

Los impuestos no están contemplados en el modelo actual de Miel Gastos. Por
eso solo se aceptan eventos con `tax = 0` y con subtotal/total iguales a la
suma de sus productos.

## Reintentos e idempotencia

El ID del evento se guarda en `Sale.externalEventId`, que es único. Si EasyStore
reintenta la misma entrega, Miel Gastos responde `2xx` con `duplicate: true` y
no crea otra venta. Ejecuta las migraciones antes de activar el webhook:

```bash
pnpm exec prisma migrate deploy
```
