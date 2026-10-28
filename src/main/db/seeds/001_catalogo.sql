-- Catálogo base: tipos de precio iniciales (nombres globales de precio que
-- cada producto puede usar), cada uno con su % de utilidad por defecto
-- (margen_default = markup sobre el costo; 100 = vender al doble). Se ejecuta
-- en cada arranque, pero solo inserta si la tabla está vacía: así, si el
-- operario renombra o desactiva un tipo desde Operaciones → Tipos de precio,
-- no reaparece al reiniciar. Las bases que ya tenían Precio 1-4 los conservan.
--
-- Los productos y sus precios NO se incluyen acá: los carga el operario desde
-- Operaciones → Productos / Entrada de mercancía.
--
-- El usuario administrador por defecto se crea en 002_admin.sql.

INSERT INTO tipos_precio (nombre, orden, margen_default, activo)
SELECT column1, column2, 100, 1
FROM (VALUES ('Precio Full', 1), ('Precio Especial', 2), ('Precio Interno', 3))
WHERE NOT EXISTS (SELECT 1 FROM tipos_precio);
