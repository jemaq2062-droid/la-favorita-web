-- V27: almacenamiento comercial adicional. Se crea automáticamente al iniciar con DATABASE_URL.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS lf_commerce_state (
  id integer PRIMARY KEY CHECK (id = 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
INSERT INTO lf_commerce_state(id,payload) VALUES(1,'{}'::jsonb) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS lf_quote_records (
  seq bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  branch_id text NOT NULL,
  tier text NOT NULL,
  input_type text NOT NULL,
  payload jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lf_quote_records_branch_time ON lf_quote_records(branch_id,created_at DESC);
