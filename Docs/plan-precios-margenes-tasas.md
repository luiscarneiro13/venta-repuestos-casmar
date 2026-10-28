# Plan Fase 1 — Precios por márgenes con doble tasa (BCV + USDT Binance)

> Estado: **modelo aprobado — en implementación**. Definido y aprobado el 2026-10-23.
> Este documento reemplaza el modelo de "precios fijos por producto" que existe hoy.
> Fase 2 (futuro): IVA general en tickets y ventas — diseñar pensando en una línea
> de impuesto adicional sin reestructurar el modelo.

## 1. Tasas de cambio

- Dos tasas operativas: **BCV** (Bs/USD) y **USDT Binance** (Bs/USDT).
- Se piden en el **modal de tasa existente** (`App.vue`, "Tasa del día"), ahora con
  **dos campos**. Obligatorio después del login; si ya hay tasas hoy se precargan
  con la última registrada.
- `tasas_cambio` pasa a guardar **dos valores por registro** (histórico auditable,
  puede cambiar varias veces al día; la vigente es la última).
- Ingreso manual — no depender de APIs ni de internet.
- Cada venta guarda qué tasa aplicó según su método de cobro.

## 2. Tipos de precio

- Catálogo libre de **N tipos** (CRUD en `/tipos-precio`), solo se **desactivan**
  (`activo = 0`), nunca se borran — el histórico conserva snapshot.
- Cada tipo tiene **un solo % de utilidad por defecto** (`margen_default`,
  inicial 100% — **markup sobre el costo**: `precio = costo × (1+%)`;
  100% = vender al doble, sin límite superior ni casos de infinito).
- Tipos semilla (los del mockup aprobado): **Precio Full**, **Precio Especial**,
  **Precio Interno** — todos con `margen_default = 100`.
- **Precios base en $**: el costo se registra en $, el precio de venta se
  calcula en $ (1 USDT = 1 $). La conversión a Bs solo ocurre cuando el
  cliente paga en bolívares (tasa BCV); el cobro en USDT es el equivalente
  del precio en Bs a tasa Binance.
- Cambiar el default del tipo afecta a los productos que **no** tienen margen
  propio (los que nunca registraron entrada con ese tipo).
- Seeders: Precio 1–4 pasan a ser tipos con márgenes default.

## 3. Márgenes por producto (modelo central)

- El producto solo guarda **costo en USD** (`precio_compra_usd`). Ya no hay
  precios fijos por producto — la tabla `precios` queda obsoleta.
- Nueva tabla `producto_margenes`: `producto_id × tipo_precio_id → margen`
  (un solo % de utilidad por tipo).
- **Margen efectivo** = margen propio del producto, o default del tipo si no tiene.
- Al guardar una entrada, los márgenes **se persisten tal como se ven** y pasan a
  ser propios del producto (si el usuario quiere otros %, los cambia manualmente).

### Cálculo de precios (ejemplo real del cliente: costo 1000, %100, BCV 100, Binance 120)

```
precio_venta_$ = costo_usd × (1 + %)           →  2.000 $   (markup s/costo)
Pago en Bs     = precio_$ × tasa_bcv           →  Bs 200.000  (= $2.000 a BCV)
Pago en USDT   = precio_en_Bs ÷ tasa_binance   →  1.666,67 USDT
```

- **El cobro en USDT es el equivalente del precio en Bs a tasa Binance** —
  ambos pagos entregan el mismo valor (1 USDT = 1 $, pero vale más Bs).
- **El Bs es canónico e igual en ambos métodos**: `precio_bs` se calcula una
  sola vez y es el mismo número cobrado por BCV o por Binance; el redondeo lo
  absorbe el USDT (ej. `200.000 ÷ 120 = 1.666,666…` → cobra `1.666,67`, el Bs
  queda exacto). Totales y tickets siempre reconcilian en Bs.
- **Convención del %**: **markup sobre el costo** (decidido 2026-10-23):
  100% = vender al doble del costo. Se descartó utilidad sobre el precio
  (`costo ÷ (1−%)`) porque explota en %≥100 y es menos intuitiva.

- Margen es **markup sobre el costo** (no sobre el precio final).
- **Redondeo exacto**: el precio unitario se redondea a 2 decimales UNA vez al
  asignarse a la línea; `subtotal = unitario_redondeado × cantidad`;
  `total = Σ subtotales`. Nada se re-redondea después — ticket, detalle, totales
  y reportes deben coincidir al céntimo.

## 4. Productos — pantalla general (pedido del cliente)

- **Tabla con todos los productos** + buscador (filtra por referencia, nombre o
  marca mientras se escribe).
- Columnas: **Referencia/Nro. parte, Nombre, Marca, Cantidad actual,
  Inventario mínimo, Precio de compra**. Resaltar filas con `stock ≤ mínimo`.
- **Nuevo campo `stock_minimo`** en productos (default 0), editable en
  crear/editar.
- **Exportar a Excel** `.xlsx` respetando el **filtro activo** de la búsqueda.
- Clic en fila → **ficha del producto como modal ancho** (datos, stock, costo,
  margen efectivo por tipo + precio calculado Bs/$, movimientos, «Editar»,
  «Registrar entrada»).
- **Flujo producto inexistente**: búsqueda sin resultados → botón
  «Crear producto "X"» → modal de datos (referencia precargada si buscó por
  código) → al guardar abre «Registrar entrada» directo.
- **«Editar producto»**: datos de catálogo + `stock_minimo` + **tabla de
  márgenes** (los márgenes son dato del producto; la entrada es solo el atajo
  operativo). NO muestra entradas/movimientos dentro del editar.

## 5. Entrada de mercancía (modal, ancho 760px)

Campos: proveedor (obligatorio, select + «+ Agregar»), cantidad, **costo USD**,
nota, y **tabla de precios** — una fila por tipo activo con dos grupos
separados visualmente (layout aprobado en el mockup):

- Grupo **BCV**: `% Utilidad` (input) + **una columna de precio**:
  `Bs X` en negrita y debajo `≈ $ Y`.
- Grupo **USDT/divisas**: `% Utilidad` (input, **mismo valor compartido**) +
  **una columna de precio**: `Z USDT` en negrita y debajo `≈ Bs X`.
- **El % es uno solo por tipo** y editable desde cualquiera de los dos inputs.
- Encabezado de la tabla muestra las tasas vigentes:
  `% Utilidad — Tasa BCV N bs — Tasa Binance M bs`.
- Precargada con margen propio del producto, o default del tipo si no tiene.
- **Vista previa en vivo**: editar cualquier % o el costo recalcula los montos.
  El Bs es idéntico en ambos grupos; el USDT siempre es `Bs ÷ Binance`.
  Ver mockup `mockup-entrada-margenes.html` (raíz).
- El movimiento pasa a guardar **`costo_usd`** de esa compra (estándar de la
  industria: la recepción conserva su costo para auditar/valorar inventario).
- Guardado en transacción única: movimiento + costo del producto + márgenes.
- Ya no se exige "al menos un precio de venta" — los precios nacen del costo
  × márgenes; sí se exige **costo > 0**.

## 6. Venta

- Flujo actual se mantiene: producto al carrito sin precio → panel derecho
  muestra los N tipos → elegir asigna.
- **Las cards muestran ambos montos** (`Bs X / $ Y` por tipo) y cada **línea del
  carrito también** muestra su precio en Bs y en USDT.
- Al finalizar se elige **un solo método de pago** (Bs o USDT/divisas) para toda
  la venta; cada línea toma el valor de su columna correspondiente.
- `venta_detalle` snapshot: tipo_precio_id + nombre, margen aplicado, moneda de
  cobro, precio_unitario_usd, precio_unitario_bs, subtotales, tasa_bcv y
  tasa_binance usadas. `ventas` guarda la moneda/método de pago.
- Bloqueo actual se mantiene: no se finaliza con líneas sin precio asignado.
- **Ticket: solo bolívares**, calculados con la tasa del método cobrado
  (BCV si pagó en Bs, Binance si pagó en USDT).

## 7. Plan de implementación (orden sugerido)

1. **Migraciones** (`src/main/db/migrations/016_*.sql`):
   - `tasas_cambio` → columnas `tasa_bcv`, `tasa_binance` (migrar `valor` → ambas).
   - `tipos_precio` → `margen_default` (DEFAULT 100), `activo` (DEFAULT 1).
   - Nueva `producto_margenes` (producto_id, tipo_precio_id, margen,
     UNIQUE(producto_id, tipo_precio_id)).
   - `productos.stock_minimo` (DEFAULT 0).
   - `inventario_movimientos.costo_usd`.
   - `venta_detalle` → margen_aplicado, moneda_cobro, tasa_bcv, tasa_binance.
   - `ventas` → metodo_pago ('bs'|'usdt'), tasa_usada.
   - `cajas` → tasa_apertura_bcv/usdt, tasa_cierre_bcv/usdt.
   - `precios` queda sin uso (conservar para histórico, no migrar datos).
2. **Backend**: tasas (dos valores), tipos_precio con defaults, servicio
   `precios.calcular` (única fuente del cálculo + redondeo), márgenes repo,
   entrada transaccional con costo+márgenes, venta con método de pago y snapshot.
3. **Frontend**: modal de tasas (2 campos), pantalla productos (tabla + búsqueda
   + export + ficha modal ancha + crear-desde-búsqueda), entrada (tabla márgenes
   + preview), editar producto (márgenes + stock_minimo), venta (montos duales,
   selector de método de pago), ticket (solo Bs).
4. **Seeders/demo**: tipos con 100% default, márgenes demo coherentes.
5. **Tests**: cálculo de precios/redondeo, márgenes propios vs default, entrada
   con márgenes, snapshot de venta, export XLSX filtrado.
6. `npm run build` + pruebas; empaquetar solo cuando el usuario lo pida.

## Anexo — Contrato técnico de implementación

### Migración `016_margenes_tasas.sql`

- `tasas_cambio`: + `valor_bcv REAL`, + `valor_usdt REAL`
  (`UPDATE tasas_cambio SET valor_bcv=valor, valor_usdt=valor WHERE valor_bcv IS NULL`).
- `tipos_precio`: + `margen_default REAL NOT NULL DEFAULT 100`, + `activo INTEGER NOT NULL DEFAULT 1`.
- `precios`: + `margen REAL` (propio del producto; NULL = usa `margen_default` del tipo).
  `valor_usd` queda materializado = `round2(costo × (1+margen/100))` — se recalcula
  al guardar entrada, al cambiar costo o márgenes.
- `productos`: + `stock_minimo INTEGER NOT NULL DEFAULT 0`.
- `inventario_movimientos`: + `costo_usd REAL`.
- `ventas`: + `tasa_bcv REAL`, + `tasa_usdt REAL`, + `metodo_pago TEXT DEFAULT 'bs'`, + `total_usdt REAL`.
- `venta_detalle`: + `margen_utilidad REAL`, + `precio_unitario_usdt REAL`, + `subtotal_usdt REAL`.
- `cajas`: + `tasa_apertura_usdt REAL`, + `tasa_cierre_usdt REAL`
  (`tasa_apertura`/`tasa_cierre` existentes = valor BCV).

### Función única de cálculo (`precios.service.js`)

```
redondear2(n): Math.round(n * 100) / 100
precioUsd  = redondear2(costo * (1 + margen/100))   // margen efectivo
precioBs   = redondear2(precioUsd * tasaBcv)        // canónico
precioUsdt = redondear2(precioBs / tasaUsdt)
```

### window.api (preload)

- `tasas.obtenerHoy()` / `obtenerUltima()` → `{ id, valor_bcv, valor_usdt, fecha_hora } | null`
- `tasas.registrar({ valorBcv, valorUsdt, usuarioId })` → fila
- `tiposPrecio.listar()` → `{ id, nombre, orden, margen_default, activo, cantidad_precios }[]`
- `tiposPrecio.crear({ nombre, orden, margenDefault })` · `actualizar(id, { nombre, orden, margenDefault, activo })` · `eliminar(id)`
- `productos.listar({ texto })` → +`stock`, `stock_minimo`, `stock_bajo`
- `productos.crear/actualizar`: +`stockMinimo`, +`margenes: [{ tipoPrecioId, margen }]`
- `precios.listarPorProducto(productoId)` → `[{ id, tipoPrecioId, tipoPrecioNombre,
  margen, margenOrigen: 'propio'|'default', precioUsd, precioBs, precioUsdt }]`
  calculado con las tasas vigentes; incluye TODOS los tipos activos.
- `inventario.registrarEntrada({ productoId, cantidad, proveedorId,
  precioCompraUsd, motivo, usuarioId, margenes: [{ tipoPrecioId, margen }] })`
- `ventas.crear({ clienteId, usuarioId, metodoPago: 'bs'|'usdt',
  items: [{ precioId, cantidad }] })` — las tasas vigentes se leen en la BD,
  no vienen del renderer. Detalle devuelve `precio_unitario_usdt` y `metodo_pago`.

### Reglas

- Venta `metodo_pago='bs'`: cliente paga `total_bs`. `'usdt'`: paga `total_usdt`
  (suma de `subtotal_usdt` por línea). `total_bs` siempre se guarda (canónico).
- Ticket: solo bolívares (montos ya guardados en la venta).
- Tipo de precio con uso (precios o ventas): desactivar, no borrar.
- Test runner: `node --test tests/` (node:test + assert).

## 8. Fase 2 (futuro — tener en cuenta)

- **IVA general** en tickets y ventas. Implica: tasa de IVA en configuración,
  monto de impuesto por venta (y por línea si aplica), línea de IVA en el
  ticket, total = base + IVA. El modelo de márgenes no cambia; el IVA se suma
  como línea adicional al final del cálculo.
