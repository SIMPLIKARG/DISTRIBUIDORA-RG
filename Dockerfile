FROM node:20-alpine

# Trabajo en /app
WORKDIR /app

# Copiamos TODO el repo al contenedor (evita problemas si Railway usa otro root)
COPY . .

# Ir al backend
WORKDIR /app/server

# Sanidad: asegurar que exista server/package.json
RUN test -f package.json || (echo "❌ No se encontró /app/server/package.json. Contenido de /app:" && ls -la /app && exit 1)

# Instalar deps del backend
RUN npm install --omit=dev

ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
