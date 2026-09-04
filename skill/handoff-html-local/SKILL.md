---
name: handoff-html-local
description: (Local dev: Borrador API on localhost:3000, viewer on localhost:5173) Publish an implementation plan as reviewable HTML in Borrador, wait for the user's action, and incorporate block-level comments before implementation.
argument-hint: "[optional plan title]"
disable-model-invocation: true
---

# Handoff

Publish the plan discussed in this conversation to Borrador and wait for the user to review it. All HTTP goes through `<base-dir>/scripts/borrador.sh`, where `<base-dir>` is this skill's base directory (the one reported when the skill was loaded; never guess or hardcode another path). **Always call it by that absolute path from the user's repo. Never `cd` into the skill directory**: the script takes the project name from the directory it runs in, and a plan published from the wrong place is filed under the wrong project for good. It needs `curl`, `jq`, and `BORRADOR_TOKEN` or `~/.config/borrador/token` (API defaults to `http://localhost:3000`, viewer to `http://localhost:5173`). The script remembers which plan belongs to this session in this repo: you never handle ids.

## Workflow

1. Read [references/html.md](references/html.md) and write the plan as a self-contained HTML file in a temp location, outside the user's repo. Its `<title>` is the plan title.
2. `<base-dir>/scripts/borrador.sh publish <html-file>` prints `{url, version}`. Give the user exactly that `url`.
   A plan belongs only to the conversation that published it. The script keeps separate state per server, repository, harness and session. In Claude Code, Codex and OpenCode it reads the harness and session id from the environment, and in Claude Code and OpenCode also the conversation title: do not pass one. In Cursor (or any harness the script does not detect) pass `--harness <name>` and `--session-id <id>` to both `publish` and `wait`. Use the actual conversation id; if it is unavailable, stop and explain that publication requires it. Never borrow another conversation’s id. Pass `--session-title` only when you can see the exact name the harness shows for this conversation; never make one up.
3. Wait for the user. They review from a phone, often hours later, so the wait must survive without blocking the conversation:
   - **Claude Code**: use the **Monitor** tool with `persistent: true` and the command `<base-dir>/scripts/borrador.sh wait` (description `Borrador: <title>`). Background Bash is capped at 10 minutes and a non-persistent Monitor dies at 5, so neither works.
   - **Any other harness** (no Monitor tool): run `<base-dir>/scripts/borrador.sh wait` with the longest timeout your shell tool allows. If it times out with no output, tell the user the plan is waiting for them and re-run it when they say they acted.
   The script prints one JSON line when the user acts and exits:
   ```json
   { "tipo": "refine" | "implement",
     "comentarios": [ { "bloqueId": "api", "fragmento": "first chars of the block", "texto": "the request" } ],
     "archivo": "/path/to/the/html/you/published" }
   ```
   A comment without `bloqueId` is about the whole plan. `archivo` is the copy of what you published, in case you lost yours.
4. **refine**: apply every comment to the HTML, keep block ids stable, then go back to step 2 with the same file. Do not start implementing.
5. **implement**: the plan is approved. Take any final comments into account and implement. Do not publish or wait again.

## Resuming

The wait can die without the plan going anywhere: the Monitor is gone, the session was closed, or you were reopened with the command the viewer offers. Resume the original conversation, never a new one. In all those cases just run `<base-dir>/scripts/borrador.sh wait` again (through Monitor, as in step 3). The server keeps the user's action until you publish the next version, so nothing is lost. Do not publish again unless you have changes to publish.

## Invariants

- Never print, copy, or commit the API key.
- If the script fails (any `borrador:` error), report the message to the user verbatim and stop. Do not inspect the Borrador server, its ports, its processes, or its source code, and do not retry with guessed routes.
