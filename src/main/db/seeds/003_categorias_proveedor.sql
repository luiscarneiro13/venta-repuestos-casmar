-- Categorías de proveedores más comunes en una venta de repuestos. Se cargan
-- UNA sola vez (marca en configuracion): si el operario borra o renombra una
-- desde Operaciones → Categorías de proveedores, no reaparece al reiniciar.
INSERT OR IGNORE INTO categorias_proveedor (nombre, descripcion)
SELECT column1, column2
FROM (VALUES
  ('Motor', 'Pistones, anillos, empacaduras, válvulas, correas de tiempo'),
  ('Frenos', 'Pastillas, bandas, discos, tambores, bombas y líquido de frenos'),
  ('Suspensión y dirección', 'Amortiguadores, rótulas, terminales, bujes, cajas de dirección'),
  ('Sistema eléctrico', 'Alternadores, arranques, bujías, cables, sensores, relés'),
  ('Baterías', 'Baterías y accesorios de carga'),
  ('Filtros', 'Filtros de aceite, aire, combustible y cabina'),
  ('Lubricantes y fluidos', 'Aceites de motor y caja, grasas, refrigerantes, aditivos'),
  ('Transmisión y embrague', 'Kits de embrague, crucetas, juntas homocinéticas, cajas'),
  ('Enfriamiento', 'Radiadores, bombas de agua, termostatos, mangueras, electroventiladores'),
  ('Inyección y combustible', 'Inyectores, bombas de gasolina, carburadores, cuerpos de aceleración'),
  ('Escape', 'Silenciadores, catalizadores, tubos y abrazaderas'),
  ('Carrocería y latonería', 'Parachoques, guardafangos, capós, retrovisores, manillas'),
  ('Iluminación', 'Faros, stops, cruces, bombillos y LED'),
  ('Cauchos y rines', 'Neumáticos, rines, válvulas y tuercas'),
  ('Rodamientos y retenes', 'Rodamientos, retenes, estoperas y cubos de rueda'),
  ('Aire acondicionado', 'Compresores, condensadores, evaporadores, gas refrigerante'),
  ('Accesorios', 'Alfombras, forros, cornetas, accesorios de lujo'),
  ('Herramientas', 'Herramientas manuales, gatos, llaves y equipos de taller'),
  ('Tornillería y ferretería', 'Tornillos, tuercas, arandelas, abrazaderas, conectores'),
  ('Repuestos pesados / camiones', 'Repuestos para camiones, gandolas y maquinaria pesada')
)
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'seed_categorias_proveedor');

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('seed_categorias_proveedor', '1');
