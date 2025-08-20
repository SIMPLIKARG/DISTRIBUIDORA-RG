FROM node:20-alpine
WORKDIR /app
COPY . .
RUN sh -c 'if [ -f server/package.json ]; then cd server && npm install --omit=dev; elif [ -f package.json ]; then npm install --omit=dev; else echo "❌ No se encontró package.json ni en /app ni en /app/server"; ls -la /app; exit 1; fi'
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","if [ -f server/index.js ]; then node server/index.js; elif [ -f index.js ]; then node index.js; else echo '❌ No se encontró index.js ni en /app ni en /app/server'; ls -la /app; exit 1; fi"]
