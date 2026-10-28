-- Categoría del producto (relación con categorias_producto). Opcional: los
-- productos existentes quedan en NULL y el seed 005 los asigna una sola vez
-- a partir del texto libre que tenían en `descripcion`.
ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias_producto(id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
