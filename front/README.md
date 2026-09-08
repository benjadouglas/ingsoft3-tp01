# Frontend

SvelteKit + Svelte 5 + Tailwind CSS, con Vite+ 0.3.0 y Bun como gestor de paquetes.

Instalá la CLI `vp` siguiendo la [guía de Vite+](https://viteplus.dev/guide/).
Desde `front/`, Vite+ usa la versión de Node de `.node-version` y la versión de
Bun declarada en `package.json`.

```sh
vp install --frozen-lockfile
vp dev
```

El proxy `/api` apunta al backend en `http://localhost:3000`.

## Verificación

```sh
vp run check       # Tipos y diagnósticos de Svelte
vp check           # Formato y lint
vp test run        # Tests de componentes en Chromium
vp build           # Build estático en build/
vp preview         # Servir el build localmente
```

Para instalar Chromium si todavía no está disponible:

```sh
vp exec playwright install chromium
```

`vp check` es el comando integrado de Vite+; `vp run check` ejecuta
`svelte-check`. Mantenemos este último porque el chequeo genérico de TypeScript
no resuelve los exports de archivos `.svelte`.

`vp lint` revisa el código y `vp fmt` aplica formato. Los scripts también se
pueden ejecutar con `bun run dev`, `bun run build` y `bun run test`.

## Docker

Desde la raíz del repositorio:

```sh
docker build -t ingsoft3-front ./front
```

La imagen de Vite+ construye el sitio y Nginx sirve los archivos estáticos.
