-- Tipo de documento de la venta: 'factura' (con IVA) o 'nota_entrega' (sin
-- IVA). Todo lo demás es igual. Las ventas existentes quedan como factura.
-- Cada tipo lleva su propio correlativo: facturas T-0001…, notas NE-0001….
ALTER TABLE ventas ADD COLUMN tipo_documento TEXT NOT NULL DEFAULT 'factura'
  CHECK (tipo_documento IN ('factura', 'nota_entrega'));
