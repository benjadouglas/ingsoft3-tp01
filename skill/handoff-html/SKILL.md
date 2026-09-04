---
name: handoff-html
description: (Production Borrador) Publish an implementation plan as reviewable HTML in Borrador, wait for the user's action, and incorporate block-level comments before implementation.
argument-hint: "[optional plan title]"
disable-model-invocation: true
---

# Handoff

Publish the plan discussed in this conversation to Borrador and wait for the user to review it. All HTTP goes through `scripts/borrador.sh`, **relative to this skill's base directory** (the directory reported when the skill was loaded; never guess or hardcode another path). It needs `curl`, `jq`, `BORRADOR_URL` or `~/.config/borrador/url`, and `BORRADOR_TOKEN` or `~/.config/borrador/token`. The script remembers which plan belongs to this repo: you never handle ids.

## Workflow

1. Read [references/html.md](references/html.md) and write the plan as a self-contained HTML file in a temp location, outside the user's repo. Its `<title>` is the plan title.
2. `scripts/borrador.sh publish <html-file>` prints `{url, version}`. Give the user exactly that `url`.
3. Wait for the user. They review from a phone, often hours later, so the wait must survive without blocking the conversation:
   - **Claude Code**: use the **Monitor** tool with `persistent: true` and the command `<base-dir>/scripts/borrador.sh wait` (description `Borrador: <title>`). Background Bash is capped at 10 minutes and a non-persistent Monitor dies at 5, so neither works.
   - **Any other harness** (no Monitor tool): run `scripts/borrador.sh wait` with the longest timeout your shell tool allows. If it times out with no output, tell the user the plan is waiting for them and re-run it when they say they acted.
   The script prints one JSON line when the user acts and exits:
   ```json
   { "tipo": "refine" | "implement",
     "comentarios": [ { "bloqueId": "api", "fragmento": "first chars of the block", "texto": "the request" } ],
     "archivo": "/path/to/the/html/you/published" }
   ```
   A comment without `bloqueId` is about the whole plan. `archivo` is the copy of what you published, in case you lost yours.
4. **refine**: apply every comment to the HTML, keep block ids stable, then go back to step 2 with the same file. Do not start implementing.
5. **implement**: the plan is approved. Take any final comments into account and implement. Do not publish or wait again.

## Invariants

- Never print, copy, or commit the API key.
- If the script fails (any `borrador:` error), report the message to the user verbatim and stop. Do not inspect the Borrador server, its ports, its processes, or its source code, and do not retry with guessed routes.
