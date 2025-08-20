# Deploy en Railway (Dockerfile)

Este repo contiene tu frontend original y un backend en `server/` para el webhook de Telegram.
Para evitar el error de `npm ci`, se agrega un `Dockerfile` en la raíz que:

1) Usa Node 20 Alpine
2) Instala dependencias de `server/package.json` con `npm install --omit=dev`
3) Copia el código de `server/`
4) Expone el puerto 3000
5) Ejecuta `node index.js`

## Variables requeridas (configurarlas en Railway → Variables)
- TELEGRAM_TOKEN
- PUBLIC_URL               (https de Railway, ej: https://<app>.up.railway.app)
- TELEGRAM_WEBhook_SECRET  (tu secreto de ruta)
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
- SHEET_ID

## Verificación rápida
- Logs deben mostrar: `setWebhook OK -> https://.../webhook/<secret>`
- En Telegram: `/ping` responde "pong 🏓"
- `/add oreo 3` agrega una fila en el Google Sheet


## Google Sheets: ID o URL
Podés configurar **uno** de estos dos:
- `SHEET_ID` (recomendado): el ID solo, por ej. `18vBpQh7JYYbsP34OJ9weuT1QcwGD5OCIXPpbPCwyxF4`
- `SHEET_URL`: la URL completa del archivo (el servidor extrae el ID automáticamente)

Asegurate de compartir el Sheet con el `GOOGLE_SERVICE_ACCOUNT_EMAIL` (Editor).
