-- Categorías de productos más comunes en una venta de repuestos. Se cargan
-- UNA sola vez (marca en configuracion): si el operario borra o renombra una
-- desde Operaciones → Categorías de productos, no reaparece al reiniciar.
INSERT OR IGNORE INTO categorias_producto (nombre, descripcion)
SELECT column1, column2
FROM (VALUES
  ('Motor', 'Pistones, anillos, válvulas, árbol de levas, cigüeñal, bielas'),
  ('Empacaduras y sellos', 'Juegos de empacaduras, empacadura de culata, sellos y estoperas'),
  ('Correas y cadenas', 'Correas de tiempo, correas de accesorios, cadenas, tensores'),
  ('Frenos', 'Pastillas, bandas, discos, tambores, bombas y calipers'),
  ('Suspensión', 'Amortiguadores, espirales, ballestas, bujes, bases de amortiguador'),
  ('Dirección', 'Rótulas, terminales, cajas y bombas de dirección, brazos'),
  ('Filtros', 'Filtros de aceite, aire, combustible y cabina'),
  ('Lubricantes y fluidos', 'Aceites de motor y caja, grasas, líquido de frenos, refrigerante'),
  ('Encendido', 'Bujías, bobinas, cables de bujía, distribuidores'),
  ('Sistema eléctrico', 'Alternadores, arranques, relés, fusibles, switches'),
  ('Sensores', 'Sensores de oxígeno, MAP, TPS, temperatura, ABS, cigüeñal'),
  ('Baterías', 'Baterías y terminales'),
  ('Embrague y transmisión', 'Kits de embrague, collarines, crucetas, juntas homocinéticas'),
  ('Enfriamiento', 'Radiadores, bombas de agua, termostatos, electroventiladores'),
  ('Mangueras y abrazaderas', 'Mangueras de radiador, combustible y vacío, abrazaderas'),
  ('Combustible e inyección', 'Inyectores, bombas de gasolina, reguladores, cuerpos de aceleración'),
  ('Escape', 'Silenciadores, catalizadores, tubos, empacaduras de escape'),
  ('Rodamientos y cubos', 'Rodamientos de rueda, cubos, rolineras'),
  ('Iluminación', 'Faros, stops, cruces, bombillos y LED'),
  ('Carrocería', 'Parachoques, guardafangos, retrovisores, manillas, emblemas'),
  ('Aire acondicionado', 'Compresores, condensadores, filtros secadores, gas refrigerante'),
  ('Cauchos y rines', 'Neumáticos, rines, válvulas, tuercas de rueda'),
  ('Accesorios', 'Alfombras, forros, cornetas, plumillas, accesorios de lujo'),
  ('Tornillería', 'Tornillos, tuercas, arandelas, espárragos, grapas')
)
WHERE NOT EXISTS (SELECT 1 FROM configuracion WHERE clave = 'seed_categorias_producto');

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('seed_categorias_producto', '1');
