-- Ubicación física del producto en el almacén (estante, nivel, góndola...).
-- Opcional: ayuda a encontrar el repuesto rápido en un catálogo grande.
ALTER TABLE productos ADD COLUMN ubicacion TEXT;
