# ✅ Sistema de fichaje con PIN y QR (versión producción)

## 🎯 Objetivo
Sistema de control horario seguro usando:
- 📱 **Un único móvil de empresa (compartido)**
- 🔐 **PIN o QR por empleado**
- ✅ **Validación estricta por dispositivo en backend**

---

## 1. Arquitectura

### Frontend (React PWA)
- Pantalla principal con:
  - Fichaje por PIN
  - Escaneo QR
- Auto-reset tras fichaje

### Backend
- API REST
- Validación de usuario
- Validación de dispositivo
- Control de estado de fichaje

---

## 2. Identificación del dispositivo (CRÍTICO)

### Frontend
```js
const DEVICE_ID = "empresa_movil_01";
```

En cada petición:
```js
body: JSON.stringify({ userId, pin, type, deviceId: DEVICE_ID })
```

### Backend
```js
if (req.body.deviceId !== "empresa_movil_01") {
  return res.status(403).json({ success: false, error: "Dispositivo no autorizado" });
}
```

---

## 3. Tipos de fichaje

```json
{
  "userId": 123,
  "type": "checkin" | "checkout",
  "deviceId": "empresa_movil_01"
}
```

---

## 4. Fichaje por PIN

### Frontend
```jsx
const submitPin = async () => {
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin, type, deviceId: DEVICE_ID })
  });

  const data = await res.json();
  showFeedback(data.success);
};
```

---

## 5. Fichaje por QR (mejorado)

### Formato QR
```json
{
  "userId": "123",
  "token": "abc_secure_token"
}
```

### Frontend (React)
```jsx
import { QrReader } from 'react-qr-reader';

<QrReader
  onResult={(result) => {
    if (result) {
      const data = JSON.parse(result?.text);
      registerCheckinQR(data);
    }
  }}
/>
```

---

## 6. Backend (Node/Express ejemplo)

```js
app.post('/api/checkin', async (req, res) => {
  const { userId, pin, type, deviceId } = req.body;

  // 1. Validar dispositivo
  if (deviceId !== "empresa_movil_01") {
    return res.status(403).json({ success: false });
  }

  // 2. Validar usuario
  const user = await db.findUser(userId);
  if (!user) return res.json({ success: false });

  // 3. Validar PIN (si aplica)
  if (pin && user.pin !== pin) {
    return res.json({ success: false });
  }

  // 4. Control de estado
  const last = await db.getLastCheck(userId);

  if (last && last.type === type) {
    return res.json({ success: false, error: "Fichaje duplicado" });
  }

  // 5. Guardar
  await db.saveCheck({ userId, type, date: new Date() });

  res.json({ success: true });
});
```

---

## 7. Seguridad

- ✅ Validación en backend siempre
- ✅ Control por dispositivo
- ✅ Token en QR
- ✅ Registro de logs
- ✅ Validación de secuencia entrada/salida

---

## 8. UX recomendada (IMPORTANTE)

- Botones grandes
- Teclado numérico propio
- Mensajes claros:
  - ✅ "Fichaje correcto"
  - ❌ "PIN incorrecto"
- Reset automático (3–5s)
- Vibración o sonido

---

## 9. Acceso rápido

- Añadir PWA a pantalla de inicio
- Uso en modo pantalla completa

---

## ✅ Conclusión

Sistema:
- ✔️ Seguro
- ✔️ Simple
- ✔️ Sin GPS
- ✔️ Sin kiosco
- ✔️ Adaptado a dispositivo compartido real

