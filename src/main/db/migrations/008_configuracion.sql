-- Ajustes del sistema en formato clave/valor. Primer uso: la impresora de
-- tickets (nombre en la cola de impresión de Windows y ancho de papel), que
-- no se puede hardcodear porque depende de cómo se llame en cada máquina.
CREATE TABLE configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT,
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Valor inicial: la impresora térmica del punto de venta tal como está
-- instalada en el Windows de la planta. Es solo el valor por defecto; se puede
-- cambiar desde Configuración → Impresora si en otra máquina se llama distinto.
INSERT INTO configuracion (clave, valor) VALUES
  ('impresora_nombre', 'POS8330'),
  ('impresora_ancho', '80mm');
