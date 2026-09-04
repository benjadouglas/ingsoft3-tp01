#!/usr/bin/env bash
# Cliente mínimo de la API de Borrador. Uso: borrador.sh <publish|wait> ...
# Guarda el estado (plan actual y última copia del HTML) por repo, fuera del repo,
# para que el agente no maneje ids ni recuerde nada entre llamadas.
set -euo pipefail

base_url="${BORRADOR_URL:-http://localhost:3000}"
base_url="${base_url%/}"
# El visor (front) puede vivir en otro origen que la API; en dev es el server de Vite.
app_url="${BORRADOR_APP_URL:-http://localhost:5173}"
app_url="${app_url%/}"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

die() { echo "borrador: $*" >&2; exit 1; }

usage() {
  cat >&2 <<'USAGE'
uso:
  borrador.sh publish [opciones] <html-file>
      publica el plan: nueva versión si hay uno abierto, plan nuevo si no. Imprime {url,version}
      --harness <nombre>        claude-code | codex | cursor | opencode | otro
      --session-id <id>         id de esta conversación, para reabrirla desde el visor
      --session-title <título>  nombre de esta conversación tal como la muestra el harness
      (harness, id, título y directorio se detectan solos en Claude Code y Codex; harness, id y título en OpenCode; los flags pisan lo detectado)
  borrador.sh wait
      espera la acción del usuario; imprime {tipo,comentarios,archivo} y sale.
      Si la espera se cortó (Monitor muerto, sesión reabierta), volvé a correrlo: la acción pendiente se vuelve a entregar
env: BORRADOR_URL (API, default http://localhost:3000), BORRADOR_APP_URL (visor, default http://localhost:5173),
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

# Estado por repo: el proyecto es el nombre de la carpeta raíz del repo (o del cwd si no hay git).
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
proyecto="$(basename "$repo_root")"
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/borrador/$(printf %s "$repo_root" | shasum | cut -c1-16)"
mkdir -p "$state_dir"
plan_file="$state_dir/plan_id"       # id del plan abierto
approved_file="$state_dir/approved"  # existe cuando el plan abierto ya fue aprobado
html_copy="$state_dir/plan.html"     # última versión publicada

plan_id() { cat "$plan_file" 2>/dev/null || true; }

# Conversación que publica: se guarda con el plan para que el visor ofrezca cómo volver a ella.
# Claude Code y Codex exponen el id por entorno; título y directorio se leen de sus logs locales
# (en el primer turno el título todavía no existe y queda vacío). OpenCode expone id y título.
# Cursor no expone nada: ahí el agente pasa los flags. Sin directorio detectado, vale el del repo.
claude_code_sesion() {  # dos líneas: título, cwd
  local log
  log="$(ls "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/projects/*/"$1".jsonl 2>/dev/null | head -1 || true)"
  [[ -n "$log" ]] || return 0
  jq -rs '((map(select(.type == "custom-title")) | last | .customTitle) // (map(select(.type == "ai-title")) | last | .aiTitle) // ""),
          ((map(.cwd // empty) | first) // "")' "$log" 2>/dev/null || true
}
codex_sesion() {  # dos líneas: título, cwd
  local home="${CODEX_HOME:-$HOME/.codex}" rollout
  jq -rs --arg id "$1" 'map(select(.id == $id)) | last | .thread_name // ""' "$home/session_index.jsonl" 2>/dev/null || echo
  rollout="$(ls "$home"/sessions/*/*/*/rollout-*-"$1".jsonl 2>/dev/null | head -1 || true)"
  { [[ -n "$rollout" ]] && head -1 "$rollout" | jq -r 'select(.type == "session_meta") | .payload.cwd // ""'; } 2>/dev/null || echo
}

harness="" session_id="" session_title="" session_dir=""
if [[ -n "${CLAUDE_CODE_SESSION_ID:-}" ]]; then
  harness=claude-code session_id="$CLAUDE_CODE_SESSION_ID"
  { read -r session_title; read -r session_dir; } < <(claude_code_sesion "$session_id") || true
elif [[ -n "${CODEX_THREAD_ID:-}" ]]; then
  harness=codex session_id="$CODEX_THREAD_ID"
  { read -r session_title; read -r session_dir; } < <(codex_sesion "$session_id") || true
elif [[ -n "${OPENCODE_SESSION_ID:-}" ]]; then
  harness=opencode session_id="$OPENCODE_SESSION_ID" session_title="${OPENCODE_SESSION_TITLE:-}"
fi

sesion_json() {
  jq -cn --arg h "$harness" --arg id "$session_id" --arg t "$session_title" --arg d "${session_dir:-$repo_root}" \
    'if $h == "" then {} else {sesion: ({harness:$h, directorio:$d} + (if $id != "" then {id:$id} else {} end) + (if $t != "" then {titulo:$t} else {} end))} end'
}

publish() {
  while [[ $# -gt 1 ]]; do
    case "$1" in
      --harness) harness="$2" ;;
      --session-id) session_id="$2" ;;
      --session-title) session_title="$2" ;;
      *) usage ;;
    esac
    shift 2
  done
  [[ $# -eq 1 && -r "$1" ]] || usage
  check_server
  local id status
  id="$(plan_id)"
  if [[ -n "$id" && ! -e "$approved_file" ]]; then
    status="$(http POST "/api/planes/$id/versiones" "$(jq -cn --rawfile html "$1" '{contenidoHtml:$html}')")"
    # 404: el plan ya no existe en el servidor; se publica uno nuevo.
    [[ "$status" == 404 ]] && id=""
  fi
  if [[ -z "$id" || -e "$approved_file" ]]; then
    status="$(http POST /api/planes "$(jq -cn --arg proyecto "$proyecto" --rawfile html "$1" --argjson sesion "$(sesion_json)" '{proyecto:$proyecto, contenidoHtml:$html} + $sesion')")"
    ok "$status"
    jq -er .id "$tmp" > "$plan_file"
    rm -f "$approved_file"
  fi
  ok "$status"
  cp "$1" "$html_copy"
  id="$(plan_id)"
  jq -c --arg url "$app_url/planes/$id" '{url:$url, version}' "$tmp"
}

wait_action() {
  [[ $# -eq 0 ]] || usage
  local id status
  id="$(plan_id)"
  [[ -n "$id" ]] || die "no hay ningún plan publicado desde este repo; corré publish primero"
  while true; do
    status="$(http GET "/api/planes/$id/acciones/siguiente?wait=55")"
    case "$status" in
      200)
        [[ "$(jq -r .tipo "$tmp")" == implement ]] && touch "$approved_file"
        jq -c --arg archivo "$html_copy" '. + {archivo:$archivo}' "$tmp"
        return ;;
      204) ;;
      404) die "el plan $id ya no existe en $base_url" ;;
      401|403) ok "$status" ;;
      *) sleep 3 ;;
    esac
  done
}

cmd="${1:-}"; shift || true
command -v curl >/dev/null && command -v jq >/dev/null || die "se necesitan curl y jq"
token="${BORRADOR_TOKEN:-$(cat "$HOME/.config/borrador/token" 2>/dev/null || true)}"
[[ -n "$token" ]] || die "definí BORRADOR_TOKEN o creá ~/.config/borrador/token"
case "$cmd" in
  publish) publish "$@" ;;
  wait) wait_action "$@" ;;
  *) usage ;;
esac
