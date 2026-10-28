-- Categorías de proveedores (rubro que surte: motor, frenos, eléctrico...).
-- Catálogo editable desde Operaciones → Categorías de proveedores.
CREATE TABLE categorias_proveedor (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL COLLATE NOCASE UNIQUE,
  descripcion TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1
);
