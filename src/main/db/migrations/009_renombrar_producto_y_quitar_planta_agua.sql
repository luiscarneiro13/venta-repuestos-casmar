-- Renombra el producto "Agua" a "Botellón de Agua" y elimina la categoría
-- "Planta agua" junto con sus precios. El inventario de agua funciona en
-- negativo (cada venta descuenta 1 botellón) y no tiene categoría propia:
-- los precios de agua se asignan a "Planta hielo" o "Calle" según
-- corresponda, o se eliminan si solo existían en "Planta agua".

-- 1. Renombrar producto "Agua" -> "Botellón de Agua"
UPDATE productos SET nombre = 'Botellón de Agua' WHERE nombre = 'Agua';

-- 2. Eliminar precios asociados a "Planta agua"
DELETE FROM precios WHERE tipo_precio_id IN (
  SELECT id FROM tipos_precio WHERE nombre = 'Planta agua'
);

-- 3. Eliminar la categoría "Planta agua"
DELETE FROM tipos_precio WHERE nombre = 'Planta agua';
