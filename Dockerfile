FROM oven/bun:1.3.0

WORKDIR /app

COPY app/package.json app/bun.lock ./app/
COPY shared ./shared
COPY app ./app

WORKDIR /app/app
RUN bun install --production

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "index.ts"]
