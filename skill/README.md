# Skill `handoff-html`

Skill para que un agente publique un plan como HTML en Borrador y reciba la acción del usuario. Soporta dos harness:

- **Claude Code** (CLI): el agente espera la acción con `borrador wait` y la aplica él mismo.
- **T3 Code** (con Codex o Cursor por debajo): el agente solo publica y termina el turno. Un daemon local, el **bridge**, vigila el plan y le escribe al thread de T3 cuando el usuario actúa.

La skill `handoff-html` usa un cliente Node ≥ 20, sin dependencias. No hay URLs por defecto ni clientes separados por entorno.

## Instalación y configuración

Alcanza con copiar la carpeta `skill/handoff-html/`: incluye el cliente y el bridge dentro de `scripts/`. Podés enlazar la skill y el comando desde este checkout:

```sh
ln -s "$PWD/skill/handoff-html" ~/.agents/skills/handoff-html
# Agregá "$PWD/skill/handoff-html/scripts" a tu PATH para usar `borrador`.
borrador config --url http://localhost:3000 --app-url http://localhost:5173
```

Para producción, configurá las URLs de ese servidor. Si API y visor comparten origen, alcanza con `--url` en una configuración nueva. El token puede configurarse con `borrador config --token <token>`, `BORRADOR_TOKEN` o el archivo anterior `~/.config/borrador/token`.

`config` guarda `~/.config/borrador/config.json` con permisos 0600 (respeta `XDG_CONFIG_HOME`). Las variables `BORRADOR_URL`, `BORRADOR_APP_URL` y `BORRADOR_TOKEN` tienen prioridad; permiten alternar entornos sin cambiar la configuración guardada. El archivo anterior `~/.config/borrador/url` sigue siendo válido. Configurar no publica planes ni imprime credenciales.

## Cliente

- `borrador publish <html>` publica o versiona el plan de esta conversación.
- `borrador wait` espera la acción en Claude Code.
- `borrador bridge pair|install|uninstall|run|status` administra la integración de T3.

El cliente detecta T3 por el entorno (`BORRADOR_HARNESS=t3code|claude` fuerza la elección). Toda comunicación con T3 pasa por `bridge/t3code.mjs`, incluyendo credenciales, resolución del thread, enlace y envío de mensajes. Si hay varios threads activos en el repo, `publish --session-id <id> <html>` permite elegir.

El estado vive en `~/.local/state/borrador/sessions/<hash de servidor+repo+harness+sesión>/`: un `sesion.json` con los metadatos y `plan.html` con la copia del HTML. Publicación, espera y bridge comparten las funciones de lectura y escritura. Los archivos anteriores `plan_id` y `approved` se leen por compatibilidad y se eliminan después de guardar el JSON. La aprobación se guarda como `approved` dentro del JSON.

`publish` crea un plan nuevo si no hay uno abierto o el anterior fue aprobado. En caso contrario publica una versión. En T3 registra `estado: vigilando` y avisa si el bridge no da señales. La API sigue rechazando versiones o esperas de otra sesión.

## Bridge (T3 Code)

`skill/handoff-html/scripts/bridge/bridge.mjs`, Node ≥ 20, sin dependencias. Corre en la máquina del usuario como LaunchAgent (`KeepAlive`), requiere la app de T3 abierta y la computadora despierta.

```sh
node skill/handoff-html/scripts/bridge/bridge.mjs pair '<link de pairing de T3>'   # bearer ~30 días en ~/.config/borrador/t3code.json (0600)
node skill/handoff-html/scripts/bridge/bridge.mjs install                           # ~/Library/LaunchAgents/com.borrador.bridge.plist
node skill/handoff-html/scripts/bridge/bridge.mjs status                            # daemon vivo? planes vigilados, errores
node skill/handoff-html/scripts/bridge/bridge.mjs run                               # primer plano (lo que lanza launchd)
```

Si instalaste el bridge antes de mover los scripts, volvé a correr `borrador bridge install` para actualizar la ruta del LaunchAgent. No hace falta repetir el pairing.

El link de pairing es de un solo uso y dura ~5 minutos: pegárselo a `pair` sin abrirlo antes en el browser. Scopes: `orchestration:read orchestration:operate`.

Ciclo: cada 5 s escanea los `sesion.json` en `vigilando` y arranca un long-poll a `GET /api/planes/{id}/acciones/siguiente` por cada uno (mismo token de Borrador que el script). Cuando llega una acción:

- Si el thread de T3 está **ocupado** (turno activo, aprobación o input pendiente): `POST /api/planes/{id}/acciones/rebotar`. Borrador borra la acción, vuelve el plan a `user_turn` con los comentarios sin atender y avisa por SSE `accion_rebotada`; el visor muestra que el agente estaba ocupado y el usuario vuelve a enviar cuando termine. El bridge sigue vigilando.
- Si está libre: manda al thread un mensaje `thread.turn.start` con una línea que referencia la skill y el mismo JSON que imprime `borrador wait` (`tipo`, `comentarios`, `archivo`). Marca `sesion.json` como `entregado`; el próximo `publish` del agente lo vuelve a `vigilando`. Con `implement` además guarda `approved: true` en `sesion.json`, igual que hace `wait`.
- Si T3 no responde o rechaza el mensaje, reintenta hasta una hora (Borrador re-entrega la acción en cada poll) y después marca `fallido` en la sesión y lo muestra en `bridge/estado.json`, que `publish` lee para avisarle al agente. Credencial vencida, thread archivado o borrado: `fallido` con el motivo.

## Tests

```sh
cd back && bun test                         # API + scripts (Claude y T3 contra un T3 falso); necesita DATABASE_URL
node --test skill/handoff-html/scripts/client/*.test.mjs skill/handoff-html/scripts/bridge/bridge.test.mjs    # bridge contra Borrador y T3 falsos
```

El adaptador `t3code.mjs` es un módulo interno; el pairing se hace con `borrador bridge pair`. Los errores se consultan con `borrador bridge status` y en el log; no hay notificaciones nativas de macOS.
