FROM node:20-alpine

# Carpeta de trabajo
WORKDIR /app

# Instalar solo dependencias primero (mejor cache)
COPY server/package.json ./
RUN npm install --omit=dev

# Copiar el resto del código del servidor
COPY server/. ./

# Variables de entorno de ejemplo (pueden sobreescribirse en Railway)
ENV PORT=3000
EXPOSE 3000

# Ejecutar el bot
CMD ["node", "index.js"]
