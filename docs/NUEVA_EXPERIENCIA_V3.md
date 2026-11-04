# Experiencia de usuario V3

## Rutas públicas

`/` elección de tienda. `/tienda/:id` portada de tienda. `/tienda/:id/catalogo` búsqueda y filtros. `/tienda/:id/categoria/:categoria` accesos desde tarjetas. `/tienda/:id/ofertas` descuentos registrados. `/tienda/:id/novedades` nuevos productos. `/tienda/:id/comparar` grupos compatibles por uso y presentación. `/tienda/:id/producto/:producto` ficha propia y matriz de las cuatro sucursales. `/tienda/:id/cotizar` cotización por texto, o PDF/foto si hay IA configurada.

## Sistema visual

Base grafito/violeta, magenta/coral, turquesa/menta, lavanda y amarillo suave. Tarjetas elevables, círculos luminosos, efecto de profundidad en portada, transparencia controlada, transiciones breves. Las ilustraciones SVG son producidas exclusivamente como muestras genéricas y no se atribuyen a fabricantes. Se evita mostrar una imagen distinta como si fuera el modelo comercial real.

## Datos compartidos

El panel escribe a la misma API consumida por la web pública. La sucursal elegida condiciona las ofertas y existencias. Un producto no se duplica por sucursal. El comparador se alimenta de `comparisonGroup` y de las ofertas de la tienda; la ficha muestra la matriz de precios consultando `/api/price-check/:productId`.

## Cotizador

La lectura por texto es una funcionalidad activa que usa `/api/school-quote`. La prueba precargada contiene productos equivalentes de varios precios, más una línea no encontrada. El servidor devuelve solo un importe total y listas de incidencias, no precios de renglones. La extracción de imágenes/PDF se delega a una API externa, activada solo por servidor. En ausencia de clave, la interfaz indica explícitamente que el modo archivo no está disponible y facilita la prueba por texto.

## Límites honestos de la entrega

Los 50 productos son provisionales. Las ilustraciones no son fotografías originales de artículos. No se ha conectado Neon ni habilitado un lector real de archivos sin configurar la clave. La infraestructura de Render Free es apta para comenzar pruebas, no para operar ventas críticas sin medidas adicionales.
