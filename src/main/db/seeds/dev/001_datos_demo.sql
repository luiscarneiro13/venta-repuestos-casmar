-- Datos de ejemplo para desarrollo/pruebas: clientes, catálogo de repuestos
-- con inventario mínimo, precios materializados por margen y existencia
-- inicial de inventario.
--
-- Requiere que src/main/db/seeds/*.sql ya haya corrido (usuario admin y
-- tipos de precio Precio Full / Precio Especial / Precio Interno). Se dispara
-- solo con SEED_DEMO=1 (ver src/main/db/seed.js), nunca en producción.
-- Clientes, productos y precios son idempotentes (UNIQUE); el inventario
-- inicial solo se carga si el producto todavía no tiene movimientos.
--
-- Los precios siguen el modelo de márgenes: precios.margen es el % propio del
-- producto (markup sobre el costo) y valor_usd = round2(costo × (1+margen/100)).

INSERT OR IGNORE INTO clientes (nombre, tipo_documento, numero_documento, telefono, direccion) VALUES
  ('Autoservicio El Rápido C.A.', 'J', '305123456', '04141234567', 'EL TIGRE'),
  ('Taller Mecánico Los Hermanos', 'J', '409988771', '04249876543', 'EL TIGRE'),
  ('José Rodríguez', 'V', '8765432', '04125566778', 'EL TIGRE'),
  ('Transporte Oriente C.A.', 'J', '298877662', '04163344556', 'EL TIGRE'),
  ('María Fernández', 'V', '11223344', '04147788990', 'EL TIGRE');

INSERT OR IGNORE INTO productos (codigo, codigo_barras, nombre, marca, descripcion, unidad_medida, precio_compra_usd, stock_minimo) VALUES
  ('FO-1089', '7591001000017', 'Filtro de aceite Corolla 2009-2018', 'Fram', 'Filtros', 'unidad', 5.00, 4),
  ('FA-8120', '7591001000024', 'Filtro de aire Silverado 5.3', 'Fram', 'Filtros', 'unidad', 7.00, 4),
  ('PF-2041', '7591001000031', 'Pastillas de freno delanteras Aveo', 'ACDelco', 'Frenos', 'juego', 8.00, 3),
  ('DF-3310', NULL, 'Disco de freno delantero Hilux', 'Brembo', 'Frenos', 'unidad', 25.00, 2),
  ('BJ-0017', '7591001000055', 'Bujía NGK BKR5E-11', 'NGK', 'Encendido', 'unidad', 2.00, 10),
  ('CD-5520', NULL, 'Correa de distribución Hilux 2.7', 'Gates', 'Correas', 'unidad', 14.00, 2),
  ('AM-3301', NULL, 'Amortiguador delantero Corolla', 'Monroe', 'Suspensión', 'unidad', 22.00, 2),
  ('BA-6012', '7591001000086', 'Batería 22F-800', 'Duncan', 'Eléctrico', 'unidad', 70.00, 2),
  ('AC-1540', '7591001000093', 'Aceite 15W-40 mineral 1L', 'Venoco', 'Lubricantes', 'litro', 3.50, 12),
  ('BO-7701', NULL, 'Bomba de agua Spark 1.0', 'GMB', 'Enfriamiento', 'unidad', 17.00, 2),
  ('TE-0420', NULL, 'Terminal de dirección Fiesta', 'Moog', 'Dirección', 'unidad', 9.00, 3),
  ('RO-9910', NULL, 'Rolinera rueda delantera Optra', 'SKF', 'Rodamientos', 'unidad', 10.00, 2);

-- Categoría de cada repuesto demo (relación con categorias_producto, seed 004).
UPDATE productos
SET categoria_id = (SELECT cp.id FROM categorias_producto cp WHERE cp.nombre = m.categoria)
FROM (
  SELECT 'FO-1089' AS codigo, 'Filtros' AS categoria
  UNION ALL SELECT 'FA-8120', 'Filtros'
  UNION ALL SELECT 'PF-2041', 'Frenos'
  UNION ALL SELECT 'DF-3310', 'Frenos'
  UNION ALL SELECT 'BJ-0017', 'Encendido'
  UNION ALL SELECT 'CD-5520', 'Correas y cadenas'
  UNION ALL SELECT 'AM-3301', 'Suspensión'
  UNION ALL SELECT 'BA-6012', 'Baterías'
  UNION ALL SELECT 'AC-1540', 'Lubricantes y fluidos'
  UNION ALL SELECT 'BO-7701', 'Enfriamiento'
  UNION ALL SELECT 'TE-0420', 'Dirección'
  UNION ALL SELECT 'RO-9910', 'Rodamientos y cubos'
) m
WHERE productos.codigo = m.codigo AND productos.categoria_id IS NULL;

-- Precios: cada producto con los tres tipos, margen propio y valor_usd
-- materializado = round2(costo × (1 + margen/100)).
INSERT OR IGNORE INTO precios (producto_id, tipo_precio_id, valor_usd, margen, descripcion)
SELECT p.id, tp.id,
       ROUND(p.precio_compra_usd * (1 + m.margen / 100.0), 2),
       m.margen, m.descripcion
FROM productos p
JOIN (
  SELECT 'Precio Full' AS tipo, 100 AS margen, 'Venta al público' AS descripcion
  UNION ALL SELECT 'Precio Especial', 80, 'Talleres afiliados'
  UNION ALL SELECT 'Precio Interno', 60, 'Consumo interno / cortesía'
) m
JOIN tipos_precio tp ON tp.nombre = m.tipo
WHERE p.precio_compra_usd IS NOT NULL;

-- Existencia inicial (una entrada por producto sin movimientos previos); el
-- movimiento conserva el costo_usd de esa compra.
INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, saldo, motivo, usuario_id, costo_usd)
SELECT p.id, 'entrada', x.cantidad, x.cantidad, 'Inventario inicial',
       (SELECT id FROM usuarios WHERE usuario = 'admin'), p.precio_compra_usd
FROM (
  SELECT 'FO-1089' AS codigo, 14 AS cantidad
  UNION ALL SELECT 'FA-8120', 11
  UNION ALL SELECT 'PF-2041', 8
  UNION ALL SELECT 'DF-3310', 6
  UNION ALL SELECT 'BJ-0017', 42
  UNION ALL SELECT 'CD-5520', 2
  UNION ALL SELECT 'AM-3301', 6
  UNION ALL SELECT 'BA-6012', 4
  UNION ALL SELECT 'AC-1540', 60
  UNION ALL SELECT 'BO-7701', 3
  UNION ALL SELECT 'TE-0420', 10
  UNION ALL SELECT 'RO-9910', 0
) x
JOIN productos p ON p.codigo = x.codigo
WHERE x.cantidad > 0
  AND NOT EXISTS (SELECT 1 FROM inventario_movimientos im WHERE im.producto_id = p.id);
