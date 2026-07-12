# Pastisseria

Sistema web para gestionar la pastelería con:

- catálogo de productos sincronizado directamente desde Loyverse
- pedidos diarios y cierre del día
- facturación
- control horario de empleados
- PWA de fichaje compartido en `/fichar`
- base de datos PostgreSQL compatible con Neon
- autenticación de administrador para el panel principal

## Requisitos

- Node.js 20 o superior
- PostgreSQL 15+ o una base Neon

## Configuración rápida con base remota

1. Crea un proyecto en Neon.
2. Copia `.env.example` a `.env`.
3. Pega tu cadena de conexión en `DATABASE_URL`.

Ejemplo:

```env
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
DATABASE_SSL=true
VITE_API_URL=http://localhost:3001
ADMIN_NAME=Administrador
ADMIN_EMAIL=admin@pastisseria.local
ADMIN_PASSWORD=cambia-esta-clave
ADMIN_SESSION_TTL_HOURS=12
LOYVERSE_TOKEN=tu-token-de-loyverse
LOYVERSE_API_BASE_URL=https://api.loyverse.com/v1.0
TIME_TRACKING_DEVICE_ID=empresa_movil_01
TIME_TRACKING_QR_SECRET=cambia-este-secreto-en-produccion
VITE_TIME_TRACKING_DEVICE_ID=empresa_movil_01
FORCE_PRODUCTS_SYNC=false
```

4. Instala dependencias:

```bash
npm install
```

5. Inicia la aplicación:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3001`

Acceso móvil de fichaje: `http://localhost:5173/fichar`

## Acceso administrador

La API principal ahora requiere sesión de administrador.

En el primer arranque, el backend crea:

1. `admin_users`
2. `admin_sessions`
3. un usuario administrador inicial con `ADMIN_EMAIL` y `ADMIN_PASSWORD`

En cada arranque, si defines `ADMIN_EMAIL` y `ADMIN_PASSWORD`, esa cuenta de administrador se sincroniza con la base de datos para que puedas recuperar el acceso con las credenciales del `.env`.

Si no defines `ADMIN_PASSWORD`, se usará la clave temporal del ejemplo. Cámbiala antes de publicar la app.

El flujo `/fichar` sigue separado para no romper el fichaje compartido de empleados.

## Importación desde Loyverse

El módulo de facturación puede preparar un borrador de factura a partir de un recibo de Loyverse.

1. Define `LOYVERSE_TOKEN` en el backend.
2. En `Facturación > Nueva factura`, escribe el número de recibo.
3. Pulsa `Cargar recibo`.
4. Revisa el borrador importado y emite la factura.

La llamada a Loyverse se hace solo desde el servidor para no exponer el token en el navegador. Esta integración usa el endpoint indicado por el proyecto: `GET /receipts/{receipt_number}`.
Para ajustar correctamente el IVA de cada línea, el backend consulta además el artículo relacionado por `item_id` en Loyverse.

## Despliegue para usarla desde cualquier ordenador

1. Publica el backend Express en un servidor accesible por internet.
2. Usa una base PostgreSQL remota, por ejemplo Neon.
3. Configura `DATABASE_URL` en el backend.
4. Configura `VITE_API_URL` en el frontend apuntando a la URL pública del backend.
5. Define una contraseña robusta en `ADMIN_PASSWORD`.
6. Sirve todo por HTTPS.

Si sirves el frontend con `vite preview`, con archivos estáticos o desde otro dominio distinto al backend, define `VITE_API_URL` para que las peticiones no dependan solo del proxy de desarrollo.

### Vercel

El proyecto incluye una función Express en `api/index.js`, por lo que frontend y API
pueden compartir el mismo dominio. En Vercel configura `DATABASE_URL`, `DATABASE_SSL`,
`ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_TTL_HOURS`,
`LOYVERSE_TOKEN` y `TIME_TRACKING_QR_SECRET`. Elimina `VITE_API_URL` o déjala vacía
para usar la API del mismo despliegue.

## Flujo de fichaje PWA

1. En `Personal > Empleados` crea o edita cada trabajador.
2. Define:
   - `PIN de fichaje`
   - `Código acceso móvil` unico, por ejemplo `laia-font`
3. Copia el `Payload QR seguro` de cada empleado y conviertelo en su QR fisico.
4. Abre `/fichar` en el movil compartido de empresa.
5. El trabajador ficha con PIN o escaneando su QR.
6. La pantalla se reinicia sola tras cada registro.

## PWA

El proyecto ya incluye:

- `manifest.webmanifest`
- `service worker`
- `start_url` en `/fichar`
- validacion por `deviceId` en backend para el terminal compartido

Para dejarla lista como PWA completa:

1. Añade iconos PNG de `192x192` y `512x512` en `public/`.
2. Sirve el frontend en HTTPS.
3. Mantén la ruta `/fichar` con fallback SPA en producción.
4. Verifica la instalabilidad desde Chrome DevTools > Application.

## Estructura

- `server/`: API Express y lógica de negocio
- `src/`: interfaz React
- `public/`: manifiesto y service worker
- `generated-orders/`: CSV diarios generados
