-- Categorías de productos (familia del repuesto: frenos, filtros, eléctrico...).
-- Catálogo editable desde Operaciones → Categorías de productos.
CREATE TABLE categorias_producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL COLLATE NOCASE UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1
);
