FROM node:20-alpine

# Carpeta de trabajo
WORKDIR /app

# Copiar todo el repo
COPY . .

# Instalar dependencias: primero intenta en server/, si no existe usa la raíz
RUN sh -c 'if [ -f server/package.json ]; then cd server && npm install --omit=dev; elif [ -f package.json ]; then npm install --omit=dev; else echo "❌ No se encontró package.json ni en /app ni en /app/server"; ls -la /app; exit 1; fi'

ENV PORT=3000
EXPOSE 3000

# Ejecutar index.js desde server/ si existe, sino desde la raíz
CMD ["sh","-c","if [ -f server/index.js ]; then node server/index.js; elif [ -f index.js ]; then node index.js; else echo '❌ No se encontró index.js ni en /app ni en /app/server'; ls -la /app; exit 1; fi"]
