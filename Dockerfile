FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

RUN npx prisma generate

RUN npm run build

RUN npm prune --omit=dev

EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
