-- % de utilidad independiente por método de pago. La cadena de cálculo no
-- cambia: cada margen alimenta su propia columna de la tabla de márgenes.
--   precio$    = costo × (1+margen/100)        → precioBs = precio$×BCV
--   base USDT  = costo × (1+margen_usdt/100)   → precioUSDT = base×BCV ÷ Binance
-- Con margen_usdt = margen los precios quedan idénticos al modelo anterior.
--
-- margen_usdt NULL = sigue al margen efectivo de Bs (propio o default del
-- tipo): los productos que heredan el default lo siguen heredando en ambos.
-- valor_usdt materializa la base en $ del precio USDT (round2 del costo ×
-- (1+margen_usdt_efectivo/100)); el USDT final sale al vender/listar porque
-- depende de las tasas del día.

ALTER TABLE precios ADD COLUMN margen_usdt REAL;
ALTER TABLE precios ADD COLUMN valor_usdt REAL;

-- Datos existentes: el %USDT arranca copiado del %Bs propio; las filas que
-- heredan el default del tipo quedan en NULL (siguen heredando).
UPDATE precios SET margen_usdt = margen WHERE margen IS NOT NULL;
UPDATE precios SET valor_usdt = valor_usd;
