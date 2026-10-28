-- productos.nombre carecía de UNIQUE: el seed de catálogo (INSERT OR IGNORE
-- en cada arranque, ver src/main/db/seeds/001_catalogo.sql) duplicaría
-- "Hielo"/"Agua" en cada inicio de la app sin este constraint.
-- Reconstruye la tabla preservando los ids ya referenciados por
-- precios.producto_id e inventario_movimientos.producto_id; si existieran
-- duplicados previos, conserva el id más bajo de cada nombre y reapunta
-- las referencias antes de eliminar el resto.

CREATE TABLE productos_nuevo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  unidad_medida TEXT NOT NULL
);

INSERT INTO productos_nuevo (id, nombre, unidad_medida)
SELECT MIN(id), nombre, MAX(unidad_medida) FROM productos GROUP BY nombre;

UPDATE precios SET producto_id = (
  SELECT pn.id FROM productos_nuevo pn
  JOIN productos po ON po.nombre = pn.nombre
  WHERE po.id = precios.producto_id
)
WHERE producto_id NOT IN (SELECT id FROM productos_nuevo);

UPDATE inventario_movimientos SET producto_id = (
  SELECT pn.id FROM productos_nuevo pn
  JOIN productos po ON po.nombre = pn.nombre
  WHERE po.id = inventario_movimientos.producto_id
)
WHERE producto_id NOT IN (SELECT id FROM productos_nuevo);

DROP TABLE productos;
ALTER TABLE productos_nuevo RENAME TO productos;
