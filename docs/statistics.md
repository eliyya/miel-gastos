# Estadísticas

`/statistics` requiere sesión con TOTP. Por defecto consulta todo el historial compartido del negocio, sin el límite de 40 registros de las pantallas de captura.

Filtros compartibles en la URL: `start=YYYY-MM-DD`, `end=YYYY-MM-DD` (ambos inclusivos y opcionales), `group=day|month|year`. Las ventas conservan su fecha de calendario; los gastos se interpretan en America/Mexico_City. Las gráficas incluyen intervalos sin movimientos y amplían la agrupación si supera 120 intervalos diarios o mensuales.

## Definiciones

- Ingresos: suma de cantidad × precio histórico por partida vendida.
- Egresos: gastos registrados en la libreta en MXN. Otras monedas se excluyen con un aviso, sin conversión implícita.
- Balance registrado: ingresos − egresos. No representa el saldo bancario ni incluye automáticamente comisiones de ventas.
- Margen de ventas: ingresos − producción histórica − comisiones históricas de vendedores − comisión de tarjeta. Se usa `calculateSale`, con redondeo por partida para el vendedor y por venta para la tarjeta.
- Margen de producto: ingreso − producción − comisión del vendedor. No asigna la comisión de tarjeta a productos arbitrariamente.
- Acumulado: suma del balance registrado desde cero al inicio del período elegido.
- Ticket promedio: ingresos / número de ventas, incluyendo ventas de cortesía.

Los gastos pueden contener compras ya reflejadas en los costos de las partidas vendidas. Por eso no se resta la libreta del margen de ventas ni se etiqueta esa combinación como utilidad neta. Tampoco hay datos de cobros pendientes, devoluciones o inventario para deducirlos del análisis.

Los productos y vendedores se agrupan por identificador, incluyendo los inactivos que tengan historial. Los nombres se toman de la venta más reciente del rango, nunca del catálogo actual. Solo se envían agregados a las gráficas del cliente; las consultas autenticadas se ejecutan en una transacción de lectura consistente.

Pruebas: `node --test scripts/statistics.test.mjs scripts/sales.test.mjs`.
