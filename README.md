# La Favorita — Plataforma web multi-sucursal

Catálogo por sucursal, campañas, ofertas programadas, cotizaciones, servicios y panel de administración. Proyecto Node.js y JavaScript/CSS, sin framework frontend.

## Inicio rápido (Node.js 20+)

```bash
npm install
npm start
```

La tienda se abre en `http://127.0.0.1:3000/` y el panel en `http://127.0.0.1:3000/admin/`. Para desarrollo local, si no se ha configurado `ADMIN_PASSWORD`, la clave predeterminada es `libreria`. **No utilices esa clave en producción**: configura una contraseña privada con la variable `ADMIN_PASSWORD` y un `SESSION_SECRET` propio.

Para desarrollo con PostgreSQL, revisa `.env.example` y usa `npm run start:db`. Si clonas el repositorio sin `data/current.json` y deseas probar los 1,334 productos publicados de la Sucursal 01 en modo local, establece `INITIAL_CATALOG_FILE=data/catalog-bootstrap.json` antes de arrancar. Si `DATABASE_URL` está definida, se utiliza PostgreSQL en lugar del archivo local. La aplicación crea sus tablas y aplica las migraciones disponibles en `db/`. Usa una base dedicada: al conectarte a una base existente puede modificar su esquema. **Haz un respaldo antes de migrar datos existentes.**

## Catálogo, configuración y datos

- **Modo local:** `data/current.json` guarda el estado editable del negocio (productos, precios y sucursales). No se versiona en Git para evitar sobrescribir ediciones reales. El ZIP completo incluye una copia para ejecutar la tienda inmediatamente.
- **Respaldo público de catálogo:** `data/catalog-bootstrap.json` contiene una copia del catálogo y los precios que la tienda ya muestra. El despliegue Render sin PostgreSQL puede iniciarlo con `INITIAL_CATALOG_FILE=data/catalog-bootstrap.json`. Antes de subir a un repositorio **público**, revisa que los precios, teléfonos y demás datos publicados sean los que deseas difundir.
- **Datos comerciales privados:** `data/commerce-v27.json` guarda cotizaciones y parámetros locales. Se excluye de Git. No lo reemplaces al actualizar.
- **Neon/PostgreSQL:** la instalación con base real necesita importar tu catálogo completo a PostgreSQL; el modo PostgreSQL NO toma automáticamente los 1,342 productos de `catalog-bootstrap.json`. Comprueba la importación antes de publicar.
- **Archivos de instalación:** `db/` contiene el esquema y scripts históricos de migración. Mantén esos archivos mientras existan instalaciones anteriores.

## Funciones y límites

Cada sucursal tiene precios, disponibilidad y diseño propios; cambiar una tienda no modifica las demás. El cotizador escolar acepta foto/PDF; la lectura automática requiere `OPENAI_API_KEY` y puede generar costes. Si no está configurada, la página debe informar que el análisis no está disponible. No se procesan pagos en la web. Las presentaciones múltiples (unidad/docena/caja) todavía están pendientes de un módulo integral y **no** deben asumirse como implementadas.

El panel permite publicar u ocultar artículos por sucursal y gestionar campañas, banners, tarifas y cotizaciones. La interfaz carga inicialmente 24 productos por lote mediante «Ver más».

## Calidad y despliegue

```bash
npm run check
npm test
```

La tienda pública carga `public/styles.css` y el panel `admin/styles.css`, conservando el orden CSS anterior en un solo archivo por interfaz para evitar conflictos de precedencia. Los controladores JS de animación se mantienen independientes y no requieren nuevas dependencias.

En Render u otros servicios efímeros, los archivos locales no garantizan persistencia. Si se configura `DATABASE_URL` en Render, importa el catálogo a esa base antes de publicar; el arranque NO hará la importación automáticamente. **Configura una base PostgreSQL persistente antes de usar el panel en producción**. `render.yaml` incluye la configuración base sin credenciales. Los secretos se definen en variables del proveedor, jamás en Git.

## Estructura

- `public/`: tienda y recursos (logos, ilustraciones, animaciones).
- `admin/`: acceso y panel de control.
- `server/`: API, almacenamiento, cotizaciones y reglas comerciales.
- `db/`: esquema y migraciones PostgreSQL.
- `data/`: catálogo inicial y datos locales (parte excluida de Git).
- `scripts/`: pruebas, importación CSV y respaldo.
