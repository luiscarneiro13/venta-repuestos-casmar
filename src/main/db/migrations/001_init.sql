-- Esquema inicial. Ver Docs/erd_pos_planta_hielo.html para el diagrama de referencia.

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'vendedor',
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasas_cambio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  valor REAL NOT NULL,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now')),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id)
);

CREATE TABLE tipos_precio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  unidad_medida TEXT NOT NULL
);

CREATE TABLE precios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo_precio_id INTEGER NOT NULL REFERENCES tipos_precio(id),
  codigo TEXT NOT NULL UNIQUE,
  valor_usd REAL NOT NULL
);

CREATE TABLE clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  numero_documento TEXT UNIQUE,
  dias_credito_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero_ticket TEXT NOT NULL UNIQUE,
  cliente_id INTEGER REFERENCES clientes(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_pago TEXT NOT NULL,
  tasa_valor REAL NOT NULL,
  total_usd REAL NOT NULL,
  total_bs REAL NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE venta_detalle (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id),
  precio_id INTEGER NOT NULL REFERENCES precios(id),
  cantidad REAL NOT NULL,
  subtotal_usd REAL NOT NULL
);

CREATE TABLE creditos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  saldo_usd REAL NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
);

CREATE TABLE pagos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER REFERENCES ventas(id),
  credito_id INTEGER REFERENCES creditos(id),
  tipo TEXT NOT NULL,
  monto_usd REAL NOT NULL,
  metodo_pago TEXT NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_precios_producto ON precios(producto_id);
CREATE INDEX idx_venta_detalle_venta ON venta_detalle(venta_id);
CREATE INDEX idx_ventas_cliente ON ventas(cliente_id);
CREATE INDEX idx_creditos_cliente ON creditos(cliente_id);
CREATE INDEX idx_pagos_venta ON pagos(venta_id);
