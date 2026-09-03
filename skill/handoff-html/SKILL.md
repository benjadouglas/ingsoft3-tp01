---
name: handoff-html
description: (Production Borrador) Publish an implementation plan as reviewable HTML in Borrador, wait for the user's action, and incorporate block-level comments before implementation.
argument-hint: "[project name] [optional plan title]"
disable-model-invocation: true
---

# Handoff

Publish the plan discussed in this conversation to Borrador and keep the review loop attached to this session. All HTTP goes through `scripts/borrador.sh` (run it without arguments for usage; needs `curl`, `jq`, `BORRADOR_URL` or `~/.config/borrador/url`, and `BORRADOR_TOKEN` or `~/.config/borrador/token`).

## Workflow

1. Read [references/html.md](references/html.md) and write the plan as a self-contained HTML file in a temp location, outside the user's repo.
2. Publish: `scripts/borrador.sh publish "<project>" "<title>" <html-file>`. Take project and title from `$ARGUMENTS`; when absent, derive them from the current repo and task. Give the user the returned `url` joined to the Borrador base URL.
3. Wait for the user's action with the **Monitor** tool, always `persistent: true`:
   ```
   Monitor({ command: "~/.agents/skills/handoff-html/scripts/borrador.sh watch <plan-id>",
             persistent: true, description: "Borrador: <title>" })
   ```
   The user reviews from a phone, often hours later. Background Bash is capped at 10 minutes and a non-persistent Monitor dies at 5, so neither works here. The script prints one JSON line when an action arrives and exits.
4. When the event lands, handle it by `tipo` (below), then resolve:
   `scripts/borrador.sh resolve <accionId> [new-html-file]`.
5. After `refinar`: tell the user what changed and go back to step 3 with the same plan id. After `implementar`: implement the plan; do not watch again.

## The action

```json
{ "accionId": "…", "tipo": "refinar" | "implementar",
  "plan": { "id": "…", "titulo": "…", "version": 2 },
  "comentarios": [ { "id": "…", "bloqueId": "api", "fragmento": "first chars of the block", "texto": "the request" } ],
  "contenidoUrl": "/api/planes/…/versiones/2/contenido" }
```

A comment without `bloqueId` is about the whole plan. If your local HTML is gone, `scripts/borrador.sh fetch <contenidoUrl>` prints the current version.

- **refinar**: apply every comment to the HTML, keep block ids stable, resolve with the new file. Resolve without a file only if the comments deliberately need no document change. Never start implementing.
- **implementar**: the plan is approved. If final comments change it, resolve with the new file; otherwise resolve with none. Then implement.

## Invariants

- Never print, copy, or commit the API key.
- Version 1 is created by `publish`; every later version only by `resolve`. Never publish a second plan to answer an action.
- Resolve only after the requested changes are in the file. Re-arm the watcher only after resolving, or the same pending action is delivered again.
- Ambiguous `resolve` failure (timeout, connection lost): the server may have committed. Check the plan before retrying.
