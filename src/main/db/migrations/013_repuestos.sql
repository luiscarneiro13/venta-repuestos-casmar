-- Adaptación del esquema a venta de repuestos (ver Docs/analisis-venta-repuestos.md).
--
-- 1. productos pasa a ser un catálogo abierto con CRUD: código (SKU) único,
--    marca, descripción y bandera "activo" (los productos con ventas no se
--    borran, se desactivan). El nombre deja de ser UNIQUE: puede haber el
--    mismo repuesto de marcas distintas.
-- 2. tipos_precio pasa a ser la lista global de NOMBRES de precio (Detal,
--    Mayor, Taller...) con un orden de presentación.
-- 3. precios: un precio por (producto, tipo de precio). Se elimina "codigo"
--    (la etiqueta visible ahora es "Producto · Tipo"). "activo" permite
--    retirar un precio que ya tiene ventas sin romper el historial.
-- 4. venta_detalle congela el nombre del producto y del tipo de precio, para
--    que tickets y reportes históricos no cambien si luego se renombran.

-- ---------- 1. productos ----------
CREATE TABLE productos_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE,
  nombre TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  unidad_medida TEXT NOT NULL DEFAULT 'unidad',
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO productos_nuevo (id, nombre, unidad_medida)
SELECT id, nombre, unidad_medida FROM productos;

DROP TABLE productos;
ALTER TABLE productos_nuevo RENAME TO productos;

CREATE INDEX idx_productos_nombre ON productos(nombre);

-- ---------- 2. tipos_precio ----------
ALTER TABLE tipos_precio ADD COLUMN orden INTEGER NOT NULL DEFAULT 0;

-- ---------- 3. precios ----------
CREATE TABLE precios_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo_precio_id INTEGER NOT NULL REFERENCES tipos_precio(id),
  valor_usd REAL NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1,
  UNIQUE (producto_id, tipo_precio_id)
);

-- La BD de repuestos arranca limpia (archivo nuevo), así que normalmente no
-- hay filas que copiar. OR IGNORE evita fallar si existieran varios precios
-- del mismo producto y tipo (esquema anterior).
INSERT OR IGNORE INTO precios_nuevo (id, producto_id, tipo_precio_id, valor_usd, descripcion)
SELECT id, producto_id, tipo_precio_id, valor_usd, descripcion FROM precios;

DROP TABLE precios;
ALTER TABLE precios_nuevo RENAME TO precios;

CREATE INDEX idx_precios_producto ON precios(producto_id);

-- ---------- 4. venta_detalle ----------
ALTER TABLE venta_detalle ADD COLUMN producto_nombre TEXT;
ALTER TABLE venta_detalle ADD COLUMN tipo_precio_nombre TEXT;
