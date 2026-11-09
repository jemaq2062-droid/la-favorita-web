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
