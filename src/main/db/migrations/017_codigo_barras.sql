-- Código de barra opcional del producto (EAN/UPC o el que use el negocio).
-- Único cuando existe: el índice parcial permite cualquier cantidad de NULL/vacío.
ALTER TABLE productos ADD COLUMN codigo_barras TEXT;

CREATE UNIQUE INDEX idx_productos_codigo_barras
  ON productos(codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras != '';
