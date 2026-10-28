-- Extiende el esquema inicial con lo que exige el flujo completo del POS
-- (ver Docs/casmar-pos-demo.html): tipo de pago y descripción por precio,
-- teléfono de cliente, anulación de ventas, monto total y vencimiento de
-- créditos, tasa histórica de cada pago, inventario de bolsas de hielo y
-- cierres de caja por turno.
-- Ver Docs/erd_pos_planta_hielo.html para el diagrama de referencia.

ALTER TABLE precios ADD COLUMN tipo_pago TEXT NOT NULL DEFAULT 'contado';
ALTER TABLE precios ADD COLUMN descripcion TEXT NOT NULL DEFAULT '';

ALTER TABLE clientes ADD COLUMN telefono TEXT;

ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'activa';
ALTER TABLE ventas ADD COLUMN anulado_en TEXT;
ALTER TABLE ventas ADD COLUMN anulado_motivo TEXT;

ALTER TABLE creditos ADD COLUMN total_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE creditos ADD COLUMN fecha_vencimiento TEXT;

ALTER TABLE pagos ADD COLUMN tasa_valor REAL;

CREATE TABLE inventario_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  tipo TEXT NOT NULL,
  cantidad REAL NOT NULL,
  saldo REAL NOT NULL,
  motivo TEXT NOT NULL,
  venta_id INTEGER REFERENCES ventas(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cierres_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_valor REAL NOT NULL,
  desde TEXT NOT NULL,
  hasta TEXT NOT NULL,
  total_contado_usd REAL NOT NULL,
  total_credito_usd REAL NOT NULL,
  total_cobrado_creditos_usd REAL NOT NULL,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_inventario_movimientos_producto ON inventario_movimientos(producto_id);
CREATE INDEX idx_inventario_movimientos_venta ON inventario_movimientos(venta_id);
CREATE INDEX idx_creditos_estado ON creditos(estado);
CREATE INDEX idx_cierres_caja_usuario ON cierres_caja(usuario_id);
