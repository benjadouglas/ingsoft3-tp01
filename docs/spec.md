# htmlplan — spec

> Modelo de datos detallado: [modelo-datos.html](./modelo-datos.html). Glosario: [CONTEXT.md](../CONTEXT.md).

> Hosting de planes HTML generados por agentes de IA, con feedback humano por turnos que vuelve al agente.
> App del semestre para Ingeniería de Software 3 (UCC). Stack: Elysia (Bun) + SvelteKit (SPA) + PostgreSQL.

## Problem Statement

Cuando le pido a un agente de IA (Claude Code u otro) que planifique una tarea, el plan queda en la terminal o en un `.md` dentro del repo. Revisarlo es incómodo: no tiene formato, no puedo marcar "esto sí, esto no" sobre el texto, y para pedir cambios tengo que volver a la terminal y describir con palabras qué parte quiero distinta. Si genero varios planes para varios proyectos, se me pierden.

La mayor parte del tiempo reviso lejos de la compu, desde el celular. Ahí la terminal no existe: para señalar algo tengo que sacar una captura, marcarla y describir el cambio a mano.

Además, cuando el agente termina de generar el plan, la conversación queda cortada: yo reviso por un lado, el agente espera por otro, y no hay un canal para que mi feedback llegue de vuelta sin que yo lo copie a mano.

## Solution

Un servicio web donde los agentes publican planes como HTML, organizados por proyecto. Abro el plan en el browser, lo leo con formato, dejo comentarios anclados a partes concretas del documento, y al final aprieto uno de dos botones:

- **Refinar**: el agente toma mis comentarios, publica una versión nueva del plan en la misma URL, y me vuelve el turno.
- **Implementar**: apruebo el plan; el agente recibe los comentarios finales, puede publicar una versión final, y arranca a implementarlo.

El intercambio es **por turnos**: el agente publica, el usuario comenta, el usuario aprieta un botón, el agente responde. Cada publicación es una versión nueva; las anteriores se guardan con sus comentarios.

El servidor es un intermediario pasivo: guarda planes, versiones, comentarios y acciones, y expone una API. Nunca llama al agente. El agente es un cliente que sube versiones y pregunta, con una conexión larga (long-poll), si hay una acción pendiente para su plan. Así el agente puede estar en una laptop atrás de un router y el servicio en la nube, sin túneles ni webhooks.

## User Stories

### Cuenta y acceso

1. Como usuario, quiero iniciar sesión con Google, para no administrar otra contraseña.
2. Como usuario, quiero generar una API key desde una pantalla "Token", para dársela a mis agentes.
3. Como usuario, quiero que la API key se muestre una sola vez al generarla, para que no quede visible en la app después.
4. Como usuario, quiero regenerar mi API key, para invalidar la anterior si la filtré.
5. Como agente, quiero autenticarme con la API key en un header `Authorization: Bearer`, para publicar en nombre del usuario.
6. Como usuario, quiero que solo yo vea mis proyectos y planes, para que el contenido sea privado por defecto.

### Proyectos

7. Como agente, quiero crear un proyecto por nombre y obtener el existente si ya está, para no depender de que el usuario lo cree antes.
8. Como usuario, quiero ver la lista de mis proyectos, para encontrar rápido en qué estaba trabajando.
9. Como usuario, quiero borrar un proyecto y todo lo que contiene, para limpiar cosas viejas.

### Planes y versiones

10. Como agente, quiero publicar un plan (título + HTML) en un proyecto y recibir su `id` y URL, para dárselos al usuario.
11. Como usuario, quiero ver los planes de un proyecto con su estado y fecha de última versión, para saber cuáles esperan mi revisión.
12. Como usuario, quiero abrir un plan y ver la versión actual renderizada, para leerlo con formato.
13. Como usuario, quiero que el HTML se muestre dentro de un `iframe` con `sandbox`, para que un HTML malicioso o roto no pueda tocar la app.
14. Como usuario, quiero ver la lista de versiones anteriores de un plan y abrir cualquiera en solo lectura, para recordar qué cambió.
15. Como usuario, quiero un toggle `view_access` (`owner` / `everyone`) en cada plan, para compartir un plan por link con alguien sin cuenta.
16. Como visitante con link a un plan `everyone`, quiero verlo sin iniciar sesión, pero no comentar ni accionar.
17. Como usuario, quiero borrar un plan con todas sus versiones y comentarios, para descartar planes que ya no sirven.

### Comentarios

18. Como usuario, quiero hacer click sobre un bloque del plan (un elemento con `id`) y escribir un comentario, para que quede anclado a esa parte y no tener que describir dónde.
19. Como usuario, quiero dejar un comentario general sin anclar, para observaciones sobre el plan entero.
20. Como usuario, quiero ver mis comentarios listados al costado del plan, para repasarlos antes de mandar.
21. Como usuario, quiero editar o borrar un comentario antes de mandarlo, para corregirme.
22. Como usuario, quiero que los comentarios persistan si recargo la página, para no perder trabajo.
23. Como usuario, quiero que solo se pueda comentar cuando es mi turno (`user_turn`), para que el agente no reciba comentarios a medio escribir.
24. Como agente, quiero recibir cada comentario con el `id` del bloque, un fragmento de su texto y el comentario, para saber exactamente a qué se refiere.
25. Como usuario, quiero ver los comentarios de versiones anteriores marcados como atendidos, para distinguir lo nuevo de lo viejo.

### Acciones (los botones)

26. Como usuario, quiero un botón **Refinar** al pie del plan, para pedirle al agente una nueva versión con mis comentarios.
27. Como usuario, quiero un botón **Implementar** al pie del plan, para aprobar el plan y que el agente pase a ejecutarlo.
28. Como usuario, quiero que los botones solo estén habilitados en `user_turn`, para no mandar dos veces ni fuera de turno.
29. Como usuario, quiero que el plan quede `approved` en el momento en que aprieto Implementar, para ver el resultado de mi decisión sin depender del agente.
30. Como usuario, quiero ver si hay un agente escuchando este plan, para saber si mi acción va a procesarse ya o va a quedar encolada.
31. Como agente, quiero pedir "la siguiente acción pendiente" de mi plan y que la request se quede abierta hasta que haya una o venza el timeout, para no hacer polling agresivo.
32. Como agente, quiero resolver una acción publicando (opcionalmente) una versión nueva en una sola operación, para que no queden estados a medias.
33. Como agente, quiero que si mi conexión se corta la acción siga pendiente en el servidor, para retomarla cuando reconecte.
34. Como usuario, quiero ver el historial de acciones de un plan con fecha, para tener evidencia de cuándo aprobé qué.
35. Como usuario, quiero que el visor se actualice solo cuando el agente publica una versión nueva, para no tener que recargar a mano.

### Operación

36. Como quien despliega, quiero `GET /health`, para chequeos de disponibilidad.
37. Como quien despliega, quiero toda la configuración (BD, Google, secreto de sesión) por variables de entorno, para correr igual en local, en contenedor y en la nube.
38. Como quien despliega, quiero que las migraciones se apliquen al arrancar, para no tener pasos manuales.

## Implementation Decisions

### Stack

Dos servicios y una base, como pide la guía y como recomendó la cátedra (dos contenedores que se encuentran por nombre; pipeline con dos builds).

- **Backend**: Elysia sobre **Bun**. Drizzle para schema y migraciones (aplicadas al arrancar). Better Auth montado en `/api/auth/*` con Google como único proveedor, cookie HttpOnly, sesiones en la BD; la tabla `user` se extiende con `apiKeyHash`. Carpeta `backend/`, imagen base `oven/bun`.
- **Frontend**: SvelteKit (Svelte 5) con `adapter-static`: una SPA servida por nginx, cuyo `nginx.conf` proxea `/api` al backend por nombre de servicio. En desarrollo, el proxy de Vite hace lo mismo. Carpeta `frontend/`.
- **Tipos de punta a punta**: Eden Treaty. El frontend importa `type App` del backend (workspaces de Bun) y obtiene un cliente tipado; no se generan clientes ni se duplican tipos.
- **PostgreSQL**: único estado del sistema.

Una sola superficie de API, JSON bajo `/api`. El browser la consume con la cookie de sesión (same-origin gracias al proxy); el agente, con `Authorization: Bearer <api key>`. Un mismo plugin de Elysia resuelve `user` desde cualquiera de las dos y lo deja en el contexto.

Toda la lógica de negocio vive en `backend/src/services/` (un módulo por agregado: `proyectos`, `planes`, `acciones`, `auth`). Las rutas solo validan el input (schemas de Elysia/TypeBox) y delegan.

### Modelo

Diagrama y detalle de columnas en [modelo-datos.html](./modelo-datos.html).

- **user** (Better Auth) + `api_key_hash` (`UNIQUE`) y `api_key_created_at` (nullables).
- **project**: `id`, `user_id`, `name` (único por usuario), `created_at`.
- **plan**: `id`, `project_id`, `title`, `state` (`user_turn` | `agent_turn` | `approved`), `view_access` (`owner` | `everyone`), `harness`, `session_id`, `session_title`, `session_dir` (nullables: la conversación del agente que publicó y el directorio donde corría, para reabrirla desde el visor), `created_at`. La versión actual no es columna: es `MAX(version.number)`.
- **version**: `id`, `plan_id`, `number` (1..n, `UNIQUE(plan_id, number)`, se asigna como `MAX+1` dentro de la transacción), `html_content` (`text`), `created_at`.
- **comment**: `id`, `version_id`, `block_id` (nullable), `fragment` (nullable, primeros 150 caracteres de texto del bloque al comentar), `text`, `attended`, `created_at`. `CHECK`: `block_id` y `fragment` ambos null (comentario general) o ambos con valor.
- **action**: `id`, `plan_id`, `version_id` (la versión que se comentó), `type` (`refine` | `implement`), `consumed`, `created_at`, `consumed_at`. Índice único parcial `(plan_id) WHERE consumed = false`: a lo sumo una acción pendiente por plan, garantizado por la BD.

Convenciones: ids `uuid` (aparecen en URLs compartibles, no deben ser enumerables); enums nativos de Postgres; `timestamptz`; tablas y columnas en inglés `snake_case`, propiedades TS en camelCase. La API mantiene los nombres en español del contrato (`titulo`, `contenidoHtml`, `estado`…), pero los valores de los enums son los de la BD.

Borrados en cascada: project → plan → version → comment; plan → action. Sin papelera.

El HTML se guarda en la BD como `text` en `version.html_content`, tal cual lo mandó el agente, sin transformar. No hay disco ni S3: el único estado del sistema es Postgres. TOAST comprime el valor; los listados nunca seleccionan esa columna.

**Bloques.** Un bloque es cualquier elemento del HTML con atributo `id`; es la unidad sobre la que se comenta. El agente decide qué lleva `id` y con qué granularidad. Los bloques pueden anidarse un nivel (un bloque dentro de otro, no más). Esta regla se documenta en la skill del agente; el servidor no la valida, el visor solo hace comentables los primeros dos niveles.

### Máquina de estados (turnos)

```
POST plan (crea v1) ──────────────────────────────────▶ user_turn
user_turn ──(refine)──▶ agent_turn ──(resolver: v(n+1))──▶ user_turn
user_turn ──(implement)──▶ approved ──(resolver: v(n+1) opcional)──▶ approved
```

Reglas:
- Comentar y crear acciones solo en `user_turn`; de lo contrario 409.
- Solo puede haber una acción no consumida por plan; una segunda → 409.
- `resolver` es una transacción: crea la versión nueva si viene HTML, marca la acción consumida, marca `attended` a todos los comentarios de la versión comentada, y si el tipo era `refine` pasa el plan a `user_turn`.
- No existe "publicar versión" fuera de `resolver`: después de la v1, el agente solo publica respondiendo a una acción.
- Un comentario pertenece a una versión; nunca se re-ancla. Que un `id` cambie entre versiones no es problema por diseño.

### API

Prefijo `/api`. JSON. Autenticación por cookie (browser) o `Authorization: Bearer <api key>` (agente); las dos resuelven al mismo `user`. Todo lo que se crea le pertenece.

Proyectos:
- `GET /proyectos`
- `POST /proyectos { nombre }` → 200 existente o 201 nuevo (find-or-create, único por usuario).
- `DELETE /proyectos/{id}`

Planes:
- `GET /proyectos/{id}/planes` — lista con estado y fecha de última versión.
- `POST /proyectos/{id}/planes { titulo, contenidoHtml, sesion: { harness, id, titulo?, directorio? } }` → 201 `{ id, url, version: 1 }`. Crea v1 y deja `user_turn`.
- `GET /planes/{id}` → metadata, estado, `viewAccess`, `versionActual`, `agenteEscuchando`, versiones (número y fecha). Accesible sin sesión si `viewAccess = everyone`.
- `GET /planes/{id}/versiones/{n}/contenido` → `text/html`. Misma regla de acceso.
- `PATCH /planes/{id} { titulo?, viewAccess? }`
- `DELETE /planes/{id}`

Comentarios (solo dueño, solo en `user_turn`):
- `GET /planes/{id}/comentarios` — de todas las versiones, con `versionNumero` y `atendido`.
- `POST /planes/{id}/comentarios { bloqueId?, fragmento?, texto }` — sobre la versión actual. `bloqueId` y `fragmento` van juntos o ninguno.
- `PUT /comentarios/{id} { texto }`, `DELETE /comentarios/{id}`

Acciones:
- `POST /planes/{id}/acciones { tipo }` → 201, o 409 si hay una pendiente o no es `user_turn`.
- `GET /planes/{id}/acciones` — historial.
- `GET /planes/{id}/acciones/siguiente?wait=25&harness=codex&id=<sesion>` → long-poll (agente). `wait` default 25 s, máximo 55 s. 200 con `{ accionId, tipo, plan: { id, titulo, version }, comentarios: [{ id, bloqueId?, fragmento?, texto }], contenidoUrl }`, o 204 al vencer. Mientras la request está abierta, el servidor registra en memoria que hay un agente escuchando ese plan.
- `POST /acciones/{id}/resolver { contenidoHtml? }` → 200 `{ version }` (agente).

Cuenta:
- `/auth/*` — Better Auth (login con Google, sesión, logout).
- `POST /token` → genera la API key, devuelve el valor en claro una sola vez, guarda el hash. Regenerar reemplaza.

Operación: `GET /health`.

### Frontend

SPA con cuatro rutas: `/` (proyectos), `/proyectos/[id]` (planes), `/planes/[id]` (visor), `/token`. Datos vía Eden Treaty en `load` del cliente. El visor hace polling de `GET /planes/{id}` cada 5 s mientras el estado sea `agent_turn` y recarga el iframe cuando cambia `versionActual`.

Un plan con `viewAccess = everyone` se puede abrir sin sesión en `/planes/[id]` (solo lectura: sin panel de comentarios ni botones).

### Visor

El celular es el dispositivo principal de revisión; el desktop es secundario. Todo lo que sigue tiene que funcionar con touch y en una pantalla angosta: los bloques se marcan con tap, no con hover; el panel de comentarios y la barra de acciones se acomodan abajo, no al costado. Los detalles visuales (glass, "despegar") se diseñan para touch primero.


- `iframe` con `sandbox="allow-scripts"` (sin `allow-same-origin`), contenido por `srcdoc`.
- El visor arma el `srcdoc` como HTML del agente + un `<style>` y un `<script>` propios. El script encuentra los bloques (elementos con `id`, hasta dos niveles), los decora (efecto glass al hover, "se despega" al click, badge con cantidad de comentarios), captura clicks y manda al padre `{ bloqueId, fragmento }` con `postMessage`; el padre le manda la lista de bloques con comentarios. Toda la inyección es del front, en tiempo de render: el back siempre devuelve el HTML crudo y nada se persiste transformado. El agente solo pone ids.
- Panel lateral con comentarios de la versión actual (editables mientras sea `user_turn`) y los atendidos de versiones previas, colapsados.
- Barra inferior: estado, "agente escuchando" (sí/no), botones Refinar / Implementar, selector de versiones.

### Autenticación y API key

- Login: Better Auth + Google, `prompt: select_account`, sin email/password.
- API key: una por usuario ("god key"). Se genera en `/token`, se muestra una vez, se guarda su hash SHA-256 en `user.api_key_hash`. Regenerar reemplaza el hash (invalida la anterior). Riesgo asumido y documentado: quien tenga la key puede publicar y resolver como el usuario.
- Del lado del agente, la key vive en `HTMLPLAN_TOKEN` / `~/.config/htmlplan/token`, nunca en un repo.

### Cliente agente (fuera del repo)

Una skill de Claude Code (`/serve-html`) con un script que loopea el long-poll, reintenta ante error de red, y termina imprimiendo la acción cuando llega. El agente lo lanza en background, su turno termina, y el harness lo despierta con el resultado. Si la espera muere (Monitor cerrado, sesión reabierta), volver a correr `wait` recupera la acción pendiente: el servidor no la consume hasta la versión siguiente. El script detecta el harness y el id de sesión por entorno y, en Claude Code y Codex, lee título y directorio de sus logs locales (`~/.claude/projects/*/<id>.jsonl`, `~/.codex/session_index.jsonl` y el rollout); sin directorio detectado guarda la raíz del repo. El visor muestra, cuando el turno es del agente, un botón "Reanudar": para Claude Code y Codex el comando de CLI (`cd <dir> && claude --resume <id>`, `cd <dir> && codex resume <id>`) o el título a buscar en la GUI; para cualquier otro harness un prompt para pegar en la conversación original, que retoma con `wait`. La key vive en `HTMLPLAN_TOKEN` / `~/.config/htmlplan/token`, nunca en un repo.

## Testing Decisions

Qué es un buen test acá: uno que ejercita comportamiento observable desde afuera (una función del servicio con entrada y salida sobre una BD real, o una interacción de UI) y que fallaría si cambiara una regla de negocio. No se testean detalles de Drizzle, de Better Auth ni de SvelteKit.

### Seam principal: la app de Elysia en proceso, contra Postgres real

Vitest (o `bun test`) con `TEST_DATABASE_URL` (el mismo contenedor de dev; en CI, un service container). Los tests construyen la app y la ejercitan con `app.handle(new Request(...))`: sin puerto, sin mocks de BD, y cubriendo ruteo + validación + servicio + transacción en un solo lugar. La identidad se inyecta creando una sesión en la BD y mandando la cookie (o una API key de prueba); Google nunca entra en juego. Reglas que dan los 8 tests del TP5:

1. Un usuario solo ve/edita sus proyectos y planes (propio → 200, ajeno → 404).
2. Nombre de proyecto único por usuario; find-or-create devuelve el existente.
3. Comentar fuera de `user_turn` → 409.
4. Crear acción fuera de `user_turn` → 409.
5. Segunda acción con una pendiente → 409.
6. `refine` → `agent_turn`; `implement` → `approved`.
7. `resolver` con HTML crea versión n+1, consume la acción, atiende los comentarios de la versión comentada, y devuelve el plan a `user_turn` si era `refine`. Todo o nada.
8. `resolver` sin HTML consume la acción sin crear versión.

Extra, si sobra: long-poll devuelve 204 sin acción y 200 cuando se crea una mientras espera; `everyone` permite leer sin sesión pero no comentar.

### Seam secundario: componentes de UI

Vitest + `@testing-library/svelte`, 4 comportamientos:

1. Botones Refinar / Implementar deshabilitados fuera de `user_turn`.
2. El formulario de comentario no envía con texto vacío.
3. El selector de versiones muestra n entradas y marca la actual.
4. El aviso "ningún agente escuchando" aparece cuando `agenteEscuchando` es falso.

Prior art: ninguno en el repo (arranca de cero). Referencia de estilo: tests chicos de una regla cada uno, sin mocks de BD, y Elysia probado por `handle` como recomienda su propia documentación.

## Out of Scope

- Roles, equipos, múltiples API keys, revocación individual.
- Comentarios o acciones de personas que no sean el dueño. `everyone` es solo lectura.
- Diff entre versiones. Solo se listan y se abren.
- Anotaciones gráficas (flechas, dibujos, resaltados libres) y selección de texto dentro de un bloque. Un comentario es `bloque + texto`. El agente recibe siempre texto, nunca imágenes.
- Webhooks, SSE o cualquier canal en que el servidor llame al agente. Notificaciones al usuario.
- Almacenamiento fuera de la BD (S3, disco).
- Más de una instancia del servidor (el canal del long-poll es en memoria).
- La skill y el script del agente dentro de este repo.
- SSR en el frontend. Es una SPA estática; si algún día hace falta, `adapter-node` reemplaza a `adapter-static`.

## Further Notes

- **Por qué esta app para el TP**: cumple frontend + backend + BD como tres contenedores, tiene tamaño de CRUD + 4 pantallas, y trae reglas de negocio reales (turnos, transiciones, ownership, unicidad, transacción) que cubren los 8 + 4 tests del TP5 sin inventar nada. Además tiene dos problemas genuinos para TPs posteriores: servir HTML de terceros (TP9: `sandbox`, CSP, XSS) y un concepto nativo de aprobación humana con fecha (TP6).
- **Por qué dos servicios**: se consultó a la cátedra sobre un único módulo SvelteKit; la respuesta fue que se acepta pero se desaconseja, porque el TP2 evalúa justamente cómo se encuentran dos contenedores (frontend → backend por nombre, vía proxy) y cómo un pipeline construye dos artefactos en paralelo. Backend y frontend separados desde el inicio.
- **Por qué Elysia**: tipos de punta a punta con Eden sin generación de código, validación de input integrada, y se testea en proceso con `handle`. Bun porque es el runtime que Elysia asume.
- **Dependencia externa**: Google OAuth. Es la única API de terceros; es gratis y estable, y el login no está en el camino crítico de ningún test.
- **Decisión de producto**: un plan pertenece a la sesión que lo publicó. `POST /planes/{id}/versiones` y `GET /planes/{id}/acciones/siguiente` exigen `{ harness, id }` y responden 403 si no coinciden; el script guarda su estado por servidor, repo, harness y sesión, así dos agentes sobre el mismo tema en el mismo repo nunca comparten plan.
- **Decisión de producto**: el agente se despierta por *acción*, no por *comentario*, y el usuario solo comenta en su turno. Eso elimina las condiciones de carrera entre "estoy comentando" y "el agente ya regeneró".
