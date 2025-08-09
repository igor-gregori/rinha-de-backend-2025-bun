FROM oven/bun:1.2.18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY bun.lock package.json ./

RUN bun install --ci --frozen-lockfile --production

COPY . .

EXPOSE 3000

CMD ["bun","run","start"]
