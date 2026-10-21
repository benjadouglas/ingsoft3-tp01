
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

# nginx procesa templates/ al arrancar y reemplaza ${VARIABLE} por su valor.
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build /usr/share/nginx/html

# Valores de docker compose; Render los pisa con las variables del servicio.
ENV BACKEND_URL=http://backend:3000 \
    DNS_RESOLVER=127.0.0.11

EXPOSE 80
