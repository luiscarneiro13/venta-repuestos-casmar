-- La tasa puede cambiar varias veces en el mismo día, así que cada cambio es
-- una fila nueva y "la tasa de hoy" es la última del día.
--
-- El problema: fecha_hora venía con DEFAULT datetime('now') (UTC) pero
-- obtenerTasaDeHoy() compara contra date('now', 'localtime'). En Venezuela
-- (UTC-4) una tasa registrada después de las 20:00 se guardaba con la fecha
-- del día siguiente, así que desaparecía del día en curso y reaparecía como
-- "de hoy" a la mañana siguiente.
--
-- Se pasa fecha_hora a hora LOCAL, igual que ya hace la tabla cajas.
-- SQLite no permite cambiar un DEFAULT, hay que recrear la tabla.
CREATE TABLE tasas_cambio_nueva (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  valor REAL NOT NULL,
  fecha_hora TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id)
);

INSERT INTO tasas_cambio_nueva (id, valor, fecha_hora, usuario_id)
SELECT id, valor, datetime(fecha_hora, 'localtime'), usuario_id FROM tasas_cambio;

DROP TABLE tasas_cambio;
ALTER TABLE tasas_cambio_nueva RENAME TO tasas_cambio;

CREATE INDEX idx_tasas_cambio_fecha ON tasas_cambio(fecha_hora);
