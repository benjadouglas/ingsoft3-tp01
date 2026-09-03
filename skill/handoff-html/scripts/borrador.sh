#!/usr/bin/env bash
# Cliente mínimo de la API de Borrador. Uso: borrador.sh <publish|watch|fetch|resolve> ...
set -euo pipefail

base_url="${BORRADOR_URL:-$(cat "$HOME/.config/borrador/url" 2>/dev/null || true)}"
base_url="${base_url%/}"
# El visor (front) puede vivir en otro origen que la API; en dev es el server de Vite.
app_url="${BORRADOR_APP_URL:-$base_url}"
app_url="${app_url%/}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

die() { echo "borrador: $*" >&2; exit 1; }

usage() {
  cat >&2 <<'USAGE'
uso:
  borrador.sh publish <proyecto> <titulo> <html-file>   crea el plan (v1), imprime {id,url,version}; url es el link absoluto al visor
  borrador.sh watch   <plan-id>                          long-poll; imprime la acción como una línea JSON y sale
  borrador.sh fetch   <contenido-url>                    imprime el HTML de una versión (URL relativa a BORRADOR_URL)
  borrador.sh resolve <accion-id> [html-file]            resuelve la acción, con o sin versión nueva
env: BORRADOR_URL o ~/.config/borrador/url (API), BORRADOR_APP_URL (visor, default = BORRADOR_URL),
     BORRADOR_TOKEN o ~/.config/borrador/token
USAGE
  exit 1
}

# http <method> <path> [json-body] -> escribe la respuesta en $tmp, imprime el status HTTP
http() {
  local args=(--silent --connect-timeout 5 --max-time 65 --request "$1"
    --header "Authorization: Bearer $token" --output "$tmp" --write-out '%{http_code}')
  [[ $# -ge 3 ]] && args+=(--header "Content-Type: application/json" --data "$3")
  curl "${args[@]}" "$base_url$2" || true
}

# ok <status> -> falla con el cuerpo de la respuesta si no es 2xx
ok() {
  [[ "$1" =~ ^2 ]] && return
  echo "borrador: HTTP $1" >&2
  head -c 2000 "$tmp" >&2; echo >&2
  exit 1
}

# Verifica que en $base_url responde Borrador y que el token sirve, antes de tocar nada.
check_server() {
  local status; status="$(http GET /api/health)"
  [[ "$status" == 200 ]] && jq -e '.ok == true' "$tmp" >/dev/null 2>&1 \
    || die "en $base_url no responde Borrador (GET /api/health -> HTTP $status). Revisá BORRADOR_URL y que el servidor esté levantado."
  status="$(http GET /api/me)"
  [[ "$status" == 200 ]] || die "la API key no es válida para $base_url (GET /api/me -> HTTP $status). Regenerala desde la app y guardala en ~/.config/borrador/token."
}

publish() {
  [[ $# -eq 3 && -r "$3" ]] || usage
  check_server
  ok "$(http POST /api/proyectos "$(jq -cn --arg nombre "$1" '{nombre:$nombre}')")"
  local proyecto_id; proyecto_id="$(jq -er .id "$tmp")"
  ok "$(http POST "/api/proyectos/$proyecto_id/planes" \
    "$(jq -cn --arg titulo "$2" --rawfile html "$3" '{titulo:$titulo, contenidoHtml:$html}')")"
  jq -c --arg app "$app_url" '.url = $app + .url' "$tmp"
}

watch() {
  [[ $# -eq 1 ]] || usage
  local status
  while true; do
    status="$(http GET "/api/planes/$1/acciones/siguiente?wait=55")"
    case "$status" in
      200) jq -c . "$tmp"; return ;;
      204) ;;
      404)
        # ¿No existe el plan, o esta instancia todavía no implementa acciones?
        if [[ "$(http GET "/api/planes/$1")" == 200 ]]; then
          die "el plan $1 existe pero esta instancia de Borrador no implementa acciones (watch/resolve). El plan quedó publicado; informale al usuario y detenete."
        fi
        die "plan $1 no encontrado en $base_url" ;;
      401|403) ok "$status" ;;
      *) sleep 3 ;;
    esac
  done
}

fetch() {
  [[ $# -eq 1 && "$1" == /* ]] || usage
  ok "$(http GET "$1")"
  cat "$tmp"
}

resolve() {
  [[ $# -eq 1 || ( $# -eq 2 && -r "$2" ) ]] || usage
  local body='{}'
  [[ $# -eq 2 ]] && body="$(jq -cn --rawfile html "$2" '{contenidoHtml:$html}')"
  ok "$(http POST "/api/acciones/$1/resolver" "$body")"
  jq -c . "$tmp"
}

cmd="${1:-}"; shift || true
case "$cmd" in publish|watch|fetch|resolve) ;; *) usage ;; esac

command -v curl >/dev/null && command -v jq >/dev/null || die "se necesitan curl y jq"
[[ -n "$base_url" ]] || die "definí BORRADOR_URL o creá ~/.config/borrador/url"
token="${BORRADOR_TOKEN:-$(cat "$HOME/.config/borrador/token" 2>/dev/null || true)}"
[[ -n "$token" ]] || die "definí BORRADOR_TOKEN o creá ~/.config/borrador/token"
"$cmd" "$@"
