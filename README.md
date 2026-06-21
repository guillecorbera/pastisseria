# Pastisseria

Sistema web para gestionar la pastelería con:

- catálogo de productos importado desde `export_items.csv`
- pedidos diarios y cierre del día
- facturación
- control horario de empleados
- PWA de fichaje compartido en `/fichar`
- base de datos PostgreSQL compatible con Neon

## Requisitos

- Node.js 20 o superior
- PostgreSQL 15+ o una base Neon

## Configuración rápida con Neon

1. Crea un proyecto en Neon.
2. Copia `.env.example` a `.env`.
3. Pega tu cadena de conexión en `DATABASE_URL`.

Ejemplo:

```env
PORT=3001
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
VITE_API_URL=http://localhost:3001
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

Si sirves el frontend con `vite preview`, con archivos estáticos o desde otro dominio distinto al backend, define `VITE_API_URL` para que las peticiones no dependan solo del proxy de desarrollo.

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
