-- Precios por márgenes con doble tasa (BCV + USDT Binance).
-- Ver Docs/plan-precios-margenes-tasas.md — Anexo (contrato técnico).
--
-- - tasas_cambio pasa a guardar dos valores por registro; `valor` se conserva
--   poblado con la tasa BCV para los lectores viejos (reportes, tickets).
-- - tipos_precio gana margen_default (% de markup sobre el costo) y activo
--   (los tipos con uso se desactivan, nunca se borran).
-- - precios.margen es el margen propio del producto (NULL = usa el default
--   del tipo); valor_usd queda materializado = round2(costo × (1+margen/100)).
-- - productos.stock_minimo alimenta la tabla de inventario con alerta.
-- - inventario_movimientos.costo_usd conserva el costo de cada recepción.
-- - ventas/venta_detalle guardan el snapshot: tasas usadas, método de pago,
--   margen aplicado y montos USDT. tasa_valor = tasa BCV (compatibilidad).
-- - cajas: tasa_apertura/tasa_cierre existentes quedan como BCV y se agregan
--   las columnas USDT equivalentes.

ALTER TABLE tasas_cambio ADD COLUMN valor_bcv REAL;
ALTER TABLE tasas_cambio ADD COLUMN valor_usdt REAL;
UPDATE tasas_cambio SET valor_bcv = valor, valor_usdt = valor WHERE valor_bcv IS NULL;

ALTER TABLE tipos_precio ADD COLUMN margen_default REAL NOT NULL DEFAULT 100;
ALTER TABLE tipos_precio ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;

ALTER TABLE precios ADD COLUMN margen REAL;

ALTER TABLE productos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;

ALTER TABLE inventario_movimientos ADD COLUMN costo_usd REAL;

ALTER TABLE ventas ADD COLUMN tasa_bcv REAL;
ALTER TABLE ventas ADD COLUMN tasa_usdt REAL;
ALTER TABLE ventas ADD COLUMN metodo_pago TEXT DEFAULT 'bs';
ALTER TABLE ventas ADD COLUMN total_usdt REAL;
-- Las ventas históricas solo conocían la tasa BCV (tasa_valor).
UPDATE ventas SET tasa_bcv = tasa_valor WHERE tasa_bcv IS NULL;

ALTER TABLE venta_detalle ADD COLUMN margen_utilidad REAL;
ALTER TABLE venta_detalle ADD COLUMN precio_unitario_usdt REAL;
ALTER TABLE venta_detalle ADD COLUMN subtotal_usdt REAL;

ALTER TABLE cajas ADD COLUMN tasa_apertura_usdt REAL;
ALTER TABLE cajas ADD COLUMN tasa_cierre_usdt REAL;
