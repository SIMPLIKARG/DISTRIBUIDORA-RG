
# Distribuidora RG - v22 (googleapis + Debian base)
- Base image: node:20-bullseye (evita ERR_OSSL_UNSUPPORTED en Alpine).
- Env en el Service:
  - TELEGRAM_BOT_TOKEN (o TELEGRAM_TOKEN)
  - GOOGLE_SERVICE_ACCOUNT_EMAIL
  - GOOGLE_PRIVATE_KEY (o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) -> una línea con \n
  - GOOGLE_SHEETS_ID / SHEET_ID / GOOGLE_SHEET_ID / SHEET_URL
  - (opc) PUBLIC_URL, TELEGRAM_WEBHOOK_SECRET
- Endpoints: /, /env, /set-webhook
- Comandos: /ping, /start, /clients, /add
