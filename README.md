# Proyecto IngSoft3 - versión A

[![CI](https://github.com/benjadouglas/ingsoft3-tp01/actions/workflows/ci.yml/badge.svg)](https://github.com/benjadouglas/ingsoft3-tp01/actions/workflows/ci.yml)

## Instalación

```sh
git clone https://github.com/benjadouglas/ingsoft3-tp01.git
cd ingsoft3-tp01
```

## Setup de la skill `handoff-html`

Publica planes en Borrador para que puedas comentarlos y aprobarlos. Necesitás **Node.js ≥ 20**, Bash y Git.

### 1. Levantar Borrador

Si ya tenés un servidor, saltá al paso 2. Para correrlo localmente con Docker Compose:

```sh
cp .env.example .env
openssl rand -base64 32
```

Completá `.env` con `DB_PASSWORD`, el secreto generado en `BETTER_AUTH_SECRET` y las credenciales de Google OAuth (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`). Registrá este callback en Google:

```text
http://localhost:5173/api/auth/callback/google
```

Compose configura las demás variables necesarias. Luego ejecutá:

```sh
docker compose up --build -d
```

### 2. Instalar la skill

Desde la raíz del repo, para Codex en T3 Code:

```sh
mkdir -p ~/.agents/skills
ln -s "$PWD/skill/handoff-html" ~/.agents/skills/handoff-html
```

Para Claude Code, usá `~/.claude/skills` en ambos comandos. Abrí una nueva sesión del agente después de instalarla.

### 3. Configurar el cliente

Entrá a `http://localhost:5173/token`, iniciá sesión con Google y generá una API key. Desde la raíz del repo:

```sh
export PATH="$PWD/skill/handoff-html/scripts:$PATH"
borrador config --url http://localhost:3000 --app-url http://localhost:5173
borrador config --token '<tu-api-key>'
```

Si usás un servidor remoto, reemplazá las URLs. Para conservar el `PATH`, guardá el `export` en `~/.zshrc` o `~/.bashrc` con la ruta absoluta del repo en lugar de `$PWD`.

### 4. Conectar T3 Code

Solo para T3: obtené un link de pairing en la app y pegalo sin abrirlo en el navegador.

```sh
borrador bridge pair '<link-de-pairing>'
borrador bridge install
borrador bridge status
```

`install` funciona en macOS. En otros sistemas, dejá `borrador bridge run` ejecutándose en otra terminal. Mantené T3 abierto y la computadora despierta.

### Uso

En una conversación de tu proyecto, pedile al agente que publique el plan con `handoff-html`. Abrí el enlace que devuelve para comentar o aprobar. Continuá en esa misma conversación.

Más detalles en [skill/README.md](skill/README.md).
