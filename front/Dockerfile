
# Construir

FROM ghcr.io/voidzero-dev/vite-plus:0.3.0 AS build

WORKDIR /app

COPY --chown=vp:vp package.json bun.lock .node-version ./
RUN vp install --frozen-lockfile

COPY --chown=vp:vp . .
RUN vp build

# Ejecutar

FROM nginx:alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/benjadouglas/ingsoft3-tp01"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
