-- Anulación de entradas de mercancía: la fila NO se borra, queda marcada
-- para auditoría (cuándo y quién). Al anularse, su cantidad se descuenta del
-- saldo propio y de todos los movimientos posteriores (misma mecánica que la
-- edición), y deja de definir el costo del producto.
ALTER TABLE inventario_movimientos ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventario_movimientos ADD COLUMN anulada_en TEXT;
ALTER TABLE inventario_movimientos ADD COLUMN anulada_por_id INTEGER;
