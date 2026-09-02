
# Construir

FROM  oven/bun:1.3-alpine AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Ejecutar

FROM  oven/bun:1.3-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/benjadouglas/ingsoft3-tp01"

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY drizzle ./drizzle

USER bun

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
