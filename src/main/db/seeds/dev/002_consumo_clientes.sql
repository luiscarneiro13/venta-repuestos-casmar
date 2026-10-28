-- Seeder de SIMULACIÓN: dos clientes fijos con historial largo de compras
-- para probar las gráficas de consumo y ventas totales.
--
-- Cliente Fijo Uno (taller): de 2024-01 a 2026-09, 3 compras por mes
--   (días 5, 15 y 25). Cada compra: 1 a 4 unidades de un repuesto que rota
--   entre 5 productos, siempre a "Precio Especial". Tickets T-A0001...
-- Cliente Fijo Dos (particular): de 2025-01 a 2026-09, 1 compra por mes
--   (día 10). Cada compra: 1 o 2 unidades a "Precio Full". Tickets T-B0001...
--
-- Las ventas históricas NO generan movimientos de inventario: la existencia
-- actual es la carga inicial de 001_datos_demo.sql. Se guardan con el modelo
-- de doble tasa: tasa_bcv = tasa_usdt = la tasa simulada (así los montos USDT
-- coinciden con los USD, igual que en una venta real con ambas tasas iguales)
-- y metodo_pago 'bs'.
--
-- SOLO se ejecuta con SEED_DEMO=1 (ver src/main/db/seed.js). Es idempotente:
-- si ya existen los tickets T-A0001 / T-B0001 no inserta nada.

INSERT OR IGNORE INTO clientes (nombre, tipo_documento, numero_documento, telefono, direccion) VALUES
  ('Cliente Fijo Uno', 'V', '11111111', '04141111111', 'EL TIGRE'),
  ('Cliente Fijo Dos', 'V', '22222222', '04142222222', 'EL TIGRE');

CREATE TEMP TABLE demo_lineas AS
WITH RECURSIVE
  seq_a(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq_a WHERE n < 98),
  seq_b(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq_b WHERE n < 20),
  prods_a(idx, codigo) AS (
    VALUES (0, 'FO-1089'), (1, 'PF-2041'), (2, 'CD-5520'), (3, 'AM-3301'), (4, 'RO-9910')
  ),
  prods_b(idx, codigo) AS (
    VALUES (0, 'BJ-0017'), (1, 'AC-1540'), (2, 'FA-8120')
  ),
  base AS (
    SELECT 'T-A' || printf('%04d', s.n + 1) AS ticket,
           '11111111' AS doc,
           (SELECT codigo FROM prods_a WHERE idx = s.n % 5) AS codigo,
           'Precio Especial' AS tipo,
           (s.n % 4) + 1 AS cantidad,
           40.0 + (s.n / 3) * 9.5 AS tasa,
           date('2024-01-01', '+' || (s.n / 3) || ' months', '+' || (4 + (s.n % 3) * 10) || ' days') || ' 14:00:00' AS fecha
    FROM seq_a s
    UNION ALL
    SELECT 'T-B' || printf('%04d', s.n + 1),
           '22222222',
           (SELECT codigo FROM prods_b WHERE idx = s.n % 3),
           'Precio Full',
           (s.n % 2) + 1,
           150.0 + s.n * 12.5,
           date('2025-01-10', '+' || s.n || ' months') || ' 15:30:00'
    FROM seq_b s
  )
SELECT b.ticket, b.fecha, b.tasa, b.cantidad,
       c.id AS cliente_id,
       pr.id AS precio_id,
       pr.valor_usd,
       COALESCE(pr.margen, tp.margen_default) AS margen,
       p.nombre AS producto_nombre,
       tp.nombre AS tipo_precio_nombre
FROM base b
JOIN clientes c ON c.numero_documento = b.doc
JOIN productos p ON p.codigo = b.codigo
JOIN tipos_precio tp ON tp.nombre = b.tipo
JOIN precios pr ON pr.producto_id = p.id AND pr.tipo_precio_id = tp.id
WHERE NOT EXISTS (SELECT 1 FROM ventas WHERE numero_ticket IN ('T-A0001', 'T-B0001'));

-- tasa_valor = tasa_bcv (compat); tasa_usdt = la misma simulada.
INSERT INTO ventas (numero_ticket, cliente_id, usuario_id, tasa_valor, tasa_bcv, tasa_usdt,
                    metodo_pago, total_usd, total_bs, total_usdt, estado, creado_en)
SELECT ticket, cliente_id, (SELECT id FROM usuarios WHERE usuario = 'admin'), tasa, tasa, tasa,
       'bs', valor_usd * cantidad, valor_usd * cantidad * tasa, valor_usd * cantidad, 'activa', fecha
FROM demo_lineas;

INSERT INTO venta_detalle (venta_id, precio_id, cantidad, precio_unitario_usd, precio_unitario_bs,
                           precio_unitario_usdt, subtotal_usd, subtotal_bs, subtotal_usdt,
                           margen_utilidad, producto_nombre, tipo_precio_nombre)
SELECT v.id, d.precio_id, d.cantidad, d.valor_usd, d.valor_usd * d.tasa, d.valor_usd,
       d.valor_usd * d.cantidad, d.valor_usd * d.cantidad * d.tasa, d.valor_usd * d.cantidad,
       d.margen, d.producto_nombre, d.tipo_precio_nombre
FROM demo_lineas d
JOIN ventas v ON v.numero_ticket = d.ticket;

DROP TABLE demo_lineas;
