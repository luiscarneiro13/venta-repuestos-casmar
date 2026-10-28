-- Costo de adquisición unitario en USD; los productos existentes quedan sin
-- costo registrado hasta que se editen. No afecta los precios de venta.
ALTER TABLE productos ADD COLUMN precio_compra_usd REAL;
