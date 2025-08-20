FROM node:20-alpine
WORKDIR /app
COPY . .
RUN cd server && npm install --omit=dev
ENV PORT=3000
EXPOSE 3000
CMD ["node","server/index.js"]
