FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 8000

ENV PORT=8000
ENV NODE_ENV=production

CMD ["node", "sync-server.js"]
