# La Favorita · Plataforma comercial

Sitio web y administración de catálogo para cuatro sucursales. Desarrollado con Node.js, JavaScript y CSS. Los productos, precios, stock, campañas y configuración se administran por sucursal.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL para datos persistentes en producción (Neon compatible).

## Desarrollo local

```bash
npm install
npm start
```

Web: `http://127.0.0.1:3000/`  
Administración: `http://127.0.0.1:3000/admin/`

Si `DATABASE_URL` no está definida, la aplicación usa un archivo local editable (`data/current.json`) y lo inicializa a partir de `data/catalog-bootstrap.json`. El archivo editable no se incluye en Git; el catálogo inicial sí. Los cambios del modo local no se transfieren automáticamente a PostgreSQL.

## Variables de entorno

Consulta `.env.example`. En un servidor de producción se requieren, como mínimo:

- `DATABASE_URL`: conexión privada a PostgreSQL.
- `ADMIN_PASSWORD`: contraseña privada del administrador.
- `SESSION_SECRET`: secreto aleatorio para la sesión.
- `NODE_ENV=production` y `HOST=0.0.0.0`.

No subas `.env`, claves privadas ni archivos de datos locales. `render.yaml` contiene la configuración general de despliegue.

## Datos de producción

Las migraciones SQL que utiliza el servidor están en `db/`. No ejecutes importaciones de ejemplo sobre una base existente. Antes de migrar, haz un respaldo y comprueba que Neon contiene el catálogo comercial completo y los precios correctos por sucursal. La aplicación no sobrescribe ni reimporta automáticamente el catálogo al desplegarse.

El archivo `data/catalog-bootstrap.json` es un catálogo inicial publicable, no un respaldo continuo de Neon. Las modificaciones del administrador se guardan en la base conectada y no deben reemplazarse por datos del archivo local.

## Funcionalidades

- Catálogo de ancho extendido con cinco columnas en pantallas amplias, columnas adaptables en móviles, búsqueda, filtros y carga manual de 24 productos por bloque.
- Portada de sucursal con categorías ilustradas, franja de marcas tomada del catálogo y elementos decorativos de temporada.
- Precios, publicación y stock independientes por sucursal.
- Promociones y banners editables por sucursal: precio independiente del catálogo, descripción, fecha de vencimiento, cuenta regresiva, tarjetas opcionales, degradados configurables e imagen ambiental independiente con control de opacidad y posición.
- Comparador de 2 a 4 artículos seleccionados por el usuario.
- Cotizador escolar por imagen o PDF; lectura automática disponible únicamente con la API correspondiente configurada.
- Calculadora de copias, impresiones y escaneos.
- Panel de administración con controles de identidad visual, sucursales, productos, promociones y tarifas.
- Ambiente de la sección «Más soluciones, menos complicaciones» personalizable por sucursal: imagen tenue, posición, opacidad y degradado. Los títulos degradados se muestran sin esperas por palabra.

Los precios de los banners comerciales son independientes de los productos del catálogo. Un banner sin precio asignado muestra «Consultar»; nunca toma de manera automática el precio de un producto ajeno. Vincular expresamente un producto es opcional. Si configuras un precio anterior debe ser mayor al precio vigente. Un banner con fecha de vencimiento desaparece del carrusel al caducar, pero permanece en el panel administrativo para poder corregirlo o reutilizarlo. La vigencia se interpreta con la zona horaria local del navegador al guardar y se persiste en UTC. Las paletas predefinidas se pueden reemplazar mediante el selector de colores.

La web no procesa pagos. Los precios y la disponibilidad están sujetos a confirmación por la sucursal. El sistema de múltiples presentaciones comerciales (unidad, docena, caja, etc.) es una ampliación posterior y no está habilitado todavía.

La imagen del ambiente de **«Más soluciones»** se cambia desde **Admin → Ambiente de secciones**. La imagen ambiental del **carrusel principal** se cambia por separado desde **Admin → Banners de tienda → Editar banner → Fondo ambiental del carrusel**. Allí puedes elegir una imagen temática, colocar una URL HTTPS o ajustar la opacidad y la posición. Si dejas la ruta vacía, se selecciona automáticamente un recurso temático según la paleta del banner. Los cambios se guardan por sucursal en la misma persistencia comercial, sin nuevas tablas ni importaciones. Los controles no permiten subir archivos directamente del ordenador; para imágenes propias utiliza una URL pública HTTPS o incluye el recurso en el proyecto.

## Verificación

```bash
npm run check
npm test
```

## Directorios

| Carpeta | Contenido |
|---|---|
| `public/` | Web pública, estilos y animaciones |
| `admin/` | Panel administrativo |
| `server/` | API y persistencia de datos |
| `db/` | Esquema y migraciones activas de PostgreSQL |
| `data/` | Datos de inicio; el estado local editable se excluye de Git |
| `scripts/` | Pruebas y utilidades de mantenimiento |

## Escaparate comercial (V45)

Desde **Administración → Escaparate comercial** se configura por sucursal:

- **Categorías visibles en Mi tienda:** añadir y quitar fichas, modificar su destino, su texto y su imagen, y cambiar el orden. Esto afecta a los accesos directos de la portada de sucursal, **no elimina las categorías de PostgreSQL ni sus productos**.
- **Marcas y logotipos:** activar y desactivar marcas, añadir archivos PNG/JPG/WebP pequeños (se comprimen antes del guardado) o usar URLs HTTPS. No requiere un servidor de subida de archivos adicional: las imágenes comprimidas se guardan en el estado de configuración. Se recomienda usar URLs HTTPS para catálogos grandes de logotipos.
- **Producto destacado de Promociones:** mostrar el de mayor descuento, el de menor precio con descuento, seleccionar un producto publicado, u ocultar el bloque; el precio procede de la sucursal activa. El título, la imagen y el degradado se pueden editar.

Los cambios se guardan en `lf_commerce_state` cuando `DATABASE_URL` está configurada. El formato anterior es compatible: cuando no existe configuración V45 se conservan las fichas y las marcas predeterminadas.

## Presentación de promociones (V46)

- **Mi tienda → Los más buscados:** el carrusel aprovecha casi todo el ancho de la ventana; muestra cinco artículos simultáneos en pantallas amplias y se adapta a móviles.
- **Promociones:** el escaparate destacado tiene un ancho mayor y una distribución de texto, precio e imagen que aprovecha mejor el espacio central.
- **Admin → Escaparate comercial → Producto protagonista en Promociones:** permite cambiar el degradado, la palabra decorativa de fondo y su color, además de la imagen ambiental, opacidad y posición. Las opciones se guardan por sucursal, sin modificar el precio real del catálogo.
- Para usar una imagen del proyecto, selecciona una de las rutas sugeridas en el campo de imagen ambiental. Para desactivar el efecto de la fotografía, establece la opacidad en `0`.

El módulo conserva los valores de configuración existentes y es compatible con los banners anteriores. No requiere migraciones SQL nuevas.
