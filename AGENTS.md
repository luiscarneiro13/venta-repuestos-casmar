# Venta de Repuestos - POS de Escritorio

> Derivado del POS de Planta de Hielo Cristal (v1.x). Desde v2.0 vende repuestos:
> catálogo abierto de productos, cada uno con N precios con nombre (ver
> `Docs/analisis-venta-repuestos.md`).

> **Modelo vigente**: un margen y un precio materializado por producto y tipo;
> importes Bs con tasa BCV e IVA configurable. La tasa USDT se registra
> independientemente para uso futuro; las columnas legadas de precio USDT
> se conservan por compatibilidad con bases de datos anteriores.

## Stack

- **Electron** + **Vue 3** (`<script setup>`) + **Vue Router**
- **Vite / Electron Vite** como bundler
- **SQLite** con `better-sqlite3`
- Impresión de documentos en hoja carta con `webContents.print()` (`printer/documento.printer.js`);
  el módulo térmico ESC/POS (`ticket.printer.js`, `@maxxuxx/node-printer`) queda como legado sin uso

## Arquitectura

```
src/
├── main/                    # Proceso principal de Electron
│   ├── index.js             # Entry point. Arranca DB, migrations, seeds, IPC
│   ├── db/
│   │   ├── connection.js    # Singleton de better-sqlite3
│   │   ├── migrate.js        # Aplica migraciones de db/migrations/*.sql
│   │   ├── seed.js          # Aplica seeds de db/seeds/*.sql (idempotente)
│   │   │                    # y db/seeds/dev/*.sql (solo con SEED_DEMO=1)
│   │   ├── migrations/      # Migraciones versionadas (001_*, 002_*, ...)
│   │   └── seeds/
│   │       ├── *.sql        # Catálogo base (usuarios, productos, precios)
│   │       │                  # Idempotente con INSERT OR IGNORE, corre siempre
│   │       └── dev/*.sql     # Datos de simulación. SOLO con SEED_DEMO=1
│   ├── services/            # Lógica de negocio
│   ├── repositories/         # Acceso a SQLite (queries)
│   ├── ipc/                  # Handlers ipcMain.handle(...)
│   └── printer/
│       ├── documento.printer.js # Documentos HTML en hoja carta + print vía ventana oculta
│       └── ticket.printer.js   # Tickets ESC/POS (legado, sin uso en la app)
├── preload/
│   └── index.js             # Expone window.api.* (ipcRenderer.invoke)
└── renderer/
    └── src/
        ├── pages/           # Vistas Vue (una por ruta)
        ├── components/      # Componentes reutilizables
        ├── composables/     # useConfiguracion, useFormato, etc.
        ├── router/index.js  # Definición de rutas
        ├── store/           # Pinia/stores
        └── assets/          # CSS, fuentes
```

## Flujo de datos (backend → frontend)

```
repository (SQL) → service (lógica) → ipc (ipcMain.handle) → preload (window.api) → vista Vue
```

Cada nueva consulta del backend requiere tocar las 4 capas:
1. `src/main/repositories/<entidad>.repo.js` — query SQL
2. `src/main/services/<entidad>.service.js` — delega al repo
3. `src/main/ipc/<entidad>.ipc.js` — registra el canal `ipcMain.handle`
4. `src/preload/index.js` — expone el método en `window.api.<entidad>`

## Base de datos

### Tablas principales

- **usuarios**: id, nombre, usuario (UNIQUE), password_hash, rol
- **clientes**: id, nombre, tipo_documento, numero_documento, telefono, direccion
- **proveedores**: id, nombre (UNIQUE), documento, telefono, direccion, activo
  - Se desactivan en vez de borrar para preservar el historial de entradas
- **categorias_proveedor** / **categorias_producto**: id, nombre (UNIQUE NOCASE), descripcion,
  activo — CRUD en `/categorias-proveedor` y `/categorias-producto` (cards en Operaciones).
  Código **genérico compartido**: `repositories/categorias.repo.js` (`repoCategorias(tabla)`,
  tablas en lista cerrada), `services/categorias.service.js` (`categoriasProveedor`,
  `categoriasProducto`), `ipc/categorias.ipc.js`, `apiCategorias()` en preload y la vista
  `pages/CategoriasView.vue` (props desde el router). Un catálogo nuevo = migración + seed +
  agregarlo a esas piezas. Seeds `003_`/`004_` (20 y 24 categorías) corren **una sola vez**
  (marcas `seed_categorias_*` en `configuracion`): lo borrado/renombrado no reaparece.
  `categorias_producto` se vincula a productos (`productos.categoria_id`); las de
  proveedor aún no se vinculan
- **productos**: id, codigo (UNIQUE, opcional), codigo_barras (UNIQUE parcial, opcional), nombre, marca, descripcion, unidad_medida, ubicacion, precio_compra_usd, stock_minimo, categoria_id (FK → categorias_producto, opcional), activo
  - `productos.repo` hace LEFT JOIN y devuelve `categoria_nombre`. Al asignar, la categoría
    debe existir y estar activa (una desactivada solo se conserva si el producto ya la tenía).
    Una categoría con productos no se elimina: se desactiva.
  - Catálogo `/inventario`: columna Categoría, filtro "Todas las categorías / Sin categoría"
    y la búsqueda incluye la categoría. `descripcion` ahora es texto libre ("Descripción").
  - Seed `005_productos_categoria.sql` (una sola vez): asigna categoría a productos viejos desde
    su texto `descripcion` (exacto → prefijo → contiene)
  - Los productos con ventas/movimientos no se borran: se desactivan (`activo = 0`)
  - Al crear solo se guardan los datos del catálogo; costo y márgenes se cargan en la primera entrada
  - El `precio_compra_usd` también se corrige a mano al editar el producto (campo "Precio de
    compra (USD)"): mayor que cero o vacío (null = sin costo). Al guardarlo se rematerializan
    `valor_usd`/`valor_usdt` con los márgenes vigentes, en la misma transacción; sin costo los
    precios conservan su último valor
  - `codigo_barras` es opcional y único cuando existe; los buscadores (catálogo,
    combobox de venta/operaciones y `productos.listar({texto})`) lo incluyen:
    escanear un código encuentra el producto directo
  - `descripcion` guarda los nombres coloquiales del repuesto ("goma" para
    "buje") y **todos los buscadores la incluyen**: el LIKE de
    `productos.repo.listar({texto})`, el filtro del `ProductoCombobox` y los
    `productosFiltrados` de `/inventario` y `/productos`
- **tasas_cambio**: id, valor (BCV legacy), valor_bcv, valor_usdt, usuario_id, fecha_hora — histórico auditable, la vigente es la última
- **tipos_precio**: id, nombre (UNIQUE), orden, margen_default (DEFAULT 100), activo
  - Nombres semilla: Precio Full, Precio Especial, Precio Interno
  - Solo se desactivan si tienen uso; nunca se borran con ventas asociadas
- **precios**: id, producto_id, tipo_precio_id, valor_usd, valor_usdt, descripcion, margen, margen_usdt, activo
  - UNIQUE(producto_id, tipo_precio_id). `margen` es el único margen activo
    (propio o `margen_default`). `valor_usd` materializa
    `round2(costo × (1+margen/100))`; Bs se obtiene con la tasa BCV.
    `margen_usdt`/`valor_usdt` son columnas legadas: no se borran ni se
    usan para determinar el precio vigente.
- **ventas**: id, numero_ticket, cliente_id, usuario_id, tasa_valor (BCV), tasa_bcv, tasa_usdt, metodo_pago ('bs'|'usdt'), tipo_documento ('factura'|'nota_entrega'), iva_porcentaje, iva_usd, iva_bs, iva_usdt, total_usd, total_bs, total_usdt, estado, creado_en
  - `total_*` es el monto **final cobrado** (`base + IVA`); `iva_*` es el impuesto desglosado. Base = total − iva. Ventas anteriores a la migración 019 tienen `iva_*` en NULL
- **venta_detalle**: id, venta_id, precio_id, cantidad, precio_unitario_usd/bs/usdt, subtotal_usd/bs/usdt,
  margen_utilidad, producto_nombre, tipo_precio_nombre (snapshot completo)
- **inventario_movimientos**: producto_id, tipo, cantidad, saldo, motivo, costo_usd, proveedor_id, venta_id, usuario_id, creado_en
  - Stock de un producto = `saldo` del último movimiento; `costo_usd` = costo de esa compra (auditoría)
  - Entrada transaccional: movimiento + costo del producto + márgenes (`precios.margen`/`valor_usd`)
  - **Edición de entradas** (`inventario:editarMovimiento`): una entrada se corrige completa —
    cantidad, nota, proveedor, costo y % de utilidad, en una sola transacción. El saldo de ella y
    de todos los movimientos posteriores se desplaza con la diferencia; se rechaza si quedaría
    algún saldo en negativo (unidades ya despachadas). El costo del producto y los precios solo
    se recalculan si la entrada editada es la **última con costo** (`ultimaEntradaConCosto`):
    corregir una entrada vieja queda en el historial sin pisar el costo vigente. Las entradas de
    devolución por anulación (`venta_id` o motivo "Anulación …") solo corrigen cantidad/nota.
    **Anulación de entradas** (`inventario:anularMovimiento`, columnas `anulada`/`anulada_en`/
    `anulada_por_id`, migración 026): la fila NO se borra — queda marcada para auditoría y su
    cantidad se descuenta del saldo propio y de los posteriores (rechazo si queda saldo negativo).
    El costo del producto vuelve a la última entrada con costo vigente (`ultimaEntradaConCosto`
    excluye anuladas; `rematerializarPrecios` recalcula con los márgenes guardados — sin costo,
    los precios conservan su último valor). No se anulan salidas ni devoluciones por venta; una
    anulada no se edita ni se re-anula. Tests: `tests/entrada-edicion.test.mjs`
- **cajas**: tasa_apertura (BCV), tasa_apertura_usdt, tasa_cierre, tasa_cierre_usdt, ...

### Reglas de negocio de ventas

- Una línea del ticket = un producto. Primero se agrega sin precio, luego se
  selecciona la línea y se le asigna uno de sus precios de venta.
- **Precio vigente único por producto y tipo**: `precios.valor_usd` y `precios.margen`
  (markup sobre el costo, 100% = doble) son la referencia; `precioBs =
  round2(valor_usd × BCV)`. La misma línea se muestra en Bs con su importe
  en $ debajo. Al registrar entradas o corregir costo/margen se actualiza
  el precio materializado usando solo ese margen. Las columnas históricas
  `margen_usdt` y `valor_usdt` se conservan para no alterar datos de inventario,
  pero no definen un segundo precio operativo. Las tasas BCV y USDT siguen
  registrándose y mostrándose por separado (inicio de sesión, TopBar, Ventas
  del día y cierre de caja); solo BCV determina el precio vigente. La tasa
  USDT se conserva para un uso futuro, no se reemplaza por BCV.
  El carrito mantiene la asignación MANUAL de tipo de precio; factura e IVA
  incluido siguen siendo el estado inicial. `venta_detalle.margen_utilidad`
  guarda el margen del precio seleccionado.
- `ventas.service.crearVenta` lee las tasas vigentes de la BD (no del renderer),
  toma el precio unitario materializado, **bloquea la venta si la suma de unidades
  de un producto supera su stock**, guarda snapshot completo (márgenes, tasas,
  método de pago) y registra venta + salidas en una transacción. Anular devuelve stock.
- **Tipo de documento** (`ventas.tipo_documento`, migración 023): `factura` (default)
  o `nota_entrega`. La factura imprime líneas sin IVA + `Subtotal / IVA / TOTAL` en Bs;
  la nota **nunca desglosa IVA** (`iva_porcentaje` 0, `iva_*` 0). La única opción
  propia de la nota en pantalla es la **moneda** del documento ($ o Bs,
  `ventas.nota_moneda` 'usd'|'bs', migración 028); las notas nuevas siempre cobran
  el precio con IVA embebido (`calcularLineaNota` con `conIva=true`, que equivale a
  `precioUnitarioConIva` + IVA 0%) y se guardan con `nota_con_iva = 1`. La columna
  `ventas.nota_con_iva` y el modo "sin IVA" (`precioUnitarioSinIva`) quedan solo
  para reimprimir notas históricas creadas con esa opción.
  Correlativos independientes: facturas `T-0001…`, notas `NE-0001…`. Store:
  `tipoDocumento`, `notaMoneda` (se reinician con el ticket). El documento
  dice `NOTA DE ENTREGA` / `Nro. NE-…`, sin IVA, sin método de pago ni tasas, con el
  bloque de recepción fijo abajo a la izquierda: RECIBIDO / FECHA / FIRMA (`.recibo` +
  `pagina-nota`). Las facturas nuevas no imprimen tasas; la reimpresión lee
  tipo/moneda/IVA de la BD. El reporte Z
  cuenta facturas y notas. Tests: `tests/nota-entrega.test.mjs`, `tests/documento-venta.test.mjs`.
- Las ventas nuevas se registran siempre con `metodo_pago = 'bs'` (BCV): no hay
  selector de método de pago en `/venta`. Cada línea y el total del carrito
  muestran Bs como importe principal y $ del MISMO precio debajo (no hay una
  cotización separada para divisas). El reporte Z y las pantallas activas
  ya no muestran precios USDT ni un segundo margen; sí muestran las tasas
  BCV y USDT del día. Los campos legados de la BD siguen disponibles; no se
  borran productos, costos ni movimientos.
- **IVA general** (configuración `iva_porcentaje`, default 16, editable en
  `/configuracion` → Impuestos). **Única fuente: `src/shared/venta.calculo.js`**
  (`calcularLinea`, `calcularTotales`), importada por la pantalla de venta
  (PriceCard, CartItem, ProductoCombobox, vista previa) y por `crearVenta`.
  Nunca duplicar este cálculo.
  - IVA **por unidad** y por moneda: `ivaUnit = r2(base×iva%)`,
    `conIva = r2(base+ivaUnit)`; línea: `subtotal = r2(base×q)`,
    `iva = r2(ivaUnit×q)`, `total = subtotal+iva` (= `conIva×q`). Totales = suma de líneas.
  - **Costo con IVA incluido** (`productos.costo_con_iva` + snapshot
    `inventario_movimientos.costo_con_iva`, migración 027): declara si el costo de
    compra ya trae IVA. **Ya no se edita desde la UI**: todos los campos de costo
    (entrada, edición de entrada y producto) piden el costo sin IVA y envían
    `costoConIva: false`; el flag queda solo para respetar filas históricas.
    Si es 1, el precio materializado `costo×(1+margen)` **es** el precio con IVA:
    `calcularLinea(precio, q, iva, ivaIncluido)` lo desglosa hacia atrás
    (`unitario = r2(precio/(1+iva%))`, `ivaUnit = r2(precio − unitario)`); la factura
    muestra ese desglose y el total coincide al céntimo con lo cobrado. Si es 0, el
    materializado es la base y se le suma el IVA encima (comportamiento clásico).
    `precioUnitarioConIva` da el precio final al cliente en ambos casos; la nota de
    entrega lo usa con IVA 0% para cobrarlo sin desglosar. El flag viaja en
    `precios.buscarPorId` (`producto_costo_con_iva`) y en `totalesEsperados`.
  - **Pantalla de venta**: precios CON IVA (cards, c/u y subtotal de línea, rango del buscador).
  - **Factura** (vista previa = ticket impreso): líneas SIN IVA, luego
    `Subtotal / IVA X% / TOTAL`, todo en Bs (nada de dólares en la factura).
  - `venta_detalle` guarda unitario/subtotal SIN IVA; `ventas.iva_*`/`total_*` los totales.
  - `finalizarVenta` refresca precios e IVA antes de la vista previa y envía
    `totalesEsperados`; `crearVenta` rechaza si difieren al céntimo (cambió tasa/IVA).
  - Reportes (consumo por cliente, gráfica de ventas totales) suman `ventas.total_*` (con IVA).
  - Formato: Bs con `es-VE`, `$` con `en-US`, igual en pantalla e impresora.
  - Regresión: `tests/venta-calculo.test.mjs`, `tests/qa-conciliacion.test.mjs`
    (320 escenarios pantalla = BD) y `tests/qa-ticket.test.mjs` (160 ventas, ticket = vista previa).
- Los reportes trabajan con **unidades** y montos, no con productos fijos.

### Seeders

- **`seeds/*.sql`**: catálogo base. Corre en cada arranque.
  - `001_catalogo.sql`: tipos Precio Full/Especial/Interno (margen 100%), solo si la tabla está vacía
  - `002_admin.sql`: usuario `admin` / `admin123`
  - `003_categorias_proveedor.sql`: 20 categorías de proveedores de repuestos (una sola vez)
  - `004_categorias_producto.sql`: 24 categorías de productos de repuestos (una sola vez)
  - `005_productos_categoria.sql`: asigna categoría a productos existentes desde su texto (una sola vez)
- **`seeds/dev/*.sql`**: datos de simulación (idempotentes). Solo con `SEED_DEMO=1`.

### Ejecutar seeders de simulación

```bash
# BD: ~/.config/venta-repuestos/venta-repuestos.db (Linux). Borrarla para empezar limpio.
npm run dev:demo
```

Archivos de simulación en `seeds/dev/`:
- `001_datos_demo.sql` — 5 clientes, 12 repuestos con costo de compra,
  2-4 precios de venta c/u y existencia inicial
- `002_consumo_clientes.sql` — dos clientes con historial para las gráficas:
  - **Cliente Fijo Uno** (V-11111111): 99 ventas 2024-01..2026-09, Precio 3. Tickets `T-A####`
  - **Cliente Fijo Dos** (V-22222222): 21 ventas 2025-01..2026-09, Precio 1. Tickets `T-B####`
  - Las ventas históricas no generan movimientos de inventario

## Rutas del renderer

| Ruta                    | Vista                    |
|------------------------|--------------------------|
| `/`                    | Login                    |
| `/menu`                | Menú principal           |
| `/venta`               | Punto de venta (buscador de producto + cards de precio; cobro en Bs) |
| `/inventario`          | Catálogo de productos (tabla, búsqueda, export XLSX, ficha modal ancha) |
| `/operaciones-inventario` | Operaciones de entrada y salida (existencias y ajustes) |
| `/indicadores`         | Indicadores (cards)      |
| `/ventas`              | Ventas del día           |
| `/ventas-totales`      | Ventas totales           |
| `/consumo-clientes`    | Tabla de consumo clientes|
| `/reportes-inventario` | Reportes de inventario: total / en mínimo, agrupado por categoría o proveedor |
| `/consumo-cliente-grafico` | Gráfico de un cliente |
| `/clientes`            | CRUD clientes            |
| `/proveedores`         | CRUD proveedores         |
| `/categorias-proveedor`| CRUD categorías de proveedores |
| `/categorias-producto` | CRUD categorías de productos |
| `/productos`           | Redirige a `/inventario` |
| `/tipos-precio`        | CRUD tipos de precio     |
| `/configuracion`       | Configuración            |
| `/impresora`           | Config impresora         |
| `/usuarios`            | CRUD usuarios            |
| `/sistema`             | Sistema                  |

## Menú y navegación

- **Menú principal**: Venta, Inventario, Operaciones, Indicadores
- **Indicadores**: Ventas del día, Ventas totales, Reportes de inventario, Consumo por cliente
- **Reportes de inventario** (`ReportesInventarioView.vue`): una pantalla con filtros
  Reporte (Inventario total | Productos en mínimo) × Agrupar (— | Categoría | Proveedor) ×
  filtro concreto (incluye "Sin categoría/proveedor"). Datos: `inventario:reporte`
  (`inventario.repo.reporteProductos`: productos activos con stock actual, categoría y el
  proveedor de su **última entrada**) + tasa BCV vigente. Cálculo puro y testeado en
  `src/shared/reporte.inventario.js`: en mínimo = `stock_minimo > 0 && stock <= stock_minimo`,
  faltante = `max(0, mínimo − stock)`, valor = stock × último costo, reposición = faltante ×
  costo; productos sin costo no suman (se avisa). Export XLSX con Resumen + Detalle
- **Operaciones**: Clientes, Proveedores, Operaciones de entrada y salida, Tipos de precio

## Red local (modo principal / esclavo)

La misma app corre en varias PCs de la oficina. Una PC es la **principal**
(dueña de la BD) y las demás son **esclavas** que trabajan contra ella por
HTTP dentro de la LAN. La BD nunca se comparte como archivo (nada de SMB).

- **Config por equipo**: `%APPDATA%/venta-repuestos/app-config.json`
  (`config.js`): `{ modo: 'servidor'|'cliente', servidor: 'IP', puerto: 8530,
  impresora: {...} }`. Se edita en `/sistema` → "Modo del equipo"; cambiarlo
  exige reiniciar la app. Por defecto todo equipo es `servidor` (monopuesto,
  igual que antes).
- **Servidor (principal)**: corre migraciones/seeds, abre SQLite y levanta
  `server/api.server.js` (`node:http`, puerto 8530): `GET /api/health`,
  `POST /api/login`, `POST /api/logout`, `POST /api/invoke`.
- **Esclavo**: no abre BD ni corre seeds. En `client/local.ipc.js`
  (`prepararModoCliente`) todos los canales se sustituyen por un proxy HTTP
  (`client/proxy.js`, `fetch` con `Authorization: Bearer <token>`), salvo los
  **locales**: `auth:*`, `appConfig:*`, `impresora:*` y `sistema:version` —
  la impresión siempre sale por la impresora de la PC donde está configurada
  (pide los datos al servidor con `impresora:datos*` —incluido el bloque
  `negocio`— y arma el documento localmente).
- **Registro único de canales** (`ipc/registro.js`): todos los handlers se
  registran con `registrar()` en un mapa; `instalarIpc()` los expone por
  `ipcMain.handle` y el servidor los ejecuta por `invoke`. Un solo handler
  sirve IPC local y HTTP — no duplicar canales.
- **Sesiones** (`auth.service.js`): tokens **sin vencimiento** (red local);
  mueren al cerrar sesión o reiniciar el servidor. `usuarioActual` = ventana
  del servidor, `sesiones` = tokens de esclavos, `sesionCliente` = sesión de
  esta PC esclava. `actorActual()` los resuelve en ese orden vía
  `AsyncLocalStorage` (`ipc/contexto.js`), así las guardas `conPermiso`
  aplican igual por IPC que por HTTP, y peticiones concurrentes no se mezclan.
- **Imports de Electron**: los módulos que se cargan también en tests o en
  modo esclavo importan de `main/electron-safe.js` (destructuring seguro
  sobre el CJS real), nunca `import { x } from 'electron'` directo.
- **Refresco en vivo (WebSocket)**: `server/ws.server.js` es un RFC 6455
  mínimo sin dependencias sobre el mismo puerto HTTP (`GET /ws?token=...`,
  rechaza tokens inválidos). `eventos.js` mapea cada canal de escritura a un
  grupo (`ventas`, `inventario`, `catalogo`, `clientes`, `proveedores`,
  `usuarios`, `tasas`, `caja`, `config`, `todo`); `registro.js` envuelve los
  handlers con `conEvento`, así **cualquier escritura exitosa — local o por
  invoke — difunde el evento** a esclavos y a la ventana del servidor
  (`webContents.send('evento:remoto')`). El esclavo se conecta tras el login
  (`client/proxy.js`, `WebSocket` global de Node, reintento cada 5 s con
  sesión viva). En el renderer: `api.eventos.on(cb)` + composable
  `alCambiar(tipos, cb)` (`useEventos.js`); las vistas se recargan sin tocar
  su estado (en VentaView solo `cargarCatalogo`, nunca el carrito).
- **Caja compartida**: una sola caja del día para todas las PCs (una BD →
  `abrirCajaDelDia` reutiliza la caja abierta por cualquier usuario).
- **Tests**: `tests/api-server.test.mjs` (health, login HTTP, invoke con
  token, guardas por rol vía HTTP, venta remota en la BD, auth:* no expuesto,
  WS: rechazo sin token, eventos en escrituras remotas y locales, lecturas
  y errores no emiten), `tests/app-config.test.mjs` (config por equipo).

### Despliegue en la oficina

1. Mismo instalador (`npm run build:win`) en las 3 PCs.
2. PC principal: IP fija o reserva DHCP (ej. `192.168.1.10`), regla de
   firewall de entrada al puerto 8530, app en el arranque de Windows.
3. En cada esclava: `/sistema` → modo Esclavo + IP del servidor + "Probar
   conexión" → reiniciar la app.
4. La impresora se configura en cada PC (`/impresora`): el nombre de la
   impresora de oficina tal como aparece instalada en el sistema.

## Impresión

- Todo se imprime en **hoja carta** (Letter 216×279mm) en la impresora de
  oficina configurada en `/impresora`, vía `webContents.print()` en una
  ventana oculta (`documento.printer.js`): funciona con cualquier driver y
  en cualquier SO (no solo Windows). El módulo térmico `ticket.printer.js`
  queda como legado (su QA numérico sigue en `tests/qa-ticket.test.mjs`).
- Al finalizar la venta el usuario elige **1 o 2 copias**. Con 2 salen dos
  trabajos rotulados: **ORIGINAL** (cliente, "Gracias por su compra") y
  **COPIA** (tienda, líneas de firma). La misma elección está en Reimprimir
  de Ventas del día (`impresora:imprimirVenta(ventaId, copias)`).
- Encabezado: logo + datos del negocio configurables en `/configuracion` →
  "Datos del negocio" (claves `negocio_nombre/rif/direccion/telefono`,
  canales `configuracion:obtenerNegocio`/`guardarNegocio`). El bloque viaja
  dentro de `impresora:datos*` para que las esclavas impriman lo mismo.
- La factura va **SOLO en bolívares**: montos tal como quedaron guardados en
  la venta, nunca recalculados. La nota de entrega va en $ o Bs según la
  moneda elegida: `NOTA DE ENTREGA`/`Nro. NE-…`, sin desglose de IVA, método
  de pago ni tasas, y bloque RECIBIDO/FECHA/FIRMA fijo abajo a
  la izquierda. La reimpresión respeta `venta.tipo_documento` (una factura
  nunca sale como nota ni al revés). `tests/documento-venta.test.mjs` lo exige.
- Al cerrar caja se imprime automáticamente un **reporte Z** (ventas del
  día), también en hoja carta.

## Comandos

```bash
npm run dev      # Desarrollo (electron-vite dev)
npm run build    # Build de producción
npm run dev:demo # Desarrollo + seeders de simulación
```

> Si el terminal corre dentro de un editor basado en Electron y la app falla con
> `Cannot read properties of undefined (reading 'isPackaged')`, la variable
> `ELECTRON_RUN_AS_NODE=1` está heredada: `env -u ELECTRON_RUN_AS_NODE npm run dev`.

## Convenciones de código

- `async/await` (no `.then()`)
- Funciones arrow para callbacks
- Commits en inglés con Conventional Commits
- **Nunca ejecutar `git commit` salvo que el usuario lo pida explícitamente**
- Errores de impresión: devolver `{ ok, error }`
- Respuestas en español, conciso

### Moneda en reportes

- **Todos los reportes van en USD como monto principal, con el equivalente en Bs**
  (Ventas del día, Ventas totales y su gráfica, Consumo por cliente y su gráfica,
  Reportes de inventario, reporte diario impreso). Excepción: la **factura** (ticket de
  venta) va solo en Bs.
- En ventas el Bs es el **guardado** en la venta (`total_bs`, tasa congelada), no una
  reconversión con la tasa de hoy. En inventario (que no tiene tasa propia) se usa la tasa
  BCV vigente y la pantalla la indica.
- En tablas usar la clase global `.monto-dual` (`<strong>` USD + `<small>` Bs). En el
  reporte impreso, `filaMonto()` parte la línea en 58mm en vez de encimar montos.

### Roles y permisos

- **Matriz única en `src/shared/permisos.js`**: 3 roles (`sistema` = Admin de Sistema,
  `administrador`, `vendedor`) y permisos tipo `'catalogo.gestionar'`, `'inventario.gestionar'`,
  `'usuarios.gestionar'`, `'configuracion.gestionar'`, `'ventas.anular'`, `'ventas.crear'`,
  `'clientes.gestionar'`, `'reportes.ver'`.
- **Tabla `roles`** (migración `024_roles.sql`) con `asignable`: solo Administrador y
  Vendedor se asignan desde la pantalla Usuarios. El Admin de Sistema (usuario `admin`)
  es único y protegido: nadie lo edita, lo elimina ni crea otro.
- **Sesión y barrera real en el proceso principal**: `auth.service.js` guarda el usuario
  en sesión (`auth:login`/`auth:logout`, verifica contraseña scrypt) y
  `ipc/permisos.js` → `conPermiso('permiso', handler)` envuelve los IPC de escritura.
  Sin sesión → "Debes iniciar sesión"; sin permiso → "No tienes permiso…".
- **En el renderer** (solo comodidad visual): `usePermisos` → `puedeHacer(permiso)`;
  rutas con `meta.permiso` redirigen al menú (`router.beforeEach`); tarjetas del hub con
  `permiso` en `useConfiguracion.js` se ocultan; botones de crear/editar/entradas/anular
  se ocultan al vendedor.
- El vendedor: vende, gestiona clientes y consulta todo (incl. ficha de producto en
  modo solo lectura). NO: productos, entradas/ajustes, catálogos, usuarios,
  impresora/IVA/sistema, anular ventas.
- **"Restablecer base de datos"** (Configuración, pide contraseña del Admin de
  Sistema): `reiniciarBaseDeDatos()` en `db/connection.js` borra solo la actividad
  — ventas con detalle, cajas, cierres y tasas (lista `TABLAS_OPERATIVAS`) — y
  libera `venta_id` de los movimientos conservados.
  Conserva el catálogo cargado: productos (con precios y movimientos/stock),
  clientes, proveedores, categorías de productos y proveedores, usuarios, roles,
  tipos de precio y `configuracion` (IVA, impresora).
- Al agregar un IPC de escritura: envolverlo con `conPermiso` y cubrirlo en el test
  `tests/roles.test.mjs` ("todos los IPC que modifican…").

### Estándares de UI

- **Títulos de tablas**: usar la clase `.titulo-tabla` con `padding: 12px 16px`,
  `display: flex`, `align-items: center`, `min-height: 48px`. Los títulos deben
  quedar centrados verticalmente y con espacio respecto al borde superior de la
  card. No usar estilos inline sueltos (`style="margin: 0 0 12px"`).
- **Identidad visual Venta de Repuestos**: los tokens de color, fuentes, foco y
  botones están en `src/renderer/src/assets/main.css`. Usar `--primary` (grafito)
  para acciones, `--accent` (granate) para selección/marca, `--success` para stock
  y `--danger` para errores. No usar azules/naranjas de la antigua planta.
- **Marca**: `logo.png` (raíz y `src/renderer/src/assets/`) es el logo real del
  negocio (Trucks Alca C.A): aparece en login, cabecera, vista previa del ticket
  y favicon. `resources/logo.png` es la copia que el ticket térmico rasteriza a
  1 bit en `src/main/printer/ticket.printer.js` (72% del ancho imprimible,
  con respaldo en píxeles si el PNG no se puede leer). `resources/icon.png` y
  `build/icon.png|ico` son el isotipo del camión en cuadrado, para ventana e
  instalador. `marca-repuestos.svg/png` quedan como arte heredado sin referencias.
