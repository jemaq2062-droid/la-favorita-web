-- Ejecutar en pgAdmin tras la instalacion.
SELECT COUNT(*) AS productos_importados FROM catalogo_origen_facturador;
SELECT COUNT(*) AS productos_web FROM products;
SELECT b.name,COUNT(o.product_id) AS registros_oferta,
       COUNT(*) FILTER(WHERE o.active) AS ofertas_publicadas
FROM branches b JOIN offers o ON o.branch_id=b.id
GROUP BY b.name ORDER BY b.name;
SELECT COUNT(*) AS stock_negativo_origen FROM catalogo_origen_facturador WHERE stock_almacen_origen<0;
SELECT COUNT(*) AS productos_sin_foto FROM products p JOIN catalogo_origen_facturador x ON x.sku=p.sku WHERE p.image_url='';
SELECT categoria_propuesta,COUNT(*) FROM catalogo_origen_facturador GROUP BY categoria_propuesta ORDER BY 2 DESC;
SELECT sku,nombre_original,stock_almacen_origen,observaciones
FROM catalogo_origen_facturador WHERE stock_almacen_origen<0 ORDER BY stock_almacen_origen LIMIT 30;
SELECT * FROM v_precios_catalogo_admin LIMIT 20;
-- Presentaciones vacias hasta confirmar unidad/docena/caja y sus precios.
SELECT COUNT(*) AS presentaciones_pendientes FROM presentaciones_adicionales;
