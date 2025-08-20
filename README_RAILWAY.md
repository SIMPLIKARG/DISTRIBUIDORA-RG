
# Distribuidora RG - Bot Telegram + Google Sheets

## Env requeridas (cargar en Railway - Service)
- TELEGRAM_BOT_TOKEN (o TELEGRAM_TOKEN)
- GOOGLE_SERVICE_ACCOUNT_EMAIL
- GOOGLE_PRIVATE_KEY (o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) -> en UNA línea con \n literales
- GOOGLE_SHEETS_ID (o SHEET_ID / GOOGLE_SHEET_ID / SHEET_URL)

## Endpoints útiles
- GET / -> health
- GET /env -> muestra qué vars llegaron (sin exponer secretos)
- GET /set-webhook -> setea el webhook si PUBLIC_URL está definido

## Telegram
- /ping
- /start -> selector/búsqueda de cliente desde la hoja Clientes
- /add <producto> <cantidad>
- /clients -> depuración: primeros clientes leídos
