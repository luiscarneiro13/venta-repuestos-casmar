-- Control de apertura/cierre de caja. La caja se abre automáticamente al
-- iniciar sesión (una por día) y se cierra manualmente desde "Ventas del
-- día", congelando los totales de contado/crédito/cobrado del período que
-- estuvo abierta (desde abierta_en hasta cerrada_en).
--
-- Todas las fechas de esta tabla se guardan en hora LOCAL (a diferencia de
-- creado_en en el resto del esquema, que usa datetime('now') en UTC) para
-- poder comparar "es de hoy" de forma directa y consistente.
CREATE TABLE cajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id),
  tasa_apertura REAL NOT NULL,
  abierta_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  estado TEXT NOT NULL DEFAULT 'abierta',
  usuario_cierre_id INTEGER REFERENCES usuarios(id),
  tasa_cierre REAL,
  cerrada_en TEXT,
  total_contado_usd REAL,
  total_contado_bs REAL,
  total_credito_usd REAL,
  total_credito_bs REAL,
  total_cobrado_usd REAL,
  total_cobrado_bs REAL
);

CREATE INDEX idx_cajas_estado ON cajas(estado);
