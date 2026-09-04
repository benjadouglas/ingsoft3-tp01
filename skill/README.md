# Skill `handoff-html`

Skill para que un agente (Claude Code, opencode) publique un plan como HTML en Borrador y quede esperando la acción del usuario. Hay dos variantes con el mismo script y el mismo contrato de HTML; solo cambia contra qué Borrador hablan.

| Variante | Carpeta | Base URL |
|---|---|---|
| Local (dev servers) | `handoff-html-local/` | `http://localhost:3000` por defecto; el visor está en `http://localhost:5173` |
| Producción | `handoff-html/` | Obligatoria: `BORRADOR_URL` o `~/.config/borrador/url` |

La API key va en `BORRADOR_TOKEN` o en `~/.config/borrador/token`. Nunca se commitea.

El script expone dos comandos, `publish <html>` y `wait`, y guarda por servidor, repo, harness y sesión el plan abierto y la última copia del HTML en `~/.local/state/borrador/`. El proyecto es el nombre de la carpeta raíz del repo. El agente nunca ve ids: `publish` crea un plan nuevo si no hay uno abierto o si el último ya fue aprobado, y una versión nueva si no.

Instalación: enlazar la carpeta de la variante en el directorio de skills del agente, por ejemplo

```sh
ln -s "$PWD/skill/handoff-html-local" ~/.agents/skills/handoff-html-local
```

Cada plan pertenece a una sola sesión: el estado se guarda por servidor, repo, harness e id de sesión, y la API rechaza con 403 versiones o esperas de otra sesión. Si el script no detecta harness e id hay que pasar `--harness` y `--session-id` en `publish` y `wait`. El estado viejo por repo queda sin usar: los planes anteriores siguen visibles pero no admiten nuevas versiones.
