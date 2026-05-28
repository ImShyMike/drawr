FROM oven/bun:1.3.0

WORKDIR /app

COPY package.json bun.lock ./
COPY ../shared ./shared
COPY . ./

RUN bun install --production

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "index.ts"]
