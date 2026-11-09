-- Opciones de la nota de entrega, elegidas en la pantalla de venta y
-- congeladas en la venta (la reimpresión las respeta):
--   nota_moneda  : 'bs' | 'usd' — moneda en la que se muestra el documento
--   nota_con_iva : 1 = cobra el precio con IVA embebido (sin reflejarlo)
--                  0 = cobra el precio base sin IVA
-- En facturas ambas quedan NULL. Notas anteriores: NULL = '$' con IVA
-- embebido (regla previa a esta migración).
ALTER TABLE ventas ADD COLUMN nota_moneda TEXT;
ALTER TABLE ventas ADD COLUMN nota_con_iva INTEGER;
