
# Construir

FROM oven/bun:1.3-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Ejecutar

FROM nginx:alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/benjadouglas/ingsoft3-tp01"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
