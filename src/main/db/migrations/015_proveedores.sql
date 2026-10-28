CREATE TABLE proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL COLLATE NOCASE UNIQUE,
  documento TEXT UNIQUE,
  telefono TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE inventario_movimientos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
CREATE INDEX idx_inventario_proveedor ON inventario_movimientos(proveedor_id);
