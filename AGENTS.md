# Venta de Repuestos - POS de Escritorio

> Derivado del POS de Planta de Hielo Cristal (v1.x). Desde v2.0 vende repuestos:
> catálogo abierto de productos, cada uno con N precios con nombre (ver
> `Docs/analisis-venta-repuestos.md`).

> **Plan vigente (pendiente de implementar)**: precios por márgenes con doble
> tasa BCV + USDT Binance — ver `Docs/plan-precios-margenes-tasas.md`. Reemplaza
> el modelo actual de precios fijos por producto. Fase 2 agregará IVA general.

## Stack

- **Electron** + **Vue 3** (`<script setup>`) + **Vue Router**
- **Vite / Electron Vite** como bundler
- **SQLite** con `better-sqlite3`
- Impresión térmica ESC/POS con `@maxxuxx/node-printer` (solo Windows, `winspool`)

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
│       └── ticket.printer.js # Construcción de tickets ESC/POS
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
  - `codigo_barras` es opcional y único cuando existe; los buscadores (catálogo,
    combobox de venta/operaciones y `productos.listar({texto})`) lo incluyen:
    escanear un código encuentra el producto directo
- **tasas_cambio**: id, valor (BCV legacy), valor_bcv, valor_usdt, usuario_id, fecha_hora — histórico auditable, la vigente es la última
- **tipos_precio**: id, nombre (UNIQUE), orden, margen_default (DEFAULT 100), activo
  - Nombres semilla: Precio Full, Precio Especial, Precio Interno
  - Solo se desactivan si tienen uso; nunca se borran con ventas asociadas
- **precios**: id, producto_id, tipo_precio_id, valor_usd, descripcion, margen, activo
  - UNIQUE(producto_id, tipo_precio_id). `margen` = % propio del producto (NULL → usa `margen_default` del tipo)
  - `valor_usd` está materializado: `round2(costo × (1+margen/100))`, recalculado al guardar entrada o cambiar márgenes/costo
- **ventas**: id, numero_ticket, cliente_id, usuario_id, tasa_valor (BCV), tasa_bcv, tasa_usdt, metodo_pago ('bs'|'usdt'), tipo_documento ('factura'|'nota_entrega'), iva_porcentaje, iva_usd, iva_bs, iva_usdt, total_usd, total_bs, total_usdt, estado, creado_en
  - `total_*` es el monto **final cobrado** (`base + IVA`); `iva_*` es el impuesto desglosado. Base = total − iva. Ventas anteriores a la migración 019 tienen `iva_*` en NULL
- **venta_detalle**: id, venta_id, precio_id, cantidad, precio_unitario_usd/bs/usdt, subtotal_usd/bs/usdt,
  margen_utilidad, producto_nombre, tipo_precio_nombre (snapshot completo)
- **inventario_movimientos**: producto_id, tipo, cantidad, saldo, motivo, costo_usd, proveedor_id, venta_id, usuario_id, creado_en
  - Stock de un producto = `saldo` del último movimiento; `costo_usd` = costo de esa compra (auditoría)
  - Entrada transaccional: movimiento + costo del producto + márgenes (`precios.margen`/`valor_usd`)
- **cajas**: tasa_apertura (BCV), tasa_apertura_usdt, tasa_cierre, tasa_cierre_usdt, ...

### Reglas de negocio de ventas

- Una línea del ticket = un producto. Primero se agrega sin precio, luego se
  selecciona la línea y se le asigna uno de sus precios de venta.
- **Precios por margen** (modelo aprobado, ver `Docs/plan-precios-margenes-tasas.md`):
  `precioUsd = round2(costo × (1+margen/100))` (markup sobre costo, 100% = doble);
  `precioBs = round2(precioUsd × tasa_bcv)` (canónico); `precioUsdt = round2(precioBs ÷ tasa_usdt)`.
  Única fuente: `services/precios.calculo.js` (backend) y `composables/usePrecios.js` (preview).
- `ventas.service.crearVenta` lee las tasas vigentes de la BD (no del renderer),
  toma el precio unitario materializado, **bloquea la venta si la suma de unidades
  de un producto supera su stock**, guarda snapshot completo (márgenes, tasas,
  método de pago) y registra venta + salidas en una transacción. Anular devuelve stock.
- **Tipo de documento** (`ventas.tipo_documento`, migración 023): `factura` (default, con IVA)
  o `nota_entrega` (todo igual — precios, tasas, stock, ticket — pero **IVA 0**: `crearVenta`
  usa 0% y total = subtotal). Correlativos independientes: facturas `T-0001…`, notas `NE-0001…`.
  En la pantalla de venta un selector Factura / Nota de entrega (store `tipoDocumento`, se
  reinicia con el ticket); `ivaPorcentaje` es 0 en nota, así cards, carrito, buscador y vista
  previa salen sin IVA. El ticket de la nota dice `NOTA DE ENTREGA` / `Nro. NE-…` y solo TOTAL
  Bs. El reporte Z cuenta facturas y notas. Tests: `tests/nota-entrega.test.mjs`.
- La venta cobra **un solo método de pago**: `bs` (BCV) o `usdt` (Binance).
  `total_bs` siempre se guarda (canónico); el ticket imprime **solo bolívares**.
- **IVA general** (configuración `iva_porcentaje`, default 16, editable en
  `/configuracion` → Impuestos). **Única fuente: `src/shared/venta.calculo.js`**
  (`calcularLinea`, `calcularTotales`), importada por la pantalla de venta
  (PriceCard, CartItem, ProductoCombobox, vista previa) y por `crearVenta`.
  Nunca duplicar este cálculo.
  - IVA **por unidad** y por moneda: `ivaUnit = r2(base×iva%)`,
    `conIva = r2(base+ivaUnit)`; línea: `subtotal = r2(base×q)`,
    `iva = r2(ivaUnit×q)`, `total = subtotal+iva` (= `conIva×q`). Totales = suma de líneas.
  - **Pantalla de venta**: precios CON IVA (cards, c/u y subtotal de línea, rango del buscador).
  - **Factura** (vista previa = ticket impreso): líneas SIN IVA, luego
    `Subtotal / IVA X% / TOTAL`, todo en Bs (nada de dólares en la factura).
  - `venta_detalle` guarda unitario/subtotal SIN IVA; `ventas.iva_*`/`total_*` los totales.
  - `finalizarVenta` refresca precios e IVA antes de la vista previa y envía
    `totalesEsperados`; `crearVenta` rechaza si difieren al céntimo (cambió tasa/IVA).
  - Reportes (consumo por cliente, gráfica de ventas totales) suman `ventas.total_*` (con IVA).
  - Formato: Bs y USDT con `es-VE`, `$` con `en-US`, igual en pantalla e impresora.
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
| `/venta`               | Punto de venta (buscador de producto + cards de precio + método de pago) |
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
  la impresión siempre sale por `winspool` de la PC donde está la impresora
  (pide los datos al servidor con `impresora:datos*` y arma el ticket local).
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
4. La impresora se configura en cada PC (`/impresora`): nombre `winspool`
   local y ancho 58/80mm.

## Impresión

- Por cada venta se imprimen **2 tickets**: copia cliente y copia tienda
- La factura (ticket de venta y su vista previa) va **SOLO en bolívares**, pague
  en Bs o en USDT: sin montos en $/USDT ni tasas. `tests/qa-ticket.test.mjs` lo exige.
  La pantalla de venta (cards, carrito, totales) sí muestra Bs, $ y USDT.
- Ítems: `cantidad x producto` + `tipo - precio c/u` + subtotal. Usar `wrap()` para textos
  largos: `leftRight()`/`keyValue()` superponen texto si no cabe (en 58mm generaba montos falsos)
- Al cerrar caja se imprime automáticamente un **reporte Z** (ventas del día)
- Anchos soportados: 58mm y 80mm
- La impresión real solo funciona en Windows (`winspool`)

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
  Sistema): `reiniciarBaseDeDatos()` en `db/connection.js` borra ventas, precios,
  productos, clientes, proveedores, movimientos, cajas y tasas (lista
  `TABLAS_OPERATIVAS`). Conserva categorías de productos y proveedores, usuarios,
  roles, tipos de precio y `configuracion` (IVA, impresora).
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
