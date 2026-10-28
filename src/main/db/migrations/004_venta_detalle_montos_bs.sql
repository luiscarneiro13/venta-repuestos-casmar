-- Congela también en bolívares cada línea de venta: precio unitario y
-- subtotal, además del subtotal_usd que ya existía. ventas.total_usd /
-- ventas.total_bs (desde 001_init.sql) ya cubren el total de la venta; la
-- tasa usada queda registrada en ventas.tasa_valor para trazabilidad.

ALTER TABLE venta_detalle ADD COLUMN precio_unitario_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN precio_unitario_bs REAL NOT NULL DEFAULT 0;
ALTER TABLE venta_detalle ADD COLUMN subtotal_bs REAL NOT NULL DEFAULT 0;
