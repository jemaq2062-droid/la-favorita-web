# Contrato API y modelo de datos — La Favorita

## Arquitectura

```text
CLIENTE (/) ─┐
             ├── HTTPS /api ── Node.js ── PostgreSQL (Neon) / JSON local
ADMIN (/admin)┘                         │
                                       └── Imagen externa por URL (almacenamiento futuro)
```

La web y el panel consumen los mismos datos; el navegador nunca recibe la contraseña de Neon. Las rutas públicas son de solo lectura. Las modificaciones se realizan en endpoints administrativos autenticados.

## Endpoints públicos

- `GET /api/health`: estado del servidor y modo de persistencia.
- `GET /api/version`: contador de cambios (para actualización automática).
- `GET /api/bootstrap`: ajustes generales, categorías y cuatro sucursales visibles.
- `GET /api/store/:id`: sucursal, campañas vigentes, secciones, categorías, productos y ofertas de dicha sucursal.

`GET /api/store/sucursal-1` responde con la forma:

```json
{
  "version": 1,
  "settings": { "businessName": "La Favorita", "showProvisionalNotice": true },
  "branch": { "id": "sucursal-1", "name": "Sucursal 01" },
  "branches": [],
  "categories": [],
  "sections": [],
  "campaigns": [],
  "products": [
    {
      "id": "prod-0001",
      "sku": "LF-00001",
      "name": "Lapicero BP-S azul",
      "brand": "Pilot",
      "categoryId": "escritura",
      "unitLabel": "unidad",
      "unitsPerPack": 1,
      "netContent": null,
      "netUnit": null,
      "imageUrl": "",
      "price": 2.5,
      "compareAt": null,
      "stock": 115,
      "minStock": 5
    }
  ]
}
```

El ejemplo ilustra el formato, no un precio de venta verificado.

## Autenticación del panel

- `POST /api/auth/login` con `{"password":"..."}`: establece cookie HttpOnly con sesión firmada y vencimiento de 12 horas.
- `GET /api/auth/me`: comprueba sesión.
- `POST /api/auth/logout`: revoca sesión.

El servidor aplica control por contraseña, limitación básica de intentos y cookie `SameSite=Strict` por defecto. Las escrituras requieren cookie de sesión válida y comprobación de origen. En producción, usa HTTPS y una clave robusta. Es autenticación de un solo administrador; **no equivale** a un sistema de personal con roles, MFA y auditoría.

## Operaciones administrativas

- `GET /api/admin/state`: todas las colecciones necesarias para el panel.
- `PATCH /api/admin/branches/:id`: editar tarjeta y datos de sucursal.
- `POST /api/admin/products`: crear producto y cuatro ofertas inicialmente a cero.
- `PATCH /api/admin/products/:id`: editar producto, SKU, presentación e imagen.
- `PUT /api/admin/offers/:branchId/:productId`: precio, precio anterior, stock, stock mínimo y visibilidad de una sucursal.
- `POST /api/admin/campaigns`: crear campaña.
- `PATCH /api/admin/campaigns/:id`: actualizar campaña.
- `DELETE /api/admin/campaigns/:id`: eliminar campaña.
- `PUT /api/admin/sections`: guardar orden y visibilidad de secciones.
- `PATCH /api/admin/settings`: actualizar colores, textos y aviso de provisionalidad.

## Tablas PostgreSQL

| Tabla | Función |
|---|---|
| `branches` | Una fila por sucursal; nombre, dirección, horario, color. |
| `categories` | Catálogo de categorías. |
| `products` | SKU, marca, variante, cantidad por presentación, contenido, imagen. |
| `offers` | Precio y stock de un producto en una sucursal. Clave compuesta. |
| `campaigns` | Programación anual por fechas y sucursales, prioridad. |
| `sections` | Orden y visibilidad de los bloques de contenido. |
| `settings` | Configuraciones editables. |
| `app_meta` | Número de versión para refresco automático. |

La base futura de ventas podrá incorporar `sales`, `sale_items`, `stock_movements`, `stock_packages`, `users` y `roles`. No se implementaron esas tablas todavía porque no existe un flujo de cobro ni un diseño confirmado para apertura de cajas y unidades sueltas. Evitamos simular ventas que no funcionan.

## Imágenes

`products.image_url` es un URL HTTP(S). Si viene vacío o falla al cargar, la tienda presenta un recuadro vacío. No se utilizan fotos de productos de terceros sin permiso. Conectaremos almacenamiento de imágenes y subida desde el panel cuando se elija proveedor.

## Extensión V2

- `GET /api/compare/:sucursal`: grupos comparables dentro de una sucursal.
- `GET /api/price-check/:producto`: precio/stock del mismo SKU en las cuatro sucursales.
- `GET /api/ai/status`: indica si se configuró lectura con IA.
- `POST /api/school-quote`: `{branchId, tier, text}` para texto o `{branchId, tier, file:{filename,mimeType,base64}}` para PDF/imagen. Solo responde el precio total y artículos faltantes/no entendidos; no envía desglose.

Los campos de productos añadidos son: `subCategory`, `model`, `usage`, `features`, `searchAliases`, `comparisonGroup`, `comparisonLabel` y `qualityTier`. El panel administrativo permite cambiarlos sin editar código.


**Cambios V4:** la API pública `/api/price-check/:productId` se retiró para no publicar la comparación de precios entre tiendas. Las fotos de sucursales se administran en `branches.photo_url`, con `PATCH /api/admin/branches/:id` (campo `photoUrl`). Los productos siguen usando `imageUrl`.
