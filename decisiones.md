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
