---
name: handoff-html-local
description: (Local dev: Borrador API on localhost:3000, viewer on localhost:5173) Publish an implementation plan as reviewable HTML in Borrador, wait for the user's action, and incorporate block-level comments before implementation.
argument-hint: "[project name] [optional plan title]"
disable-model-invocation: true
---

# Handoff

Publish the plan discussed in this conversation to Borrador and keep the review loop attached to this session. All HTTP goes through `scripts/borrador.sh`, **relative to this skill's base directory** (the directory reported when the skill was loaded; never guess or hardcode another path). Run it without arguments for usage. It needs `curl`, `jq`, and `BORRADOR_TOKEN` or `~/.config/borrador/token` (API defaults to `http://localhost:3000`, viewer to `http://localhost:5173`).

## Workflow

1. Read [references/html.md](references/html.md) and write the plan as a self-contained HTML file in a temp location, outside the user's repo.
2. Publish: `scripts/borrador.sh publish "<project>" "<title>" <html-file>`. Take project and title from what the user asked; when absent, derive them from the current repo and task. The script prints `{id, url, version}` where `url` is the absolute link to the viewer: give exactly that to the user.
3. Wait for the user's action. They review from a phone, often hours later, so the wait must survive without blocking the conversation:
   - **Claude Code**: use the **Monitor** tool with `persistent: true` and the command `<base-dir>/scripts/borrador.sh watch <plan-id>` (description `Borrador: <title>`). Background Bash is capped at 10 minutes and a non-persistent Monitor dies at 5, so neither works.
   - **Any other harness** (no Monitor tool): run `scripts/borrador.sh watch <plan-id>` with the longest timeout your shell tool allows. If it times out with no output, tell the user the plan is waiting for them and re-arm the watch when they say they acted. Do not invent a background mechanism.
   The script prints one JSON line when an action arrives and exits.
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
- If the script fails (any `borrador:` error), report the message to the user verbatim and stop. Do not inspect the Borrador server, its ports, its processes, or its source code, and do not retry with guessed routes.
- Ambiguous `resolve` failure (timeout, connection lost): the server may have committed. Check the plan before retrying.
