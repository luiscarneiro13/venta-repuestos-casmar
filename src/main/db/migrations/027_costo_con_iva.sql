-- El costo de compra puede venir del proveedor con el IVA incluido o sin
-- él. El flag lo declara cada entrada de mercancía y queda vigente en el
-- producto; decide cómo se interpreta el precio materializado en la venta:
--   0 = costo sin IVA  → el precio de venta suma el IVA encima (base + IVA)
--   1 = costo con IVA  → el precio materializado ya contiene el IVA (en la
--      factura se desglosa hacia atrás; no se le suma otra vez).
-- En el movimiento queda NULL para entradas viejas (regla anterior: sin IVA).
ALTER TABLE productos ADD COLUMN costo_con_iva INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inventario_movimientos ADD COLUMN costo_con_iva INTEGER;
