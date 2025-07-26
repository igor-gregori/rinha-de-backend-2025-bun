FROM oven/bun:1.2.18-alpine

WORKDIR /app

COPY bun.lock package.json ./

RUN bun install --production

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "if [ \"$WATCH_FILES\" = \"1\" ]; then bun run dev; else bun run start; fi"]
