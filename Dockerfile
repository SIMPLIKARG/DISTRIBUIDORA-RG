FROM node:20-alpine

# Trabajo en /app
WORKDIR /app

# Copiar todo el repo (independiente del root que use Railway)
COPY . .

# Si existe server/package.json -> instalar ahí. Si no, intentar en raíz.
RUN if [ -f server/package.json ]; then \          echo "Usando server/package.json" && cd server && npm install --omit=dev; \        elif [ -f package.json ]; then \          echo "Usando package.json en raíz" && npm install --omit=dev; \        else \          echo "❌ No se encontró package.json ni en /app ni en /app/server"; \          echo "Contenido de /app:" && ls -la /app && exit 1; \        fi

ENV PORT=3000
EXPOSE 3000

# Ejecutar index.js donde corresponda
CMD sh -c 'if [ -f server/index.js ]; then node server/index.js; elif [ -f index.js ]; then node index.js; else echo "❌ No se encontró index.js ni en /app ni en /app/server" && ls -la /app && exit 1; fi'
