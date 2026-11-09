-- La Favorita · PostgreSQL 16+ (también Neon).
-- Ejecutado automáticamente en el primer arranque con DATABASE_URL.
-- La web y el panel comparten estas tablas mediante una API.
BEGIN;
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '', hours TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '', accent TEXT NOT NULL DEFAULT '#f026ad',
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT ''
);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS photo_url2 TEXT NOT NULL DEFAULT ''; -- Vista alternativa opcional, no altera los datos existentes
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL REFERENCES categories(id), sub_category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', usage TEXT NOT NULL DEFAULT '', features TEXT NOT NULL DEFAULT '',
  search_aliases TEXT NOT NULL DEFAULT '', comparison_group TEXT NOT NULL DEFAULT '', comparison_label TEXT NOT NULL DEFAULT '',
  quality_tier INTEGER NOT NULL DEFAULT 2 CHECK (quality_tier BETWEEN 1 AND 3),
  color TEXT NOT NULL DEFAULT '', material TEXT NOT NULL DEFAULT '', finish TEXT NOT NULL DEFAULT '',
  paper_gsm NUMERIC(10,2) CHECK (paper_gsm IS NULL OR paper_gsm>0),
  unit_label TEXT NOT NULL DEFAULT 'unidad',
  units_per_pack INTEGER NOT NULL DEFAULT 1 CHECK (units_per_pack > 0),
  net_content NUMERIC(12,3), net_unit TEXT,
  image_url TEXT NOT NULL DEFAULT '',
  is_new BOOLEAN NOT NULL DEFAULT FALSE, featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0
);
-- Migración segura de proyectos anteriores con las tablas ya creadas.
ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS finish TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS paper_gsm NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS usage TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS features TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_aliases TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS comparison_group TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS comparison_label TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS quality_tier INTEGER NOT NULL DEFAULT 2;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_service BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'SIN DETERMINAR';
CREATE TABLE IF NOT EXISTS offers (
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  compare_at NUMERIC(12,2) CHECK (compare_at IS NULL OR compare_at >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (branch_id, product_id)
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, eyebrow TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', cta_label TEXT NOT NULL DEFAULT 'Explorar',
  category_id TEXT REFERENCES categories(id), accent TEXT NOT NULL DEFAULT '#f026ad',
  background TEXT NOT NULL DEFAULT '', badge TEXT NOT NULL DEFAULT '',
  start_day TEXT NOT NULL DEFAULT '01-01', end_day TEXT NOT NULL DEFAULT '12-31',
  enabled BOOLEAN NOT NULL DEFAULT TRUE, branches JSONB NOT NULL DEFAULT '["all"]',
  priority INTEGER NOT NULL DEFAULT 10
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS app_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_comparison ON products(comparison_group);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_offers_branch ON offers(branch_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(lower(name));
COMMIT;
