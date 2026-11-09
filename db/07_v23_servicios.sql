-- V23: actualización estructural idempotente. NO importa datos ni cambia stocks.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'SIN DETERMINAR';
INSERT INTO categories(id,name,icon,sort_order)
VALUES ('servicios','Servicios','printer',8) ON CONFLICT(id) DO NOTHING;
