-- Los abonos a crédito se cobran en bolívares; se guarda también el monto
-- en Bs tal como se cobró, aunque el saldo del crédito (creditos.saldo_usd)
-- se sigue controlando en dólares porque la tasa cambia varias veces al día.
ALTER TABLE pagos ADD COLUMN monto_bs REAL NOT NULL DEFAULT 0;
