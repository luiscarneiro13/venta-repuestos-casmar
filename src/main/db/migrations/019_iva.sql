-- IVA general: porcentaje editable desde Configuración (default 16%).
-- Cada venta guarda el % vigente y el impuesto por moneda como snapshot;
-- total_* queda como el monto final cobrado (base + IVA). Ventas viejas
-- quedan con iva_* en NULL: su total ya era el monto cobrado.
ALTER TABLE ventas ADD COLUMN iva_porcentaje REAL;
ALTER TABLE ventas ADD COLUMN iva_usd REAL;
ALTER TABLE ventas ADD COLUMN iva_bs REAL;
ALTER TABLE ventas ADD COLUMN iva_usdt REAL;

INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('iva_porcentaje', '16');
