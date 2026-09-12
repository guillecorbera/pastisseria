# Implementación de fichaje mediante QR dinámico por empleado

## 1. Objetivo

Implementar en la aplicación de control horario un nuevo sistema de fichaje mediante **QR dinámico y temporal generado en el móvil personal del trabajador**.

El objetivo principal es evitar que:

- Un empleado pueda fichar utilizando el QR fijo de otro trabajador.
- Un trabajador pueda compartir una captura de pantalla de su QR para que otra persona fiche por él.
- Un QR pueda reutilizarse varias veces.
- Los datos personales del trabajador queden expuestos dentro del QR.

El sistema actual de fichaje mediante **clave + PIN** debe seguir funcionando.

El nuevo sistema de QR debe añadirse como un método adicional de fichaje.

---

# 2. Arquitectura general

La aplicación tendrá conceptualmente tres partes:

1. **Aplicación del empleado**
2. **Terminal/Kiosco de fichaje**
3. **Backend**

Arquitectura recomendada:

```text
┌─────────────────────────┐
│ Móvil del trabajador    │
│                         │
│ React / PWA             │
│                         │
│ Generar QR              │
└────────────┬────────────┘
             │
             │ HTTPS
             ▼
┌─────────────────────────┐
│ Backend Express         │
│                         │
│ Autenticación           │
│ Tokens QR               │
│ Validación              │
│ Registro de fichajes    │
└────────────┬────────────┘
             ▲
             │ HTTPS
             │
┌────────────┴────────────┐
│ Terminal de fichaje     │
│                         │
│ React                   │
│ Cámara / lector QR      │
└─────────────────────────┘
```

---

# 3. Flujo básico de funcionamiento

## 3.1. Identificación del trabajador

El trabajador accede desde su teléfono personal a una ruta específica, por ejemplo:

```text
/empleado
```

El empleado debe iniciar sesión.

La autenticación puede utilizar el sistema actual si ya existe.

Ejemplo:

```text
Usuario
+
PIN
```

o:

```text
email
+
contraseña
```

Opcionalmente, en una fase posterior, se podrá añadir autenticación biométrica mediante:

```text
WebAuthn / Passkeys
```

---

# 4. Generación del QR

Una vez autenticado, el trabajador tendrá un botón:

```text
GENERAR QR PARA FICHAR
```

Al pulsarlo:

```text
Móvil empleado
        ↓
POST /api/attendance/qr/create
        ↓
Backend
        ↓
Genera token aleatorio
        ↓
Guarda token temporal
        ↓
Devuelve token al móvil
        ↓
React genera QR
```

El QR debe tener una duración muy corta.

Recomendación:

```text
30 - 60 segundos
```

Valor inicial recomendado:

```text
45 segundos
```

---

# 5. Características obligatorias del QR

Cada QR debe ser:

- Único.
- Temporal.
- De un solo uso.
- Generado por el servidor.
- Asociado internamente a un empleado.
- Imposible de reutilizar después de un fichaje.
- Imposible de utilizar una vez caducado.

NO crear QR permanentes.

NO utilizar como contenido del QR:

```text
ID empleado
DNI
NIF
Nombre
Email
PIN
Contraseña
```

El QR debe contener únicamente un token aleatorio.

Ejemplo conceptual:

```text
3f95be2a-6ef8-4c61-9088-a4529d49a127
```

Preferiblemente utilizar:

```text
crypto.randomBytes()
```

o:

```text
crypto.randomUUID()
```

del módulo `crypto` de Node.js.

---

# 6. Tabla de tokens QR

Crear una tabla similar a:

```sql
CREATE TABLE attendance_qr_tokens (
    id BIGSERIAL PRIMARY KEY,

    employee_id BIGINT NOT NULL,

    token_hash VARCHAR(255) NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    expires_at TIMESTAMPTZ NOT NULL,

    used_at TIMESTAMPTZ NULL,

    created_device_id BIGINT NULL,

    used_terminal_id BIGINT NULL,

    CONSTRAINT fk_qr_employee
        FOREIGN KEY (employee_id)
        REFERENCES employees(id)
);
```

No es imprescindible guardar el token original.

Es preferible almacenar:

```text
SHA-256(token)
```

y enviar al móvil únicamente el token original.

Así, aunque alguien tuviera acceso a la base de datos, no podría utilizar directamente los tokens almacenados.

---

# 7. Generación segura del token

Ejemplo conceptual en Express:

```js
import crypto from "crypto";

const token = crypto.randomBytes(32).toString("hex");

const tokenHash = crypto
  .createHash("sha256")
  .update(token)
  .digest("hex");
```

Guardar:

```text
tokenHash
employeeId
createdAt
expiresAt
usedAt = null
```

Devolver al frontend solamente:

```json
{
  "token": "TOKEN_GENERADO",
  "expiresAt": "2026-09-12T08:30:45.000Z"
}
```

---

# 8. Endpoint para generar QR

Crear:

```http
POST /api/attendance/qr/create
```

Debe requerir autenticación del empleado.

Nunca aceptar:

```json
{
  "employeeId": 25
}
```

como dato proporcionado por el frontend para decidir qué trabajador genera el QR.

El backend debe obtener el empleado desde:

```js
req.user
```

o desde la sesión autenticada.

Ejemplo conceptual:

```js
router.post(
  "/attendance/qr/create",
  requireEmployeeAuth,
  createAttendanceQr
);
```

---

# 9. Evitar múltiples QR activos

Un empleado no debería poder tener muchos QR activos simultáneamente.

Antes de generar uno nuevo:

```text
Invalidar cualquier QR anterior no utilizado.
```

Ejemplo:

```sql
UPDATE attendance_qr_tokens
SET expires_at = NOW()
WHERE employee_id = $1
  AND used_at IS NULL
  AND expires_at > NOW();
```

Después crear el nuevo.

De esta forma:

```text
solo existe un QR activo por empleado
```

---

# 10. Interfaz del móvil del trabajador

La pantalla debe ser muy simple.

Ejemplo:

```text
┌────────────────────────────┐
│ Hola, Guillermo            │
│                            │
│ Genera tu código para      │
│ fichar en el terminal.     │
│                            │
│   [ GENERAR QR ]           │
│                            │
└────────────────────────────┘
```

Después:

```text
┌────────────────────────────┐
│ Código de fichaje          │
│                            │
│       █████████████        │
│       █ QR CODE ███        │
│       █████████████        │
│                            │
│ Caduca en: 00:38           │
│                            │
│ Acerca el móvil al lector  │
│                            │
└────────────────────────────┘
```

Mostrar una cuenta regresiva.

Por ejemplo:

```text
00:45
00:44
00:43
...
00:01
00:00
```

Cuando caduque:

```text
QR caducado
```

y mostrar:

```text
GENERAR NUEVO QR
```

---

# 11. Librería QR frontend

Se puede utilizar, por ejemplo:

```bash
pnpm add react-qr-code
```

o cualquier librería equivalente compatible con React.

Ejemplo:

```jsx
<QRCode value={token} />
```

---

# 12. Terminal/Kiosco de fichaje

Crear una vista tipo:

```text
/kiosk
```

o reutilizar la pantalla actual de fichaje.

Debe disponer de:

```text
Fichar con PIN
```

y:

```text
Fichar con QR
```

Ejemplo:

```text
┌─────────────────────────────┐
│ CONTROL HORARIO             │
│                             │
│ [ FICHAR CON PIN ]          │
│                             │
│ [ ESCANEAR QR ]             │
│                             │
└─────────────────────────────┘
```

---

# 13. Escáner QR

Utilizar la cámara del dispositivo.

Librerías posibles:

```text
html5-qrcode
```

o:

```text
@zxing/browser
```

Codex debe escoger una opción estable y compatible con React.

Al detectar un QR:

```text
detener temporalmente el escáner
```

para evitar que la cámara envíe el mismo código varias veces.

---

# 14. Validación del QR

El terminal enviará:

```http
POST /api/attendance/qr/validate
```

Ejemplo:

```json
{
  "token": "TOKEN_ESCANEADO"
}
```

El servidor deberá:

1. Calcular SHA-256 del token.
2. Buscarlo en la tabla.
3. Comprobar que existe.
4. Comprobar que no está caducado.
5. Comprobar que `used_at IS NULL`.
6. Comprobar que el empleado está activo.
7. Comprobar que el terminal está autorizado.
8. Registrar el fichaje.
9. Marcar inmediatamente el QR como usado.

---

# 15. Operación atómica

Es muy importante evitar que dos peticiones simultáneas puedan utilizar el mismo QR.

La validación y el fichaje deben realizarse dentro de una transacción.

Ejemplo conceptual:

```text
BEGIN

SELECT token
FOR UPDATE

↓

validar token

↓

crear fichaje

↓

marcar token como utilizado

COMMIT
```

Esto evita ataques o errores por doble lectura.

---

# 16. Marcado del QR como utilizado

Después de un fichaje correcto:

```sql
UPDATE attendance_qr_tokens
SET
    used_at = NOW(),
    used_terminal_id = $1
WHERE id = $2;
```

El código no podrá volver a utilizarse.

---

# 17. Respuesta del servidor

Ejemplo correcto:

```json
{
  "success": true,
  "employee": {
    "id": 25,
    "name": "Guillermo"
  },
  "attendance": {
    "type": "entrada",
    "time": "08:31"
  }
}
```

El terminal podría mostrar:

```text
✓ FICHAJE REGISTRADO

Guillermo

Entrada
08:31
```

durante 2-3 segundos.

Después volver automáticamente al lector.

---

# 18. Errores posibles

## Código caducado

```text
Código QR caducado.
Genera uno nuevo.
```

## Código ya utilizado

```text
Este código ya ha sido utilizado.
```

## Código inexistente

```text
Código QR no válido.
```

## Empleado inactivo

```text
El empleado no está autorizado para fichar.
```

## Terminal no autorizado

```text
Terminal de fichaje no autorizado.
```

---

# 19. Terminales autorizados

No permitir que cualquier navegador pueda enviar códigos QR al endpoint de fichaje.

Crear una tabla para dispositivos autorizados.

Ejemplo:

```sql
CREATE TABLE attendance_terminals (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    terminal_key_hash VARCHAR(255),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ
);
```

Ejemplos:

```text
Tablet recepción
Móvil entrada principal
Tablet almacén
```

---

# 20. Auditoría

Registrar información suficiente para auditar el fichaje.

Ejemplo tabla:

```text
attendance_events
```

Campos recomendados:

```text
id
employee_id
attendance_id
method
terminal_id
created_at
ip_address
user_agent
result
reason
```

`method` podría contener:

```text
PIN
QR
ADMIN
```

Ejemplo:

```text
employee_id: 25
method: QR
terminal_id: 2
result: SUCCESS
created_at: ...
```

---

# 21. No almacenar ubicación sin necesidad

El sistema básico de QR no necesita GPS.

No solicitar ubicación al trabajador simplemente para generar el QR salvo que exista una necesidad funcional específica.

El objetivo debe ser conseguir seguridad mediante:

```text
autenticación
+
QR temporal
+
terminal autorizado
+
token de un solo uso
```

---

# 22. Prevención frente a capturas de pantalla

Un QR temporal reduce mucho el riesgo pero no lo elimina completamente.

Un trabajador todavía podría:

```text
generar QR
↓
hacer captura
↓
enviarla inmediatamente
↓
otro trabajador escanearla
```

Por ello se recomienda implementar una segunda fase más segura.

---

# 23. Fase avanzada: Challenge-Response

Esta es la opción recomendada si se quiere dificultar seriamente que un empleado fiche por otro.

En lugar de que el móvil genere un QR de forma completamente independiente, el terminal de fichaje genera un desafío temporal.

Flujo:

```text
Terminal
   ↓
genera Challenge
   ↓
Móvil empleado
   ↓
obtiene Challenge
   ↓
solicita QR
   ↓
Backend firma:
Empleado + Challenge + expiración
   ↓
QR
   ↓
Terminal
   ↓
Backend valida
   ↓
Fichaje
```

---

# 24. Ejemplo conceptual del Challenge

El terminal mantiene un challenge activo:

```text
challengeId:
9e5f6e77...
```

Duración:

```text
30 segundos
```

El QR generado por el trabajador queda ligado a:

```text
employee_id
+
challenge_id
+
expires_at
```

Por tanto, aunque alguien copie el QR:

```text
solo funcionará para el terminal/challenge para el que fue generado.
```

---

# 25. Posible flujo visual Challenge-Response

Terminal:

```text
┌────────────────────────────┐
│ CONTROL HORARIO            │
│                            │
│ Código del terminal        │
│                            │
│       742 851              │
│                            │
└────────────────────────────┘
```

Empleado:

```text
Abrir aplicación
        ↓
Introducir / detectar 742851
        ↓
Generar QR
        ↓
Mostrar QR
        ↓
Escanear en terminal
```

También podría hacerse automáticamente utilizando otro QR mostrado por el terminal.

---

# 26. Opción recomendada de Challenge-Response

Una posible implementación sencilla:

El terminal muestra un pequeño QR llamado:

```text
QR DEL TERMINAL
```

El trabajador:

```text
1. Abre su aplicación.
2. Escanea el QR del terminal.
3. El backend identifica el terminal.
4. Genera un QR de fichaje ligado a ese terminal.
5. El trabajador muestra su QR.
6. El terminal lo escanea.
```

Esto demuestra que el teléfono del trabajador ha estado físicamente cerca del terminal en el momento del fichaje.

---

# 27. Autenticación biométrica

Como mejora adicional se recomienda permitir:

```text
Face ID
Touch ID
Huella Android
Windows Hello
```

mediante:

```text
WebAuthn / Passkeys
```

Flujo:

```text
Empleado pulsa:
GENERAR QR

↓

Navegador solicita huella / Face ID

↓

Autenticación correcta

↓

Backend genera QR
```

Esto dificulta que otra persona que tenga físicamente el teléfono del trabajador pueda generar el QR.

---

# 28. Registro del dispositivo del trabajador

Opcionalmente crear:

```text
employee_devices
```

Ejemplo:

```sql
CREATE TABLE employee_devices (
    id BIGSERIAL PRIMARY KEY,

    employee_id BIGINT NOT NULL,

    device_name VARCHAR(120),

    device_uuid VARCHAR(255),

    credential_id TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    last_seen_at TIMESTAMPTZ
);
```

Permitir al administrador:

```text
Ver dispositivos registrados
Revocar dispositivo
Registrar dispositivo nuevo
```

---

# 29. Seguridad

Aplicar obligatoriamente:

```text
HTTPS
```

Nunca enviar tokens QR por conexiones HTTP en producción.

Aplicar además:

```text
Helmet
Rate limiting
CORS restrictivo
Validación de inputs
Autenticación
Logs de seguridad
```

---

# 30. Rate limiting

Evitar generación masiva de QR.

Ejemplo:

```text
Máximo 10 solicitudes QR por minuto por empleado.
```

Aplicar también rate limit al endpoint:

```text
/api/attendance/qr/validate
```

---

# 31. Limpieza de tokens

Los tokens antiguos no necesitan conservarse indefinidamente.

Crear una tarea periódica para eliminar tokens antiguos.

Por ejemplo:

```sql
DELETE FROM attendance_qr_tokens
WHERE created_at < NOW() - INTERVAL '30 days';
```

La información histórica del fichaje debe conservarse en la tabla de fichajes, no en los tokens QR.

---

# 32. Modelo conceptual de fichaje

Si ya existe una tabla de fichajes, reutilizarla.

Ejemplo:

```text
attendance
```

Campos recomendados:

```text
id
employee_id
type
timestamp
method
terminal_id
created_at
```

`type`:

```text
CLOCK_IN
CLOCK_OUT
BREAK_START
BREAK_END
```

según el modelo actual.

`method`:

```text
PIN
QR
ADMIN
```

---

# 33. Compatibilidad con el sistema actual

No eliminar el fichaje existente.

El sistema final debe permitir:

```text
Fichaje mediante PIN
```

y:

```text
Fichaje mediante QR dinámico
```

ambos utilizando la misma lógica central de registro de jornada.

Evitar duplicar código.

Crear un servicio común:

```js
createAttendanceEvent()
```

o equivalente.

Tanto PIN como QR deben llamar al mismo servicio.

---

# 34. Estructura recomendada backend

Ejemplo:

```text
server/
│
├── controllers/
│   ├── attendanceController.js
│   └── qrAttendanceController.js
│
├── routes/
│   ├── attendanceRoutes.js
│   └── qrAttendanceRoutes.js
│
├── services/
│   ├── attendanceService.js
│   ├── qrTokenService.js
│   └── terminalService.js
│
├── middleware/
│   ├── auth.js
│   ├── terminalAuth.js
│   └── rateLimit.js
│
└── utils/
    └── crypto.js
```

---

# 35. Estructura recomendada React

Ejemplo:

```text
src/
│
├── pages/
│   ├── EmployeeQrPage.jsx
│   └── KioskPage.jsx
│
├── components/
│   ├── EmployeeQr/
│   │   ├── QrGenerator.jsx
│   │   └── QrCountdown.jsx
│   │
│   └── Kiosk/
│       ├── QrScanner.jsx
│       ├── PinAttendance.jsx
│       └── AttendanceResult.jsx
│
└── services/
    ├── attendanceApi.js
    └── qrApi.js
```

---

# 36. UI

La interfaz debe ser:

- Muy sencilla.
- Visual.
- Adaptada a móvil.
- Con botones grandes.
- Con mensajes claros.
- Sin información técnica visible para el trabajador.

Utilizar Tailwind CSS.

Ejemplo de colores:

```text
Verde → fichaje correcto
Rojo → error
Amarillo → advertencia
Azul → acciones
Gris → información secundaria
```

Evitar interfaces saturadas.

---

# 37. Estados del componente QR

El frontend deberá contemplar:

```text
IDLE
GENERATING
ACTIVE
EXPIRED
SUCCESS
ERROR
```

Ejemplo:

```js
const [status, setStatus] = useState("IDLE");
```

---

# 38. No confiar en el reloj del móvil

La fecha de expiración debe determinarla siempre el backend.

Nunca confiar en:

```js
new Date()
```

del dispositivo del empleado para decidir si el QR sigue siendo válido.

La validación final debe realizarse utilizando:

```text
hora del servidor
```

---

# 39. Concurrencia

El sistema debe soportar que varios empleados fichen simultáneamente.

No utilizar variables globales en Node para guardar tokens.

Incorrecto:

```js
const qrTokens = {};
```

Los tokens deben almacenarse en:

```text
PostgreSQL
```

o en Redis si en el futuro se quiere optimizar.

PostgreSQL es suficiente para la primera implementación.

---

# 40. Índices recomendados

Crear índices:

```sql
CREATE INDEX idx_qr_employee
ON attendance_qr_tokens(employee_id);

CREATE INDEX idx_qr_expires
ON attendance_qr_tokens(expires_at);

CREATE UNIQUE INDEX idx_qr_token_hash
ON attendance_qr_tokens(token_hash);
```

---

# 41. Flujo completo recomendado

```text
EMPLEADO
   │
   │ login
   ▼
Aplicación móvil
   │
   │ generar QR
   ▼
Backend
   │
   ├── verifica empleado
   ├── invalida QR anterior
   ├── genera token
   ├── hash token
   ├── guarda token
   └── expiración 45s
   │
   ▼
Móvil muestra QR
   │
   ▼
Terminal escanea
   │
   ▼
POST /qr/validate
   │
   ▼
Backend
   │
   ├── hash token recibido
   ├── localiza token
   ├── comprueba expiración
   ├── comprueba used_at
   ├── comprueba empleado
   ├── comprueba terminal
   │
   ├── BEGIN TRANSACTION
   │
   ├── registra fichaje
   ├── marca QR usado
   │
   └── COMMIT
   │
   ▼
Terminal
   │
   ▼
FICHAJE CORRECTO
```

---

# 42. Plan de implementación para Codex

Implementar por fases.

## Fase 1

Analizar el sistema actual.

No modificar todavía funcionalidad existente.

Identificar:

```text
modelo employees
modelo attendance
autenticación
rutas de fichaje
pantalla actual de fichaje
```

---

## Fase 2

Crear:

```text
attendance_qr_tokens
```

Crear migración correspondiente.

---

## Fase 3

Implementar:

```text
POST /api/attendance/qr/create
```

con:

```text
autenticación
token seguro
hash
expiración
invalidación anterior
```

---

## Fase 4

Crear página React:

```text
/empleado/qr
```

con:

```text
Generar QR
Mostrar QR
Countdown
Caducidad
Regenerar
```

---

## Fase 5

Implementar escáner QR en terminal.

---

## Fase 6

Implementar:

```text
POST /api/attendance/qr/validate
```

con transacción de base de datos.

---

## Fase 7

Integrar QR con el sistema actual de fichajes.

PIN y QR deben llamar al mismo servicio de creación de fichajes.

---

## Fase 8

Añadir:

```text
attendance_terminals
```

y autorización de terminales.

---

## Fase 9

Añadir auditoría.

---

## Fase 10

Implementar opcionalmente:

```text
WebAuthn / Passkeys
```

---

## Fase 11

Implementar opcionalmente:

```text
Challenge-Response
```

para reforzar la presencia física del trabajador.

---

# 43. Tests necesarios

Crear tests para los siguientes escenarios.

### QR válido

```text
QR activo
+
empleado activo
+
terminal autorizado
=
fichaje correcto
```

### QR caducado

```text
expires_at < NOW()
=
rechazar
```

### QR utilizado

```text
used_at != NULL
=
rechazar
```

### QR falso

```text
token inexistente
=
rechazar
```

### Segundo QR

```text
Empleado genera QR A
Empleado genera QR B
```

Resultado:

```text
QR A inválido
QR B válido
```

### Doble escaneo simultáneo

Enviar dos peticiones al mismo tiempo.

Resultado esperado:

```text
solo una crea fichaje
```

### Terminal no autorizado

Resultado:

```text
rechazar fichaje
```

---

# 44. Consideraciones de privacidad

El QR nunca debe contener información personal visible.

No incluir:

```text
nombre
DNI
NIF
correo
número empleado
horario
```

El QR únicamente debe contener un identificador/token aleatorio.

La relación entre:

```text
token → empleado
```

solo debe conocerla el backend.

---

# 45. Prioridad de seguridad

Orden recomendado:

```text
1. HTTPS
2. Token aleatorio
3. Expiración 30-60 segundos
4. QR de un solo uso
5. Invalidar QR anterior
6. Terminal autorizado
7. Operación transaccional
8. Rate limiting
9. Auditoría
10. WebAuthn
11. Challenge-response
```

---

# 46. Resultado esperado

El trabajador debe poder realizar el fichaje aproximadamente así:

```text
1. Abre la aplicación en su móvil.

2. Se identifica.

3. Pulsa "Generar QR".

4. La aplicación muestra un QR durante aproximadamente 45 segundos.

5. Acerca su móvil al terminal de fichaje.

6. El terminal escanea el código.

7. El backend valida el código.

8. Se registra el fichaje.

9. El terminal muestra confirmación.

10. El QR queda inutilizado automáticamente.
```

---

# 47. Regla fundamental

La seguridad de este sistema nunca debe depender únicamente de que:

```text
el QR sea difícil de copiar
```

Debe depender de que:

```text
aunque alguien copie el QR,
el código tenga muy poca duración,
solo pueda utilizarse una vez
y el backend valide todas las condiciones.
```

---

# 48. Recomendación final de arquitectura

Primera versión:

```text
QR dinámico
+
45 segundos
+
un solo uso
+
login empleado
+
terminal autorizado
+
PostgreSQL
```

Segunda versión:

```text
+
WebAuthn / biometría
```

Tercera versión:

```text
+
Challenge-response vinculado al terminal
```

La tercera versión ofrece la mejor protección contra el fichaje realizado por compañeros, sin necesidad de utilizar geolocalización constante.
