> **V6:** rediseño de tonos suaves, selector desplegable de sucursales, WhatsApp y tarjetas más expresivas. Incluye la corrección previa del servidor.

**V5 corregida:** se reparó el servidor para servir los estilos `/v4.css` y `/v5.css` que faltaban. La V5 anterior mostraba el tema oscuro por un error de enrutamiento de archivos.

# La Favorita — Web V6

**Web multipágina de La Favorita**, renovada con una paleta azul pizarra de brillo moderado, un encabezado azul petróleo, el logo con fondo transparente, cuatro tarjetas de sucursales visibles desde el inicio y fotografías ilustrativas. Conserva el catálogo, los filtros, las fichas individuales, el comparador por sucursal, el cotizador escolar y el panel de administración.

## Ejecutar en Windows

1. Descomprime `LaFavorita_Web_V6.zip` y abre la carpeta `LaFavoritaWeb_v6` en VS Code.
2. En la terminal PowerShell, ejecuta `npm start` (Node.js 20 o superior).
3. Abre **http://localhost:3000**. Panel de edición: **http://localhost:3000/admin/**.

Si aparece `EADDRINUSE` por el puerto 3000:

```powershell
$env:PORT=3001
npm start
```

En ese caso, abre `http://localhost:3001` y `http://localhost:3001/admin/`.

La contraseña local de desarrollo inicialmente es `cambia-esta-clave`. **Cámbiala antes de publicar** con `$env:ADMIN_PASSWORD='una-clave-larga-segura'` y considera las variables de `.env.example`.

## Novedades V6

- El tema ahora combina gris pizarra, azul suave, magenta y turquesa. Se redujo el blanco intenso del catálogo, filtros y portada.
- Las cuatro tarjetas de sucursales muestran fotos referenciales más grandes, botones coloreados y un movimiento suave al pasar el cursor.
- **Cambiar sucursal:** pulsa el nombre de la tienda en el encabezado para desplegar las cuatro sucursales con foto, dirección y acceso directo. Al elegir otra se mantiene la página que estabas viendo (catálogo, cotizador, etc.) y se actualizan sus precios y existencias.
- **WhatsApp:** el botón **Contáctanos** abre `https://wa.me/51903470891`; se encuentra en la cabecera, menú móvil, pie y acceso flotante. El número se usa con el prefijo de Perú `51`.
- Se mantienen los comparadores **dentro de la sucursal seleccionada**. Los datos comerciales siguen siendo provisionales.
- Los CSS y JS tienen versión en URL para forzar una actualización; el servidor los envía sin caché para facilitar las pruebas locales.

## Pantallas y funciones

| Ruta | Función |
| --- | --- |
| `/` | Elegir entre las 4 sucursales, con nombre, foto referencial, dirección y horario |
| `/tienda/sucursal-1` | Inicio de la tienda seleccionada: promociones, novedades, categorías, cotización |
| `/tienda/sucursal-1/catalogo` | Buscar por nombre/marca, filtrar, ordenar y añadir a una lista |
| `/tienda/sucursal-1/producto/prod-0001` | Ficha individual con modelo, características, precio y stock |
| `/tienda/sucursal-1/comparar` | Comparar artículos equivalentes **únicamente en esa sucursal** |
| `/tienda/sucursal-1/cotizar` | Cotizar lista escolar en 3 modalidades; un total más productos faltantes |
| `/admin/` | Panel privado de edición |

Sustituye `sucursal-1` por `sucursal-2`, `sucursal-3` o `sucursal-4`.

**Cómo funciona la portada:** no hay un hero gigante antes de las tarjetas. La selección de sucursales está inmediatamente debajo de un título breve. En pantallas pequeñas aparecen dos tarjetas por fila y en pantallas muy estrechas, una.

**Fotografías:** se conservan imágenes ilustrativas locales para las sucursales y los tipos de producto, **no son fotos reales ni acreditaciones de stock**. Los datos iniciales de dirección y horario son marcadores editables; no se inventaron ubicaciones. La fotografía oficial de cada producto sustituye automáticamente su imagen referencial cuando se configura `imageUrl`.

## Comparador y cotización

El botón **Comparar** está en cada tarjeta y ficha. Agrupa productos de características y presentación equivalentes que estén disponibles en la sucursal activa. La web pública no expone precios de las otras sucursales.

El cotizador ofrece modalidades **Económica, Equilibrada y Calidad prioritaria**. Su simulación por texto calcula utilizando el catálogo actual y muestra **un único total**, más un apartado de artículos no entendidos, sin stock o no encontrados. Para activar lectura real de PDFs e imágenes escolares, debes configurar en el servidor una clave de API de visión:

```powershell
$env:OPENAI_API_KEY='TU_CLAVE'
$env:OPENAI_VISION_MODEL='gpt-4.1-mini'
npm start
```

Esto puede generar cargos de API independientes de ChatGPT. No incluyas la clave en frontend, ZIP públicos ni repositorios.

## Base de datos y despliegue

El proyecto es **independiente del anterior**. Actualmente funciona con datos locales: **50 productos provisionales**, cada uno con precio y stock separados por sucursal. El esquema PostgreSQL está en `db/schema.sql`, junto con adaptadores e importador. Para usar Neon, instala `pg` (`npm install pg`) y configura `DATABASE_URL` en el servidor, luego comprueba la persistencia con una base real antes de desplegar.

**Importante:** el almacenamiento local no es persistente en los servicios gratuitos con sistema de archivos efímero como Render. Los datos provisionales, stock, direcciones y horarios deben reemplazarse por los reales antes de operar comercialmente. Revisa además contraseñas, políticas de imagen, permisos y pruebas end-to-end en tu entorno.

## Verificaciones

```powershell
npm run check
node scripts/smoke-test.mjs
```

Las comprobaciones de API incluyen 4 sucursales, cotización por modalidad, comparación dentro de sucursal, productos, stock, campañas y administración. Las capturas de revisión visual V6 se encuentran en `docs/v6-*.png`. El entorno de navegador de pruebas bloquea las direcciones de red locales; para comprobar la navegación completa desde Chrome o Edge, ejecuta la web en tu equipo.

### Evolución del diseño

- Identidad real con logo transparente y eslogan legible en encabezado oscuro.
- Portada directa, sin espacio inicial desproporcionado.
- Nueva paleta: marfil frío, blancos, azul petróleo, magenta y turquesa.
- Tarjetas de sucursales con imágenes, transiciones y sombras suaves.
- Filtros más visibles y tarjetas de catálogo mucho más legibles.
- Detalles de productos, comparación y cotización con mejor contraste.
- Indicador discreto de avance de lectura al desplazarse por la página.
- Mantiene los módulos y API de la V4, sin tocar la base universitaria anterior.
