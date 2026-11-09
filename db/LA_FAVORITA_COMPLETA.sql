-- La Favorita V6.1: ejecutar dentro de PostgreSQL/Neon; no incluye productos reales.
-- El servidor también instala automáticamente el modelo cuando DATABASE_URL está definido.


-- ========= schema.sql =========
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
ALTER TABLE branches ADD COLUMN IF NOT EXISTS photo_url2 TEXT NOT NULL DEFAULT '';
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


-- ========= 02_ampliacion_comercial.sql =========
-- LA FAVORITA | Modelo comercial ampliado para Neon/PostgreSQL 15+
-- Se instala DESPUES de db/schema.sql. No borra ni reemplaza las ocho tablas de V6.
-- "products" representa el SKU vendible que entiende la web; "offers" su precio/stock por sucursal.
-- Las relaciones nuevas permiten ampliar el catalogo sin romper la API V6.
BEGIN;

CREATE TABLE IF NOT EXISTS brands (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_families (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  family_key TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  brand_name TEXT NOT NULL DEFAULT '',
  category_id TEXT REFERENCES categories(id),
  comparison_group TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada variante representa un articulo fisico especifico, NO un empaque comercial.
-- Ejemplo: silicona Artesco liquida 250 ml azul, o papel A4 75 g/m2.
CREATE TABLE IF NOT EXISTS product_variants (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  family_id BIGINT NOT NULL REFERENCES product_families(id),
  variant_key TEXT NOT NULL UNIQUE,
  linked_product_id TEXT UNIQUE REFERENCES products(id) ON DELETE SET NULL,
  model TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  material TEXT NOT NULL DEFAULT '',
  finish TEXT NOT NULL DEFAULT '',
  measure_value NUMERIC(14,3) CHECK (measure_value IS NULL OR measure_value > 0),
  measure_unit TEXT,
  paper_gsm NUMERIC(10,2) CHECK (paper_gsm IS NULL OR paper_gsm > 0),
  length_mm NUMERIC(12,2) CHECK (length_mm IS NULL OR length_mm > 0),
  width_mm NUMERIC(12,2) CHECK (width_mm IS NULL OR width_mm > 0),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(attributes) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (measure_unit IS NULL OR measure_unit IN ('unidad','g','kg','ml','l','cm','m','mm','hoja','metro','rollo','pieza','set'))
);

-- Un SKU de la web corresponde a una presentacion vendible concreta.
-- Varias presentaciones (unidad, caja x12) pueden apuntar a la MISMA variante fisica.
CREATE TABLE IF NOT EXISTS sale_presentations (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  variant_id BIGINT NOT NULL REFERENCES product_variants(id),
  presentation_kind TEXT NOT NULL DEFAULT 'unidad',
  base_quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (base_quantity > 0),
  base_unit TEXT NOT NULL DEFAULT 'unidad',
  requires_sealed_pack BOOLEAN NOT NULL DEFAULT FALSE,
  barcode TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (base_unit IN ('unidad','g','kg','ml','l','cm','m','mm','hoja','metro','rollo','pieza','set'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_presentations_barcode ON sale_presentations(barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS idx_sale_presentations_variant ON sale_presentations(variant_id);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL CHECK (image_url ~* '^https?://'),
  alt_text TEXT NOT NULL DEFAULT '',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_image_primary ON product_images(product_id) WHERE is_primary;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_image_url ON product_images(product_id,image_url);

-- Terminos regionales y sinonimos. 'review' nunca se aplica automaticamente al cotizar.
CREATE TABLE IF NOT EXISTS catalog_aliases (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  alias_key TEXT NOT NULL UNIQUE,
  alias_text TEXT NOT NULL,
  canonical_term TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id),
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','review','rejected')),
  requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_catalog_aliases_status ON catalog_aliases(status);

-- El stock V6 vive en offers.stock, por SKU y sucursal. Este historial registra cada cambio.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  delta_quantity INTEGER NOT NULL,
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  movement_type TEXT NOT NULL DEFAULT 'adjustment',
  origin TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch_date ON inventory_movements(branch_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_date ON inventory_movements(product_id,created_at DESC);

CREATE OR REPLACE FUNCTION log_offer_inventory_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.stock <> 0 THEN
      INSERT INTO inventory_movements(branch_id,product_id,delta_quantity,stock_after,movement_type,origin)
      VALUES(NEW.branch_id, NEW.product_id, NEW.stock, NEW.stock, 'initial', 'web');
    END IF;
  ELSIF NEW.stock IS DISTINCT FROM OLD.stock THEN
    INSERT INTO inventory_movements(branch_id,product_id,delta_quantity,stock_after,movement_type,origin)
    VALUES(NEW.branch_id, NEW.product_id, NEW.stock-OLD.stock, NEW.stock, 'adjustment', 'web');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_offer_inventory_change ON offers;
CREATE TRIGGER trg_offer_inventory_change AFTER INSERT OR UPDATE OF stock ON offers
FOR EACH ROW EXECUTE FUNCTION log_offer_inventory_change();

-- Convertir cajas cerradas en unidades sueltas sin inventar existencias.
CREATE TABLE IF NOT EXISTS package_openings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  package_product_id TEXT NOT NULL REFERENCES products(id),
  unit_product_id TEXT NOT NULL REFERENCES products(id),
  packages_opened INTEGER NOT NULL CHECK (packages_opened > 0),
  single_units_created INTEGER NOT NULL CHECK (single_units_created > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION open_sealed_packages(
  p_branch_id TEXT, p_package_product TEXT, p_unit_product TEXT, p_count INTEGER
) RETURNS BIGINT AS $$
DECLARE
  v_pack sale_presentations%ROWTYPE;
  v_unit sale_presentations%ROWTYPE;
  v_stock INTEGER;
  v_units INTEGER;
  v_new_id BIGINT;
BEGIN
  IF p_count IS NULL OR p_count <= 0 OR p_package_product = p_unit_product THEN
    RAISE EXCEPTION 'Cantidad o productos invalidos';
  END IF;
  SELECT * INTO STRICT v_pack FROM sale_presentations WHERE product_id=p_package_product;
  SELECT * INTO STRICT v_unit FROM sale_presentations WHERE product_id=p_unit_product;
  IF v_pack.variant_id <> v_unit.variant_id OR v_unit.base_quantity <> 1
     OR v_pack.base_quantity <= 1 OR v_pack.base_unit <> v_unit.base_unit THEN
    RAISE EXCEPTION 'No son presentaciones compatibles de la misma variante';
  END IF;
  IF (v_pack.base_quantity * p_count) <> trunc(v_pack.base_quantity * p_count) THEN
    RAISE EXCEPTION 'La conversion no produce unidades enteras';
  END IF;
  v_units := (v_pack.base_quantity * p_count)::integer;
  -- Bloqueo con orden estable para que dos ventas simultaneas no creen stock.
  PERFORM 1 FROM offers WHERE branch_id=p_branch_id AND product_id IN (p_package_product,p_unit_product)
    ORDER BY product_id FOR UPDATE;
  SELECT stock INTO v_stock FROM offers WHERE branch_id=p_branch_id AND product_id=p_package_product;
  IF v_stock IS NULL OR v_stock < p_count OR NOT EXISTS
    (SELECT 1 FROM offers WHERE branch_id=p_branch_id AND product_id=p_unit_product) THEN
    RAISE EXCEPTION 'No hay cajas suficientes o falta el SKU unitario';
  END IF;
  UPDATE offers SET stock=stock-p_count WHERE branch_id=p_branch_id AND product_id=p_package_product;
  UPDATE offers SET stock=stock+v_units WHERE branch_id=p_branch_id AND product_id=p_unit_product;
  INSERT INTO package_openings(branch_id,package_product_id,unit_product_id,packages_opened,single_units_created)
    VALUES(p_branch_id,p_package_product,p_unit_product,p_count,v_units) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

-- Integracion opcional con el facturador que acepta hojas Excel. No toca su base de datos.
CREATE TABLE IF NOT EXISTS external_catalog_links (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_code TEXT NOT NULL,
  synced_at TIMESTAMPTZ,
  UNIQUE(provider,external_code), UNIQUE(provider,product_id)
);

-- Historial optativo de cotizaciones, sin guardar imagenes/PDF ni datos personales.
CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id),
  tier TEXT NOT NULL CHECK(tier IN ('economica','equilibrada','calidad')),
  input_type TEXT NOT NULL CHECK(input_type IN ('text','image','pdf')),
  total NUMERIC(14,2) NOT NULL CHECK(total>=0),
  included_count INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0,
  complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quote_lines (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  requested_text TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity>0),
  line_status TEXT NOT NULL CHECK(line_status IN ('matched','not_found','unclear')),
  line_total NUMERIC(14,2) CHECK(line_total IS NULL OR line_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON quote_requests(created_at);

-- Migracion y cambios de schema registrados separadamente.
CREATE TABLE IF NOT EXISTS catalog_schema_versions (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT NOT NULL
);
INSERT INTO catalog_schema_versions(version,description)
  VALUES(2,'Ampliacion de variantes, medidas, presentaciones, vocabulario, stock y cotizaciones')
  ON CONFLICT(version) DO NOTHING;
COMMIT;


-- ========= 03_datos_semilla_vocabulario.sql =========
-- Vocabulario de ejemplo. Los terminos dudosos se guardan con review y NO se autoconvierten.
BEGIN;
INSERT INTO catalog_aliases(alias_key,alias_text,canonical_term,status,requires_review,note) VALUES
 ('boligrafo','boligrafo','lapicero','approved',FALSE,'Sinónimo común en Perú'),
 ('boligrafos','boligrafos','lapiceros','approved',FALSE,'Plural'),
 ('lapisero','lapisero','lapicero','approved',FALSE,'Falta ortografica frecuente'),
 ('lapiseros','lapiseros','lapiceros','approved',FALSE,'Plural con falta ortografica'),
 ('lapicera','lapicera','lapicero','approved',FALSE,'Nombre regional'),
 ('lapiceras','lapiceras','lapiceros','approved',FALSE,'Plural regional'),
 ('papelote','papelote','papelografo','approved',FALSE,'Nombre popular'),
 ('papelotes','papelotes','papelografos','approved',FALSE,'Plural'),
 ('hoja bond','hoja bond','papel bond','approved',FALSE,'Equivalencia de denominacion'),
 ('goma en barra','goma en barra','pegamento en barra','approved',FALSE,'Presentacion equivalente'),
 ('fomi','fomi','goma eva','approved',FALSE,'Nombre comercial frecuente'),
 ('foamy','foamy','goma eva','approved',FALSE,'Nombre comercial frecuente'),
 ('corros pun escarchado','corros pun escarchado','corospum escarchado','review',TRUE,'Ambiguo: verificar el material exacto'),
 ('corrospum escarchado','corrospum escarchado','corospum escarchado','review',TRUE,'Requiere verificar con el cliente'),
 ('corospun escarchado','corospun escarchado','corospum escarchado','review',TRUE,'Requiere verificar con el cliente')
ON CONFLICT(alias_key) DO NOTHING;
COMMIT;


-- ========= 04_enlazar_catalogo_v6.sql =========
-- Se puede ejecutar repetidamente. Crea una relacion 1:1 inicial desde los SKU V6.
-- No une por suposicion productos de diferentes marcas ni asigna cajas arbitrariamente.
BEGIN;
INSERT INTO brands(name)
SELECT DISTINCT brand FROM products WHERE length(btrim(brand))>0
ON CONFLICT(name) DO NOTHING;

INSERT INTO product_families(family_key,canonical_name,brand_name,category_id,comparison_group)
SELECT 'v6:'||id, name, brand, category_id, comparison_group FROM products
ON CONFLICT(family_key) DO UPDATE SET canonical_name=EXCLUDED.canonical_name,
 brand_name=EXCLUDED.brand_name, category_id=EXCLUDED.category_id, comparison_group=EXCLUDED.comparison_group;

INSERT INTO product_variants(family_id,variant_key,linked_product_id,model,color,material,finish,measure_value,measure_unit,paper_gsm)
SELECT f.id,'v6:'||p.id,p.id,p.model,p.color,p.material,p.finish,
  CASE WHEN p.net_unit IN ('g','kg','ml','l','unidad','cm','m','mm','hoja','rollo','pieza','set') THEN p.net_content ELSE NULL END,
  CASE WHEN p.net_unit IN ('g','kg','ml','l','unidad','cm','m','mm','hoja','rollo','pieza','set') THEN p.net_unit ELSE NULL END,
  COALESCE(p.paper_gsm, CASE WHEN p.net_unit IN ('g/m2','g/m²','gsm') THEN p.net_content END)
FROM products p JOIN product_families f ON f.family_key='v6:'||p.id
ON CONFLICT(variant_key) DO UPDATE SET model=EXCLUDED.model,color=EXCLUDED.color,material=EXCLUDED.material,finish=EXCLUDED.finish,
  measure_value=EXCLUDED.measure_value,measure_unit=EXCLUDED.measure_unit,paper_gsm=EXCLUDED.paper_gsm;

INSERT INTO sale_presentations(product_id,variant_id,presentation_kind,base_quantity,base_unit,requires_sealed_pack)
SELECT p.id,v.id,p.unit_label,COALESCE(NULLIF(p.units_per_pack,0),1),'unidad',p.units_per_pack>1
FROM products p JOIN product_variants v ON v.variant_key='v6:'||p.id
ON CONFLICT(product_id) DO UPDATE SET presentation_kind=EXCLUDED.presentation_kind,
  base_quantity=EXCLUDED.base_quantity;

INSERT INTO product_images(product_id,image_url,alt_text,is_primary)
SELECT p.id,p.image_url,p.name,TRUE FROM products p WHERE p.image_url ~* '^https?://'
 AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.product_id=p.id AND pi.is_primary)
ON CONFLICT(product_id,image_url) DO NOTHING;
COMMIT;

