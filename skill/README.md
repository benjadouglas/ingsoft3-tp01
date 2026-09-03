# Skill `handoff-html`

Skill para que un agente (Claude Code, opencode) publique un plan como HTML en Borrador y quede esperando la acción del usuario. Hay dos variantes con el mismo script y el mismo contrato de HTML; solo cambia contra qué Borrador hablan.

| Variante | Carpeta | Base URL |
|---|---|---|
| Local (dev servers) | `handoff-html-local/` | `http://localhost:3000` por defecto; el visor está en `http://localhost:5173` |
| Producción | `handoff-html/` | Obligatoria: `BORRADOR_URL` o `~/.config/borrador/url` |

La API key va en `BORRADOR_TOKEN` o en `~/.config/borrador/token`. Nunca se commitea.

Instalación: enlazar la carpeta de la variante en el directorio de skills del agente, por ejemplo

```sh
ln -s "$PWD/skill/handoff-html-local" ~/.agents/skills/handoff-html-local
```
