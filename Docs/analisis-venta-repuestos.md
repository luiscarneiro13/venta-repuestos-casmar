# Análisis: adaptación del POS de planta de hielo a venta de repuestos

## 1. Qué se mantiene (sin cambios funcionales)

| Módulo | Estado |
|---|---|
| Login / usuarios / roles | ✅ Igual |
| Configuración (tasa del día, datos de empresa) | ✅ Igual |
| Impresora térmica (58/80mm, 2 tickets, reporte Z) | ✅ Igual (solo cambia el contenido de las líneas del ticket) |
| Caja (apertura, cierre, reporte Z) | ✅ Igual |
| Clientes (CRUD + combobox con crear-desde-venta) | ✅ Igual |
| Ventas del día / anulación / reimpresión | ✅ Igual |
| Consumo por cliente (tabla + gráfico) | ✅ Igual (funciona por nombre de producto, genérico) |
| Inventario (movimientos entrada/salida) | ⚠️ La lógica genérica sirve; hay que quitar los casos especiales de hielo/agua |
| Ventas totales (gráfico) | ⚠️ Requiere adaptación: hoy agrupa "hielo / botellones" fijo |

## 2. Qué cambia

### 2.1 Modelo mental actual vs. nuevo

**Hoy (hielo):** el "ítem vendible" es el **precio**. La grilla de venta muestra tarjetas de
precios (`Precio hielo 10`, `Precio hielo 5`…), separadas en 2 pestañas
(`Planta hielo` / `Calle`) que **no se pueden mezclar** en un mismo ticket.
Los productos son solo 2 fijos ("Hielo", "Botellón de Agua"), sin CRUD.

**Nuevo (repuestos):** el producto pasa a ser el centro y la navegación es por
búsqueda, no por grilla fija. El flujo aprobado (ver mockup interactivo
`Docs/mockup-venta-repuestos.html`):

1. Seleccionar o crear el **cliente** (ya existe, igual que hoy).
2. **Buscar el producto** en un combobox (mismo patrón del `ClienteCombobox`
   actual): se escribe, se despliega la lista con coincidencias por nombre,
   código o marca, y se selecciona uno.
3. Al seleccionarlo, **debajo del buscador aparecen las cards de precios** de
   ese producto (Detal, Mayor, Taller, … cada una con valor USD, equivalente en
   Bs y su condición). Click en una card → entra al ticket; click de nuevo →
   se quita.

Un mismo ticket puede mezclar productos distintos y, por cada producto, se elige
un tipo de precio. Desaparece la restricción de "no mezclar categorías"
(`seleccionarCategoria` en `store/venta.js`).

### 2.2 Modelo de datos

Cambios mínimos — el esquema actual ya es muy cercano:

```
productos (
  id, nombre, codigo TEXT UNIQUE,   -- SKU / referencia (NUEVO)
  marca TEXT, descripcion TEXT,      -- NUEVOS
  unidad_medida
)

tipos_precio (                      -- Sin cambio de estructura
  id, nombre                        -- Ahora son NOMBRES de precio:
)                                   -- "Detal", "Mayor", "Taller", ...

precios (
  id,
  producto_id REFERENCES productos,      -- igual
  tipo_precio_id REFERENCES tipos_precio,-- igual
  valor_usd,
  UNIQUE(producto_id, tipo_precio_id)    -- NUEVO: un precio por producto/tipo
)
-- SE ELIMINA: codigo (el "Precio hielo 10" deja de existir;
-- la etiqueta visible ahora es "Producto · Detal")
-- SE PUEDE MANTENER: descripcion como nota opcional
```

Clave del diseño: `precios` sigue siendo la entidad a la que apunta
`venta_detalle.precio_id`, por lo que **todo el backend de
ventas/caja/reportes/compensación de inventario sigue funcionando** — la fila de
`precios` sigue identificando unívocamente "producto + tipo de precio".

**Migraciones nuevas (013+):**
- `013_productos_catalogo.sql`: agregar `codigo`, `marca`, `descripcion` a
  `productos`; permitir CRUD.
- `014_precios_unicidad.sql`: drop de `codigo` (o hacerlo nullable), índice
  único `(producto_id, tipo_precio_id)`.
- `015_venta_detalle_snapshot.sql`: agregar `tipo_precio_nombre TEXT` a
  `venta_detalle` (ya existe `producto_nombre`; se congela también el nombre del
  tipo de precio para que tickets y reportes históricos no cambien si luego se
  renombra un tipo de precio).

**Semilla:** reemplazar `seeds/*.sql` (hielo/agua) por catálogo de repuestos +
tipos de precio (Detal, Mayor, Taller…). Mantener la convención idempotente con
`INSERT OR IGNORE`.

### 2.3 Cambios por capa

| Capa | Archivo(s) | Cambio |
|---|---|---|
| Repo | `productos.repo.js` | CRUD completo (hoy solo `listar`) |
| Repo | `precios.repo.js` | `listar()` sin `JOIN tipos_precio` como "categoría" — ahora se ordena por producto; agregar `listarPorProducto(productoId)` |
| Repo | `tiposPrecio.repo.js` | CRUD de tipos de precio (nombres de precio) |
| Service | `ventas.service.js` | Sin cambio de lógica; el comentario especial hielo/agua desaparece. Validar stock disponible por producto antes de vender (opcional, hoy no se valida) |
| IPC / preload | `productos.ipc.js`, `precios.ipc.js`, `tiposPrecio.ipc.js` | Exponer los nuevos CRUD en `window.api.*` |
| Renderer | `pages/ProductosView.vue` (NUEVA) | CRUD de productos + sus precios por tipo (ver §4) |
| Renderer | `pages/PreciosView.vue` | Se puede eliminar (los precios viven dentro del producto) o mantener como vista consolidada; recomendado: convertirla en "Tipos de precio" (CRUD de nombres) |
| Renderer | `pages/VentaView.vue` | Rediseño del flujo (ver §3) |
| Renderer | `store/venta.js` | Quitar restricción de mezcla de categorías; guardar `{precioId, cantidad}` igual que hoy (sigue siendo suficiente) |
| Impresión | `ticket.printer.js` | Línea del item: `cantidad × producto_nombre (tipo_precio)` en vez de `cantidad × codigo` |
| Reportes | `ventas.repo.js` → gráfico ventas totales | Reemplazar las series fijas `hielo/botellones` por "unidades vendidas por producto" (top N) o solo USD vendido |
| Inventario | `inventario.*` | Quitar `estadoHielo()` y la producción de hielo; cada producto tiene entradas (compras) y salidas (ventas) genéricas. El aviso de stock en la venta pasa a mostrar el stock del producto en su tarjeta |
| Seeds dev | `seeds/dev/*.sql` | Reescribir con productos de repuestos y sus N precios |

## 3. Nuevo flujo de la pantalla de ventas (aprobado)

La pantalla conserva el layout de 2 columnas: **ticket a la izquierda**,
**interacción de producto a la derecha**. Flujo del lado derecho:

```
┌ Estado inicial ──────────────────────────┐
│  [ ⌕ Buscar producto por nombre, código… ]│   ← SOLO el buscador.
└───────────────────────────────────────────┘     No hay grilla ni pestañas.

┌ Al escribir ─────────────────────────────┐
│  [ ⌕ filtro_____________________________ ]│
│ ┌ dropdown ──────────────────────────────┐│
│ │ Filtro de aceite Corolla …  14 disp.   ││
│ │ FO-1089 · Fram · 4 precios ($6,90–8)   ││
│ │ Filtro de aire Silverado …  11 disp.   ││
│ └────────────────────────────────────────┘│
└───────────────────────────────────────────┘

┌ Producto seleccionado ───────────────────┐
│  [ ⌕ Filtro de aceite Corolla 2009–2018  ]│
│  Filtro de aceite Corolla 2009–2018  [×Quitar]
│  FO-1089 · Fram · 14 disponibles          │
│  ┌─Detal──┐ ┌─Mayor──┐ ┌─Taller─┐         │
│  │ $8,00  │ │ $7,20  │ │ $7,60  │  …      │
│  │Bs3.364 │ │Bs3.027 │ │Bs3.195 │         │
│  └────────┘ └────────┘ └────────┘         │
└───────────────────────────────────────────┘
   Click en card = agrega «Producto · Tipo» al ticket
   (click de nuevo = quita; la card muestra «✓ en el ticket»)
```

Detalles de comportamiento:

1. **Estado inicial** — solo el buscador (con un mensaje guía debajo). No hay
   grilla de productos fija ni pestañas de categoría.
2. **Búsqueda** — dropdown con coincidencias live por nombre, código o marca;
   cada ítem muestra stock disponible, cantidad de precios y rango $mín–$máx.
3. **Producto seleccionado** — debajo del buscador se muestra su encabezado
   (nombre, código, marca, stock) y **sus cards de precio** (mismo estilo de las
   `PriceCard` actuales: nombre del precio, USD grande, Bs, condición). El botón
   «× Quitar» libera la selección y devuelve al estado inicial.
4. **Cards de precio** — click agrega la línea al ticket como
   `Producto · Tipo de precio`; click de nuevo la quita. Si el producto tiene un
   solo precio igualmente se muestra su card (comportamiento uniforme).
5. **Ticket** — cada línea muestra el nombre del producto con un tag del tipo de
   precio elegido, cantidad (mismo control +/− e input), subtotal USD/Bs. Sirve
   para mezclar productos y tipos de precio distintos en un mismo ticket.
6. **Finalizar venta / vista previa / imprimir / errores de impresión** — flujo
   idéntico al actual (2 copias, modal de vista previa, reintento).

Mockup interactivo con este flujo exacto: `Docs/mockup-venta-repuestos.html`.

### Cambios en el renderer para este flujo

- `store/venta.js`: se elimina `categoriaActivaId`, `seleccionarCategoria`,
  `inicializarCategoriaSiVacia` (ya no hay categorías-restricción). El carrito
  sigue guardando `{precioId, cantidad}` — `precioId` identifica
  producto + tipo de precio por lo que el resto del pipeline no cambia.
  Se agrega `productoActivo` (el producto seleccionado en el combobox).
- `VentaView.vue`: la columna derecha pasa de pestañas + grilla de `PriceCard`
  a: `ProductoCombobox` (nuevo, hermano del `ClienteCombobox`) + grilla de
  `PriceCard` del producto seleccionado. `PriceCard` se adapta para mostrar el
  nombre del tipo de precio en vez del `codigo`.
- Componente nuevo `ProductoCombobox.vue`: input con dropdown filtrado
  (nombre/código/marca), muestra stock y rango de precios por ítem.
- El dato a precargar: `window.api.productos.listar()` debe traer además
  `stock` (saldo de `inventario_movimientos`) para el dropdown, o exponerse por
  separado (`productos.listarConStock`).

## 4. Pantalla de productos (CRUD) — cómo se ingresan los precios

Reemplaza el "CRUD de precios" actual:

- Lista de productos con buscador (nombre, código, marca), botón "+ Nuevo producto".
- Al crear/editar un producto, el modal tiene: nombre, código, marca, unidad, y
  una **lista dinámica de precios**: por cada tipo de precio existente (Detal,
  Mayor, …) un campo de valor USD. Se deja vacío el que no aplique — así un
  producto puede tener 1, 3 o N precios.
- Los "tipos de precio" se administran aparte (nombre y nada más). Agregar uno
  nuevo (ej. "Crédito 30 días") lo hace disponible en todos los productos.

## 5. Decisiones a confirmar antes de implementar

1. **¿Tipos de precio globales o nombres libres por producto?**
   Recomendado: globales (Detal/Mayor/Taller…) — la mayoría de los repuestos
   comparten los mismos nombres de precio, facilita reportes y la unicidad
   `(producto, tipo)`. Si cada producto necesita nombres distintos, la tabla
   sería `precios (producto_id, nombre_libre, valor_usd)` sin `tipos_precio`.
2. **¿Validar stock al vender?** Hoy nunca se valida (el botellón queda
   negativo a propósito). En repuestos suele quererse bloquear o al menos
   advertir al llegar a 0.
3. **¿Arrancar con BD nueva o migrar datos del hielo?** Lo más limpio para el
   negocio nuevo: BD limpia + seeds nuevos (el historial del hielo se preserva
   aparte). Migrar ventas viejas al catálogo nuevo no tiene mucho valor.
4. **¿Busqueda por código de barra / lector?** Si manejan lector, conviene
   agregar `codigo_barras` a productos desde el inicio.
5. **¿Un solo precio por tipo de precio en una misma línea, o permitir el mismo
   producto 2 veces con precios distintos?** Recomendado (y así está en el
   mockup): una línea por (producto, tipo) — el click en la card agrega/quita
   esa combinación, y la cantidad se edita en la línea del ticket.

## 6. Estimación por módulo (orden sugerido)

1. Migraciones 013–015 + seeds nuevos (base de todo).
2. Backend: repos/services/IPC/preload de productos y precios.
3. `ProductosView` (CRUD) + gestión de tipos de precio.
4. `VentaView` rediseñada + `store/venta.js` + modal de selección de precio.
5. Impresión de ticket (líneas con producto + tipo).
6. Inventario genérico (sin especiales de hielo).
7. Reportes: ventas totales adaptado; verificación del resto.
8. Seeds de demo (`SEED_DEMO=1`) con repuestos realistas.
