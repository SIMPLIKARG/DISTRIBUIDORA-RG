
# Deploy en Railway (Bot Telegram + Google Sheets)

## Variables de entorno
- TELEGRAM_TOKEN **o** TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBhook_SECRET **o** TELEGRAM_WEBHOOK_SECRET
- PUBLIC_URL (opcional; si no está, se intenta auto-detectar; podés usar /set-webhook)
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  ← pegar en una sola línea con \n literales (el server las convierte)
- SHEET_ID **o** GOOGLE_SHEETS_ID **o** GOOGLE_SHEET_ID **o** SHEET_URL

## Webhook
- Arranque: setea webhook si PUBLIC_URL no está vacío.
- Manual: GET /set-webhook → devuelve { ok: true, url } si se setea.

## Telegram
- /ping
- /start → selector/búsqueda de cliente desde pestaña "Clientes" (2da columna = nombre)
- /clients → depuración, lista los primeros clientes leídos
- /add <producto> <cantidad> → escribe una fila en la 1ra hoja

## Notas
- La clave privada se normaliza con: split(String.raw`\n`).join('\n'), para evitar errores de comillas/saltos.
