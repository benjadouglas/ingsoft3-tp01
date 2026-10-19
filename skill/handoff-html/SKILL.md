---
name: handoff-html
description: Publish an implementation plan as reviewable HTML in Borrador, wait for the user's action, and incorporate block-level comments before implementation.
argument-hint: "[optional plan title]"
disable-model-invocation: true
---

# Handoff

Publish the plan discussed in this conversation to Borrador and wait for the user to review it. All HTTP goes through `<base-dir>/scripts/borrador`, where `<base-dir>` is this skill's base directory (the one reported when the skill was loaded; never guess or hardcode another path). **Always call it by that absolute path from the user's repo. Never `cd` into the skill directory**: the script takes the project name from the directory it runs in, and a plan published from the wrong place is filed under the wrong project for good. It needs Node ≥ 20 and Borrador configured with `<base-dir>/scripts/borrador config --url <api-url> --app-url <viewer-url>`. Save authentication with `borrador config --token <token>`. `BORRADOR_TOKEN` overrides it for CLI commands; the installed bridge reads the saved token. The old `~/.config/borrador/token` file is a fallback until a token is saved in config.json. Use this maintained client for every environment; do not execute old `.bak` or `handoff-html-local` clients. The client uses the configured URLs; it supplies no default URLs. The script remembers which plan belongs to this session in this repo and detects where you are running: you never handle ids and never pick a client.

## Workflow

1. Read [references/html.md](references/html.md) and write the plan as a self-contained HTML file in a temp location, outside the user's repo. Its `<title>` is the plan title.
2. `<base-dir>/scripts/borrador publish <html-file>` prints `{url, version}`. Give the user exactly that `url`.
   A plan belongs only to the conversation that published it. The script identifies the conversation on its own (Claude Code from the environment; inside T3 Code from T3's API). Only if it fails and asks for it, pass `--harness <name>` and `--session-id <id>`. Use the actual conversation id; if it is unavailable, stop and explain that publication requires it. Never borrow another conversation’s id. Pass `--session-title` only when you can see the exact name the harness shows for this conversation; never make one up.
   If `publish` prints a `borrador: aviso:` line about the bridge, repeat it to the user verbatim. Publication succeeded, but review delivery is not verified; the warning does not necessarily mean the bridge process is stopped.
3. Wait for the user. They review from a phone, often hours later, so the wait must survive without blocking the conversation:
   - **Inside T3 Code**: do not wait and do not run anything else. End your turn telling the user the plan is waiting for them at the `url`. When they act, the Borrador bridge writes to this thread a message that starts with `Borrador:` and contains the JSON below in a code block. Treat that JSON exactly as if `borrador wait` had printed it and continue at step 4 or 5.
   - **Claude Code**: use the **Monitor** tool with `persistent: true` and the command `<base-dir>/scripts/borrador wait` (description `Borrador: <title>`). Background Bash is capped at 10 minutes and a non-persistent Monitor dies at 5, so neither works.
   - **Any other harness** (no Monitor tool): run `<base-dir>/scripts/borrador wait` with the longest timeout your shell tool allows. If it times out with no output, tell the user the plan is waiting for them and re-run it when they say they acted.
   The action arrives as one JSON object:
   ```json
   { "tipo": "refine" | "implement",
     "comentarios": [ { "bloqueId": "api", "fragmento": "first chars of the block", "texto": "the request" } ],
     "archivo": "/path/to/the/html/you/published" }
   ```
   A comment without `bloqueId` is about the whole plan. `archivo` is the copy of what you published, in case you lost yours.
4. **refine**: apply every comment to the HTML, keep block ids stable, then go back to step 2 with the same file. Do not start implementing.
5. **implement**: the plan is approved. Take any final comments into account and implement. Do not publish or wait again.

## Resuming

The wait can die without the plan going anywhere: the Monitor is gone, the session was closed, or you were reopened from the viewer. Resume the original conversation, never a new one, and run `<base-dir>/scripts/borrador wait` again (through Monitor, as in step 3). The server keeps the user's action until you publish the next version, so nothing is lost. Do not publish again unless you have changes to publish. Inside T3 Code, inspect `<base-dir>/scripts/borrador bridge status` and match the plan id in its URL. Errors on other plans do not describe this plan. For a failed plan, correct the reported cause and use `<base-dir>/scripts/borrador bridge retry <plan-id>` to resume delivery without publishing another version. Restarting the bridge alone does not reactivate failed plans. Only ask the user to resend an action if it was bounced because the thread was busy. A live bridge is not proof that a message was delivered.

## Invariants

- Never print, copy, or commit the API key or the T3 Code credential.
- If the script fails (any `borrador:` error), report the message to the user verbatim and stop. Do not inspect the Borrador server, its ports, its processes, or its source code, and do not retry with guessed routes.
