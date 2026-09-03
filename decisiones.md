# TP 1

1. Porque es una decision tuya
2. Ninguno
3. Ninguna

# TP 2

Voy a hacer una aplicacion para que los agentes suban sus planes en archivos html y los muestren.
El usuario da feedback a esos planes mediante anotaciones o artefactos.
Se genera un loop entre agente y usuario hasta que este listo. El usuario commitea el plan y agente implementa

Elegi esto porque quiero aprovechar a hacer algo que me sirva pero que no sea complejo

> Decisiones de contenerización

1. Elegi como imagenes base:
- `/back`: multi-stage con dos etapas (dependencias + ejecutar)
- `/front`: multi-stage con dos etapas (build + ejecutar) (es mas simple porque es html y js estatico)
- Base de datos `postgres`


2. Persistencia  

Lo unico que persiste es la información de la base de datos (en un volumen `db_data`)

> Problemas encontrados

- Puse las variabesl .env entre comillas "", esto me causaba errores
- Configuar el token write:package
- La contraseña de la base de datos utilizaba caracteres especiales que interferian en la url. La solución fue poner `PGPASSWORD: ${DB_PASSWORD}` en docker-compose

# TP 3

> Decisiones de planificación

1. Elegi un sprint de 2 semanas porque coincide con el ritmo de entregas de la materia. Tambien evita mantener ramas abiertas durante mucho tiempo.

2. El limite de `In Progress` es 2. Trabajo solo: puedo tener un item activo y otro si el primero queda esperando una revision o respuesta. Un limite mayor me haria empezar muchas cosas sin terminarlas.

> Historia mal escrita

`Como desarrollador quiero crear la tabla usuarios para guardar los datos` es una tarea tecnica, no una historia. Describe como implementarlo pero no el valor para el usuario.

La reescribiria como: `Como usuario quiero crear una cuenta para guardar mis planes y volver a consultarlos`. Crear la tabla quedaria como una tarea.

> Problemas encontrados

- El projecto de GitHub se creo vacio. Los issues se tienen que agregar manualmente.
- La sesion de `gh` estaba vencida. Para seguir hay que renovarla con permisos de repositorio y Projects.

> Uso de IA

Use IA para interpretar la guia, preparar los issues y redactar estas decisiones. La verificacion final consiste en comparar el resultado con los requisitos del TP y revisar la jerarquia, el sprint, el tablero y el cierre automatico de la tarea.

# TP 4

> Estructura del pipeline

1. Dos jobs, `build-back` y `build-front`, uno por Dockerfile. Corren en paralelo porque no dependen entre si y asi el pipeline tarda lo que tarda el mas lento, no la suma. Si uno falla el otro sigue y veo enseguida cual imagen se rompio.

2. Corre en `pull_request` y en `push` a `main`. El PR verifica el cambio antes de entrar. El push verifica el merge final y es lo que alimenta el badge.

> Que cachea

Uso `type=gha` con `mode=max` para guardar tambien las capas de las etapas intermedias. Cada job tiene su propio `scope` para que back y front no se pisen.

- Se reutilizan: `FROM`, `COPY package.json bun.lock` y `RUN bun install` mientras no cambie el lockfile.
- No se reutilizan: `COPY src` en el back y `COPY . .` + `bun run build` en el front, cualquier cambio de codigo las invalida.

Si el cache desaparece el build no falla, solo tarda mas porque reconstruye todo. Paso de unos 20 segundos por job a mas de un minuto.

> Por que construir con el Dockerfile

Si el pipeline compila por su cuenta con `bun install` y `bun run build` estoy verificando una receta distinta a la que despues se despliega. Puede pasar el pipeline y fallar la imagen. Usando el Dockerfile se verifica exactamente lo que corre en produccion.

> Gate

`main` exige dos cosas para aceptar un merge: PR obligatorio (TP1) y los checks `build-back` y `build-front` en verde, con `strict: true` para que la rama este al dia con `main` antes de mergear. La secuencia rota -> bloqueado -> fix -> verde -> merge esta en el PR #15.

> Problemas encontrados

- El primer intento de romper el build cambio el destino del `COPY` (`./srcc`). Eso no rompe el build, rompe en runtime. Lo cambie por un origen inexistente (`COPY srcc ./src`).
- La primera corrida en `main` no mostro `CACHED` aunque el PR ya habia subido el cache. El cache de GitHub Actions esta aislado por rama: una corrida solo lee el de su rama o el de `main`. Recien despues del push a `main` los PRs empezaron a reutilizarlo.
- El workflow del TP3 corria tests. Este TP pide solo build, asi que los saque.

> Uso de IA

Use IA para interpretar la guia, escribir el workflow, hacer la demo del gate y redactar estas decisiones. Lo verifique mirando los logs de Actions (las lineas `CACHED` y el error del build roto), el estado `BLOCKED` del PR y la configuracion de la rama con `gh api`.
