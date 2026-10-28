-- Agrega la columna tipo_documento a clientes y separa el prefijo (V/J) del
-- número en los registros existentes. Antes el documento se guardaba como
-- "V-8765432" o "J-30512345-6" en una sola columna numero_documento; ahora
-- tipo_documento guarda 'V' o 'J' y numero_documento guarda solo el número.

ALTER TABLE clientes ADD COLUMN tipo_documento TEXT NOT NULL DEFAULT 'V';

-- Extraer el tipo del primer carácter y limpiar el prefijo del número.
UPDATE clientes
SET tipo_documento = UPPER(SUBSTR(numero_documento, 1, 1)),
    numero_documento = REPLACE(REPLACE(
      SUBSTR(numero_documento, 2),
      '-', ''),
      '.', '')
WHERE numero_documento IS NOT NULL
  AND numero_documento != ''
  AND UPPER(SUBSTR(numero_documento, 1, 1)) IN ('V', 'J', 'E', 'P', 'G');
