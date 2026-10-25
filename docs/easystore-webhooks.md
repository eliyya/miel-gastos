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

Antes de desplegar, aplica las migraciones (`pnpm exec prisma7 migrate deploy`) y
define en el entorno del servidor una clave de cifrado de 32 bytes en base64:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Guarda el resultado como `EASYSTORE_WEBHOOK_ENCRYPTION_KEY` en el gestor de
secretos del despliegue, igual en todas las instancias. Esta clave cifra el secreto
del webhook con AES-256-GCM; debe mantenerse fuera de la base de datos, el código
y los logs. Conserva una copia segura: cambiarla invalida el descifrado de los
secretos guardados. Si se pierde o cambia, genera un secreto nuevo desde Ajustes
y actualiza EasyStore. La aplicación nunca registra los secretos ni los errores
internos de estas operaciones en logs.

1. Inicia sesión con una cuenta **OWNER**, con TOTP configurado, y abre **Mi cuenta**
   (`/settings`), sección **Webhook de EasyStore**.
2. Pulsa **Generar secreto**. Copia el valor y configura en EasyStore la URL pública
   HTTPS de `POST /api/webhooks/easystore` y ese secreto.
3. Pulsa **Ya lo guardé; ocultar** y después **Activar webhook**.

La integración empieza **desactivada** y no se puede activar sin un secreto.
El secreto completo se devuelve exclusivamente como resultado de generarlo y se
muestra temporalmente en esa vista. No se guarda en el navegador, URL ni HTML
inicial. Al ocultarlo, recargar o consultar otra vez la página, solo aparece
**Secreto configurado**. Si no lo copiaste, debes regenerarlo.

**Regenerar secreto** solicita confirmación y reemplaza inmediatamente el secreto
anterior: las firmas antiguas dejan de ser válidas. Conserva el estado de
activación. Para una rotación coordinada, desactiva el webhook, regenera, copia el
nuevo valor a EasyStore y vuelve a activar. No se puede recuperar el secreto
anterior. Solo OWNER puede ver los controles; las operaciones también comprueban
el rol y la sesión con TOTP en el servidor.

La generación inicial solo funciona si todavía no existe un secreto. La
regeneración comprueba de forma atómica la versión que se confirmó: si otra
pestaña o sesión cambió el secreto, la operación se rechaza y actualiza el estado
para que vuelvas a revisar y confirmar. Una página antigua nunca reemplaza un
secreto nuevo sin esa confirmación.

**Desactivar webhook** conserva el secreto cifrado, pero el endpoint responde
`503` sin leer el evento ni registrar ventas, incluso para reintentos de eventos
ya importados. También responde `503` si falta configuración o falla el
descifrado. Al activarlo se mantienen la firma HMAC, la tolerancia de cinco
minutos y la idempotencia descritas aquí.

`EASYSTORE_WEBHOOK_SECRET` ya no se utiliza y no hay activación automática desde
el entorno. Tras actualizar una instalación existente, genera el secreto desde
Ajustes, actualiza EasyStore y activa la integración.

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

En EasyStore configura la URL pública HTTPS del endpoint y el secreto generado.

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
pnpm exec prisma7 migrate deploy
```

Pruebas de configuración, permisos, cifrado, rotación y recepción:

```bash
node --test scripts/easystore*.test.mjs
```
