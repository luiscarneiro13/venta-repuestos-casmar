-- Elimina todo lo relacionado a créditos y pagos: el sistema ahora solo
-- maneja ventas de contado. Las tablas creditos y pagos se eliminan por
-- completo, y se quitan las columnas de créditos de clientes, ventas,
-- precios y cierres_caja. Las columnas se reconstruyen sin esas columnas
-- porque SQLite no soporta DROP COLUMN en versiones antiguas.

-- 1. Eliminar tablas de créditos y pagos
DROP TABLE IF EXISTS pagos;
DROP TABLE IF EXISTS creditos;

-- 2. Reconstruir clientes sin dias_credito_default
CREATE TABLE clientes_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  numero_documento TEXT UNIQUE,
  telefono TEXT
);

INSERT INTO clientes_nuevo (id, nombre, numero_documento, telefono)
SELECT id, nombre, numero_documento, telefono FROM clientes;

DROP TABLE clientes;
ALTER TABLE clientes_nuevo RENAME TO clientes;

-- 3. Reconstruir precios sin tipo_pago (siempre contado)
CREATE TABLE precios_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo_precio_id INTEGER NOT NULL REFERENCES tipos_precio(id),
  codigo TEXT NOT NULL UNIQUE,
  valor_usd REAL NOT NULL,
  descripcion TEXT NOT NULL DEFAULT ''
);

INSERT INTO precios_nuevo (id, producto_id, tipo_precio_id, codigo, valor_usd, descripcion)
SELECT id, producto_id, tipo_precio_id, codigo, valor_usd, descripcion FROM precios;

DROP TABLE precios;
ALTER TABLE precios_nuevo RENAME TO precios;

CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios(producto_id);

-- 4. Reconstruir ventas sin tipo_pago (siempre contado)
CREATE TABLE ventas_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_ticket TEXT NOT NULL UNIQUE,
  cliente_id INTEGER REFERENCES clientes(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_valor REAL NOT NULL,
  total_usd REAL NOT NULL,
  total_bs REAL NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa',
  anulado_en TEXT,
  anulado_motivo TEXT,
  anulado_por_usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO ventas_nuevo (id, numero_ticket, cliente_id, usuario_id, tasa_valor, total_usd, total_bs, estado, anulado_en, anulado_motivo, creado_en)
SELECT id, numero_ticket, cliente_id, usuario_id, tasa_valor, total_usd, total_bs, estado, anulado_en, anulado_motivo, creado_en FROM ventas;

DROP TABLE ventas;
ALTER TABLE ventas_nuevo RENAME TO ventas;

CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);

-- 5. Reconstruir cierres_caja sin totales de crédito ni cobrado
CREATE TABLE cajas_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_apertura REAL NOT NULL,
  abierta_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  estado TEXT NOT NULL DEFAULT 'abierta',
  usuario_cierre_id INTEGER REFERENCES usuarios(id),
  tasa_cierre REAL,
  cerrada_en TEXT,
  total_contado_usd REAL,
  total_contado_bs REAL
);

INSERT INTO cajas_nuevo (id, usuario_apertura_id, tasa_apertura, abierta_en, estado, usuario_cierre_id, tasa_cierre, cerrada_en, total_contado_usd, total_contado_bs)
SELECT id, usuario_apertura_id, tasa_apertura, abierta_en, estado, usuario_cierre_id, tasa_cierre, cerrada_en, total_contado_usd, total_contado_bs FROM cajas;

DROP TABLE cajas;
ALTER TABLE cajas_nuevo RENAME TO cajas;

CREATE INDEX IF NOT EXISTS idx_cajas_estado ON cajas(estado);
