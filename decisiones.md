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
