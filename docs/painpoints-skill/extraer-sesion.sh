#!/usr/bin/env bash
# Vuelca la línea de tiempo de una sesión de opencode (reasoning, texto, tools) desde su SQLite local.
# Uso: extraer-sesion.sh <session-id>   (sin argumento: lista las últimas 15 sesiones)
set -euo pipefail
db="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"

if [[ $# -eq 0 ]]; then
  sqlite3 -column -header "$db" "select id, substr(title,1,40) title, json_extract(model,'$.id') model,
    tokens_reasoning, datetime(time_created/1000,'unixepoch','localtime') created
    from session order by time_created desc limit 15;"
  exit 0
fi

sqlite3 -json "$db" "
  select p.time_created t,
         json_extract(m.data,'$.role') role,
         json_extract(p.data,'$.type') type,
         json_extract(p.data,'$.tool') tool,
         json_extract(p.data,'$.state.input') input,
         substr(json_extract(p.data,'$.state.output'),1,1500) output,
         json_extract(p.data,'$.state.status') status,
         json_extract(p.data,'$.text') text
  from part p join message m on m.id = p.message_id
  where p.session_id = '$1'
    and json_extract(p.data,'$.type') in ('reasoning','text','tool')
  order by p.time_created, p.id;" \
| jq -r '.[] | "### [\(.role)/\(.type)\(if .tool then " " + .tool else "" end)]\(if .status and .status != "completed" then " (" + .status + ")" else "" end)\n" +
    (if .type == "tool" then "input: \(.input)\n---\n\(.output // "")" else (.text // "") end) + "\n"'
