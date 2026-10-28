-- Asigna UNA sola vez la categoría a los productos que existían antes de la
-- relación productos.categoria_id, a partir del texto libre que tenían en
-- `descripcion` (antes "Categoría / descripción"). Coincidencia, en orden:
-- nombre exacto, la categoría empieza con el texto ("Correas" → "Correas y
-- cadenas") o lo contiene ("Eléctrico" → "Sistema eléctrico"). Lo que no
-- coincide queda sin categoría para asignarlo a mano.
UPDATE productos
SET categoria_id = (
  SELECT cp.id FROM categorias_producto cp
  WHERE cp.activo = 1 AND trim(productos.descripcion) != ''
    AND instr(lower(cp.nombre), lower(trim(productos.descripcion))) > 0
  ORDER BY
    CASE
      WHEN lower(cp.nombre) = lower(trim(productos.descripcion)) THEN 0
      WHEN instr(lower(cp.nombre), lower(trim(productos.descripcion))) = 1 THEN 1
      ELSE 2
    END,
    length(cp.nombre)
  LIMIT 1
)
WHERE categoria_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'seed_productos_categoria');

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('seed_productos_categoria', '1');
