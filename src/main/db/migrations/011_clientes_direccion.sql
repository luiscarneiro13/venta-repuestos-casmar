-- Agrega la columna direccion a clientes. Por defecto 'EL TIGRE' para que
-- los registros existentes y los nuevos (si el front no envía nada) queden
-- con la ubicación habitual de la planta.
ALTER TABLE clientes ADD COLUMN direccion TEXT NOT NULL DEFAULT 'EL TIGRE';
