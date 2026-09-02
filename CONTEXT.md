# htmlplan

Hosting de planes HTML generados por agentes de IA, con feedback humano por turnos que vuelve al agente.

## Language

### Actores

**Usuario**:
La persona dueña de una cuenta. Revisa planes, comenta y decide.
_Avoid_: Cliente, humano, revisor

**Agente**:
Un programa (Claude Code u otro) que publica planes en nombre del usuario y responde a sus acciones, autenticado con la API key del usuario.
_Avoid_: Bot, cliente, skill

**Visitante**:
Quien abre un plan compartido sin iniciar sesión. Solo lee.

**API key**:
El único secreto que identifica a un agente como el usuario. Una por usuario; regenerarla invalida la anterior.
_Avoid_: Token, credencial

### Contenido

**Proyecto**:
Un contenedor de planes con nombre único por usuario.
_Avoid_: Repo, workspace, carpeta

**Plan**:
Un documento HTML que el agente propone y el usuario revisa por turnos. Tiene un estado y una o más versiones.
_Avoid_: Documento, página, artefacto, htmlplan

**Versión**:
Una publicación inmutable del HTML de un plan, numerada desde 1. La versión actual es la de número más alto.
_Avoid_: Revisión, snapshot, iteración

**Bloque**:
Un elemento del HTML de una versión que tiene atributo `id`. Es la unidad sobre la que se comenta. Un bloque puede contener bloques, hasta un nivel de anidación.
_Avoid_: Sección, elemento, nodo, componente

**Fragmento**:
Los primeros 150 caracteres de texto de un bloque, capturados al comentar, para saber sobre qué era el comentario sin abrir el HTML.
_Avoid_: Extracto, preview, snippet

### Feedback

**Comentario**:
Texto del usuario sobre una versión. Puede estar anclado a un bloque o ser general. Pertenece a una versión y nunca se re-ancla.
_Avoid_: Anotación, nota, feedback, marca

**Comentario general**:
Un comentario sin bloque, sobre el plan entero.

**Atendido**:
Un comentario cuya acción ya fue resuelta por el agente. Se muestra como histórico.
_Avoid_: Resuelto, cerrado, leído

**Acción**:
La decisión del usuario que cierra su turno y despierta al agente: Refinar o Implementar. Lleva los comentarios de la versión comentada.
_Avoid_: Botón, evento, request, comando

**Refinar**:
Acción que pide al agente una versión nueva a partir de los comentarios.
_Avoid_: Iterar, regenerar, revisar

**Implementar**:
Acción que aprueba el plan. El agente puede publicar una versión final y pasa a ejecutarlo.
_Avoid_: Aprobar, aceptar, commitear

**Acción pendiente**:
Una acción que el agente todavía no resolvió. Hay como máximo una por plan.

**Resolver**:
Lo que hace el agente con una acción pendiente: opcionalmente publica una versión nueva, marca atendidos los comentarios y devuelve el turno.
_Avoid_: Responder, completar, cerrar

### Turnos

**Turno del usuario**:
Estado del plan en que el usuario puede comentar y crear una acción. Estado inicial de todo plan.

**Turno del agente**:
Estado del plan mientras hay una acción Refinar pendiente. Nadie comenta.

**Aprobado**:
Estado final del plan tras Implementar. No vuelve atrás.

**Agente escuchando**:
Que hay una conexión abierta de un agente esperando la próxima acción de un plan. Es un hecho momentáneo, no persistido.
_Avoid_: Online, conectado, activo

### Acceso

**Acceso de vista**:
Quién puede abrir un plan: `owner` (solo el dueño) o `everyone` (cualquiera con el link, solo lectura).
_Avoid_: Visibilidad, público/privado, compartido
