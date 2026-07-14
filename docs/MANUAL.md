# Fromly — Manual de usuario

> Web · Mac · iPhone · fromly.app · Última actualización: 14 julio 2026

---

## Fromly 2.0 — lo que ves al entrar hoy

Desde julio de 2026, **Fromly abre por defecto en el chat** (Fromly 2.0). Este manual documenta esa
experiencia, que es la que verás por defecto en web, Mac e iPhone. Si prefieres el modelo clásico de
árbol y lienzo infinito (Fromly 1.0), sigue disponible en [fromly.app/v1](https://fromly.app/v1) —
el modelo de datos es el mismo (nodos, tareas, contextos, recursos), solo cambia la interfaz. Al
final de este manual tienes un apéndice breve sobre esa vista clásica.

Al entrar en Fromly tienes **tres columnas**:

- **Izquierda — Contextos**: tus Áreas (siempre activas, p. ej. "Trabajo", "Personal") y Proyectos
  (subcontextos que se abren y se cierran), en jerarquía. Clic en uno para centrar la conversación
  en él.
- **Centro — el chat**: tu forma principal de trabajar. Escribe lo que necesites en lenguaje
  natural — «recuérdame llamar a Ana el lunes», «resume mi día», «busca en mis notas sobre X» —
  y la IA crea tareas, notas y eventos, les pone fecha, los clasifica en su contexto, o te
  responde con lo que ya guardas. Arrastra un PDF, una imagen o un archivo directamente al chat
  para incorporarlo a la conversación.
- **Derecha — cinco pestañas**: **Contexto** (qué sabe Fromly de este tema, más sus tareas y
  elementos), **Elementos** (buscador de todo tu contenido), **Historial** (tus conversaciones
  anteriores), **Hoy** (la agenda de tu día, arrastrable al Planificador) y **Agenda** (cualquier
  día, calendario anual).

**Archivos y RAG.** Cuando subes un archivo, Fromly lo indexa: puedes preguntarle sobre su
contenido en cualquier momento, no solo justo después de subirlo. Los PDF se abren con visor real
(subrayado de texto + recorte de región como imagen).

**Primera vez.** Un tour guiado de 6 pasos aparece automáticamente la primera vez que entras,
explicando estas mismas piezas. Puedes saltarlo o revisarlo de nuevo borrando el localStorage del
navegador si algún día quieres repasarlo.

---

## Novedades (julio 2026, Fromly 2.0)

- **Archivos y PDF**: arrastra un PDF o imagen a cualquier sitio (chat o columna de contextos) — si
  tienes una conversación abierta se incorpora a ella, si no se importa directamente. Los PDF se
  abren con visor real: puedes **seleccionar texto y subrayar** (el subrayado queda marcado en
  amarillo sobre la propia página) y **recortar cualquier región como imagen** con la herramienta de
  recorte de la barra de herramientas. Cada PDF muestra una miniatura de su primera página.
  Puedes **quitar un archivo de una conversación** sin borrarlo — sigue guardado y buscable.
- **Conector con Claude (MCP)**: Claude puede buscar, crear, editar, **borrar y mover** tus notas, subir archivos reales y hacer limpiezas por lotes. Las notas que crea Claude son documentos normales (no listas de puntos).
- **Agenda = Hoy**: entrar a cualquier día desde el calendario anual muestra exactamente la misma
  vista que la columna "Hoy" (eventos, para hacer, seguimiento, por planificar), con botones "+"
  directos en cada bloque para crear un evento o una tarea de ese día.
- **"Notas" en cualquier contexto, conversación o tarea**: un editor de nota completo (el mismo que
  usas en cualquier nota — formato, favorito, exportar, publicar) para apuntar lo que quieras,
  aparte de las tareas y elementos de ese sitio. Nota y Lienzo son dos tipos separados desde que los
  creas ("+Nota"/"+Lienzo" en la cabecera del chat) — ya no se cambia uno por otro después.
- **Contexto padre**: puedes asignar o cambiar el contexto padre de cualquier contexto directamente
  desde la columna derecha.
- **Columna "Hoy" más compacta**: cada tarea en una sola línea, con chips de hora, fecha (color
  según esté atrasada, sea hoy o futura) y repetición, más su contexto al lado.
- **Contexto de cualquier elemento**: siempre visible y editable — nota, tarea, PDF, imagen o
  enlace — con un chip y un botón para cambiarlo, y clic para navegar directamente a ese contexto.
- **Historial global** más limpio: lista tus conversaciones y elementos para saltar rápido a
  cualquier sitio; los comandos rápidos de un solo turno («créame una tarea…») ya no lo saturan.
- **Agentes y Prompts, ahora en cualquier contexto**: puedes crear un Agente (una automatización que
  corre sola cada día en la nube) o un Prompt (una plantilla de instrucciones reutilizable)
  colgando de cualquier contexto o proyecto, igual que una nota o una tarea — pídeselo a la IA por
  chat ("quiero un informe diario de X") o créalo con el botón correspondiente. Empiezan
  desactivados hasta que revisas y activas el prompt tú mismo. Aparecen junto al resto de elementos
  del contexto, con su propio icono.
- **Prompts en el chat**: el botón "⚡ Prompt" en la cabecera lista tus plantillas guardadas —
  seleccionar una la envía directamente, con sus variables ya rellenas.
- **Dictado por voz en el chat**: el micrófono junto al campo de escritura transcribe en vivo lo que
  dices (atajo Alt+Espacio) — distinto de "Grabar audio", que guarda una nota de voz aparte.
- **Elementos: Conversaciones y Lienzos por separado**: las conversaciones ya aparecen como un
  elemento más (con su propio filtro), y los lienzos tienen su propio filtro con miniaturas visuales
  reales de cada dibujo, en vez de listarse como texto.
- **Un contexto nuevo ya sabe de qué habla**: cuando le pides a la IA crear un contexto para algo
  concreto ("quiero llevar el análisis de mercado diario"), la primera conversación que abras ahí
  ya continúa con naturalidad — antes empezaba con un saludo genérico.

---

## 1. ¿Qué es Fromly?

Fromly es tu segundo cerebro personal, **chat-first**: escribes en lenguaje natural, como le
hablarías a un ayudante de confianza, y Fromly crea, clasifica y recuerda por ti. No hace falta
navegar un árbol de carpetas ni aprender una sintaxis especial — la caja de chat del centro es la
puerta de entrada a todo.

Existe para la persona que tiene demasiadas cosas en la cabeza, demasiadas apps para gestionarlas y
no quiere invertir horas configurando sistemas complejos. En Fromly, capturas, organizas y actúas
desde una conversación, disponible en Web, Mac e iPhone con la misma cuenta.

---

## 2. Primeros pasos

### Crear cuenta

Ve a [fromly.app](https://fromly.app) y pulsa **Crear cuenta**. Puedes registrarte con:

- Email y contraseña
- Cuenta de Google
- Apple ID

Con la misma cuenta accedes desde el navegador, Mac e iPhone. Todo sincroniza **en tiempo real**:
empieza una idea en el móvil y aparece al instante en el ordenador. La sincronización registra cada
cambio como una operación, así que nunca pierde ni borra nada por error — incluido lo que crees
desde Claude o tus agentes, que también aparece al momento.

### Acceder desde el navegador

Ve a [fromly.app/app](https://fromly.app/app) desde cualquier navegador moderno. No necesitas
instalar nada.

También puedes instalarlo como app de escritorio ligera: en Chrome o Edge pulsa el icono de
instalación en la barra de dirección. En Safari iOS: Compartir → "Añadir a pantalla de inicio".

### Instalar en Mac

1. Ve a [fromly.app](https://fromly.app) y descarga el archivo `From.dmg`.
2. Abre el DMG y arrastra el icono de Fromly a la carpeta **Aplicaciones**.
3. Abre Fromly desde el Launchpad o desde la carpeta Aplicaciones.
4. Si macOS advierte que no puede comprobar el desarrollador, ve a **Ajustes del sistema →
   Privacidad y seguridad** y pulsa "Abrir igualmente".
5. Inicia sesión con tu cuenta.

**Actualizaciones automáticas:** cuando haya una nueva versión disponible, aparecerá `✦ Nueva
versión — Actualizar` en la barra inferior de Fromly. Un clic instala la actualización sin salir de
la app. No hace falta descargar nada manualmente.

### Instalar en iPhone

Busca **Fromly — Notas y PKM** en el App Store o accede desde [fromly.app/ios](https://fromly.app/ios).
Instala la app e inicia sesión con la misma cuenta. Tus notas aparecen en segundos.

### El primer arranque: qué ves

La primera vez que entras aterrizas directamente en el chat, con las tres columnas descritas al
principio de este manual (Contextos a la izquierda, chat en el centro, cinco pestañas a la
derecha). Un **tour guiado de 6 pasos** te va señalando cada pieza — puedes saltarlo en cualquier
momento.

No hace falta configurar nada antes de empezar: escribe tu primer mensaje en el chat ("tengo que
preparar la reunión del jueves", "apunta que Marina llega el viernes a Madrid"...) y Fromly ya crea
la tarea o la nota correspondiente, clasificada en el contexto que le corresponda.

---

## 3. El chat — tu forma de trabajar

El chat central es donde pasas la mayor parte del tiempo en Fromly. No hay una sintaxis que
aprender: escribes como piensas.

### Qué puedes pedirle

- **Crear**: "recuérdame llamar a Ana el lunes", "apunta que el proyecto X se retrasa una semana",
  "crea un evento con Marina el viernes a las 18:00". Fromly crea la tarea, nota o evento
  correspondiente, le pone fecha si la mencionas y la clasifica en su contexto.
- **Recordar y buscar**: "¿qué tareas tengo pendientes para hoy?", "busca en mis notas todo lo
  relacionado con el proyecto X", "resume mi día". Fromly responde con lo que ya tienes guardado.
- **Adjuntar contenido**: arrastra un PDF, una imagen o un archivo de texto directamente al chat —
  se incorpora a la conversación y queda indexado para preguntarle por su contenido cuando quieras
  (ver «Archivos y RAG» más abajo).

### La cabecera del chat

En la parte superior del chat tienes botones rápidos siempre a mano:

- **+Nota** — crea un documento nuevo (editor de texto enriquecido).
- **+Lienzo** — crea un lienzo de dibujo dentro del contexto activo.
- **+Tarea** — crea una tarea directamente, sin pasar por el chat.
- **+Evento** — crea un evento con fecha y hora.
- **Planificador** — abre la vista de calendario (día/semana/mes/año) en la columna derecha.
- **Grabar** — abre la grabadora de audio (ver «Nota de voz» en la sección de tipos de elemento).
- **⚡ Prompt** — despliega tus plantillas guardadas; elegir una la envía directamente al chat, con
  sus variables ya resueltas.

### Dictado por voz

El icono de micrófono junto al campo de escritura transcribe en vivo lo que dices mientras hablas
(atajo **Alt+Espacio**). Es distinto del botón **Grabar**: el dictado escribe directamente en el
chat, mientras que Grabar guarda una nota de voz aparte con su propia transcripción.

### Archivos y RAG

Todo lo que subes o escribes en Fromly se indexa automáticamente (embeddings semánticos sobre
Postgres). Esto significa que puedes preguntarle a Fromly por el contenido de un PDF o una nota en
cualquier momento — no solo justo después de subirlo, como en un chat normal con adjuntos
temporales. Los PDF, además, se abren con un visor real donde puedes subrayar texto y recortar
cualquier región como imagen.

---

## 4. Contextos — Áreas y Proyectos

Los contextos son la forma en la que Fromly organiza tu vida: cada nota, tarea o evento pertenece a
**un único contexto**. La columna izquierda muestra tu árbol de contextos.

### Áreas y Proyectos

- **Áreas**: contextos de nivel superior, siempre activos (por ejemplo "Trabajo", "Personal",
  "Familia"). Son los grandes cajones de tu vida.
- **Proyectos**: subcontextos dentro de un Área, pensados para cosas que **se abren y se cierran**
  (un lanzamiento, una mudanza, un viaje). Puedes archivarlos cuando terminan sin perder su
  contenido.

Clic en cualquier contexto de la columna izquierda para centrar la conversación en él — el chat, la
pestaña Contexto y la pestaña Elementos pasan a mostrar lo relacionado con ese contexto.

### Asignar un contexto

Cada nota o tarea tiene un único contexto, y puedes asignarlo de dos formas equivalentes:

- **`#` en el chat o en el título de un elemento**: escribe `#` y aparece un selector; confirma
  para asignarlo (o crea uno nuevo si no existe todavía).
- **El chip de contexto** en la ficha de cualquier elemento: si no tiene contexto verás un
  indicador para asignarlo; si ya lo tiene, el chip muestra su nombre y te deja cambiarlo con un
  clic. El mismo chip te lleva directamente a ese contexto.

Cuando creas algo desde el chat en lenguaje natural, Fromly decide solo el contexto más apropiado
según lo que escribes — tú puedes corregirlo después con el chip en cualquier momento.

### Contexto padre

Puedes asignar o cambiar el contexto padre de cualquier contexto directamente desde la columna
derecha, para reorganizar tu jerarquía de Áreas y Proyectos sin perder nada.

### "Lo que Fromly sabe" — la memoria de cada contexto

Cada contexto acumula su propia memoria: un documento vivo, "Lo que Fromly sabe", que se actualiza
solo a medida que guardas cosas relevantes ahí. No hace falta contárselo aparte — Fromly decide si
algo es lo bastante significativo para recordarlo y cómo integrarlo (puede reescribir o fusionar la
información existente, no solo añadir al final). Abre la pestaña **Contexto** de cualquier
conversación para verlo.

---

## 5. La columna derecha — cinco pestañas

La columna derecha cambia de contenido según la pestaña que elijas arriba:

- **Contexto** — qué sabe Fromly del tema en el que estás trabajando ("Lo que Fromly sabe"), más
  las tareas y elementos que cuelgan de ese contexto.
- **Elementos** — el buscador de todo lo que tienes guardado: notas, tareas, eventos, archivos,
  lienzos, conversaciones, agentes y prompts. Filtra por tipo, contexto, fecha o estado, y cambia
  entre vista de lista, tabla, kanban o calendario (vistas tabla/kanban/calendario disponibles en
  el plan Pro).
- **Historial** — tus conversaciones anteriores; clic para retomar cualquiera donde la dejaste.
- **Hoy** — la agenda de tu día: eventos, tareas por hacer, seguimiento y lo que tienes por
  planificar. Puedes arrastrar cualquier tarea de aquí directamente al Planificador para darle
  hora.
- **Agenda** — el calendario anual: navega a cualquier día y verás exactamente la misma vista que
  la pestaña Hoy, con botones "+" para crear eventos o tareas de ese día.

---

## 6. Tipos de elemento

Dentro de cada contexto puedes tener distintos tipos de elemento. Todos comparten el mismo chip de
contexto (siempre visible y editable) y quedan indexados para el chat y la búsqueda.

### Documento

Un documento es una nota de texto enriquecido — el mismo editor tipo Notion en cualquier sitio
donde escribas una nota larga: formato, favoritos, exportar y publicar con una URL pública. Créalo
con **+Nota** en la cabecera del chat, o pídeselo a la IA ("apúntame esto en una nota"). Pegar
prosa larga en una conversación también puede convertirse en documento.

### Lienzo (Pizarra)

Un lienzo es un espacio de dibujo libre dentro de un contexto — distinto de un documento desde que
lo creas ("+Lienzo" en la cabecera), no se convierte el uno en el otro después. Útil para bocetar,
tomar notas a mano o organizar visualmente ideas.

**Herramientas básicas:** lápiz, formas (línea, flecha, rectángulo, elipse), texto libre, borrador
y selección — con paleta de colores y varios grosores de trazo. Lo que dibujas o escribes se
sincroniza entre tus dispositivos, incluido el iPad.

**Cada día es también su propio lienzo.** Dentro del Planificador y la Agenda, cada día tiene su
espacio en blanco donde puedes escribir o dibujar directamente sobre la jornada, además de sus
tareas y eventos.

### Tarea

Las tareas tienen un checkbox ☐/☑. Márcala como hecha para archivarla y actualizar su estado.

**Cómo crear una tarea:** con el botón **+Tarea** de la cabecera del chat, o pidiéndoselo a la IA
en lenguaje natural ("recuérdame llamar a Ana el lunes"). Fromly interpreta la fecha, la prioridad
y el contexto directamente de lo que escribes.

**Propiedades de tarea (panel derecho):**

- **Estado**: Pendiente / En progreso / Hecho / Vencido.
- **Fecha de vencimiento**: escribe en lenguaje natural (`hoy`, `mañana`, `el próximo viernes`, `en
  3 días`, `15 junio`) y Fromly interpreta la fecha.
- **Prioridad**: alta, media o baja.
- **Repetición**: diaria, semanal, mensual o personalizada (cada N días/semanas/meses/años).

**Tareas sin fecha — seguimiento.** No hay un tipo aparte para "lo que tienes en curso": es
simplemente una tarea sin fecha. Permanece visible en la sección **"Seguimiento"** de la pestaña
Hoy hasta que la marcas hecha o le pones fecha. Esa sección arranca colapsada con un contador,
porque suele haber muchas.

### Evento

Los eventos tienen hora de inicio y de fin. Aparecen en el Planificador y en la Agenda del día
correspondiente. Si tienes Google Calendar conectado, sincronizan automáticamente en ambas
direcciones.

**Cómo crear un evento:** con el botón **+Evento** de la cabecera del chat, o pidiéndoselo a la IA
("crea un evento con Marina el viernes a las 18:00"). El modal de creación te permite poner
título, fecha (obligatoria), hora de inicio y fin (opcional — sin hora es un evento de todo el día)
y repetición.

**Editar un evento (cualquier dispositivo).** Desde el detalle del evento puedes ajustar hora de
inicio y fin y el lugar. Si tienes Google Calendar conectado, al guardar se crea o actualiza allí,
y "Eliminar evento" lo borra también de Google Calendar.

### Archivos: PDF, imágenes y otros

Arrastra un PDF, una imagen o un archivo directamente al chat o a la columna de contextos. Si tienes
una conversación abierta se incorpora a ella; si no, se importa directamente.

**PDF con visor real:** al abrir un PDF puedes **seleccionar texto y subrayarlo** (queda marcado en
amarillo sobre la página) y **recortar cualquier región como imagen** con la herramienta de recorte
de la barra de herramientas. Cada PDF muestra una miniatura de su primera página.

**Quitar sin borrar:** puedes quitar un archivo de una conversación sin eliminarlo — sigue guardado
y buscable desde la pestaña Elementos.

### Nota de voz (Grabadora)

El botón **Grabar** de la cabecera abre la grabadora de audio, pensada para una reunión o una nota
de voz larga:

1. Al pulsar **Grabar** empieza a grabar: ves un icono animado, un temporizador y, cuando el
   navegador lo soporta, la transcripción en vivo.
2. Al terminar, verás "Procesando…" mientras Whisper transcribe el audio completo.
3. El resultado queda como una nota con la transcripción, lista para que le pidas al chat que la
   resuma o extraiga tareas de ella.

### Conversaciones

Cada conversación que mantienes con el chat es en sí misma un elemento: aparece en la pestaña
Historial para retomarla, y también en Elementos con su propio filtro, junto a notas, tareas y
lienzos.

### Agente IA

Un agente es una automatización con instrucción propia, fuentes y horario propio, que cuelga de
cualquier contexto (no de una raíz única). Se crea pidiéndoselo a la IA por chat ("quiero un
informe diario de X") o con el botón correspondiente en el contexto.

**Empiezan desactivados.** Tienes que revisar el prompt generado y activarlo tú mismo antes de que
corra. El resultado de cada ejecución es un documento real, colgado del contexto del agente.

**Horario (schedule):** al abrir la app, diario, semanal o manual (lo ejecutas tú cuando quieras
con el botón ▶).

**Casos de uso habituales:**

- Resumir el diario de hoy cada noche.
- Extraer tareas de una nota larga cuando la terminas.
- Buscar en internet sobre un tema y guardar el resumen como nota.

### Prompt

Un prompt es una plantilla de instrucciones reutilizable, con variables, que cuelga de cualquier
contexto igual que una nota o una tarea. Se crea pidiéndoselo a la IA o con el botón correspondiente
del contexto.

**Cómo se usa:** el botón **⚡ Prompt** de la cabecera del chat lista tus plantillas guardadas;
elegir una resuelve sus variables (fecha, contexto actual, etc.) y la envía directamente.

Útil para: "resume esto en 3 bullets", "extrae las tareas", "mejora el tono formal", un informe
diario con el mismo formato cada vez.

---

## 7. El Planificador

El Planificador es la vista de calendario de Fromly. Ábrelo con el botón **Planificador** de la
cabecera del chat — ocupa la columna derecha, que se queda fija en la pestaña **Hoy** para que
puedas arrastrar tareas directamente al calendario mientras planificas.

### Cuatro vistas: Día · Semana · Mes · Año

- **Día**: timeline de horas con tus tareas y eventos con hora concreta; los bloques indican su
  hora de inicio y se pueden redimensionar para ajustar la duración.
- **Semana**: varios días en columnas. Arriba, una franja "todo el día" para las tareas con fecha
  pero sin hora.
- **Mes**: la cuadrícula del mes, con las tareas y eventos de cada día.
- **Año**: los 12 meses en una grid. Los días con contenido llevan un punto; clic en cualquier día
  abre su vista Día.

**Tareas vs eventos de un vistazo:** las tareas se muestran sin fondo (borde fino con un toque de
color); los eventos de Google se muestran con su color de fondo.

### Asignar hora a una tarea

Arrastra cualquier tarea de la pestaña **Hoy** al timeline del Planificador para darle hora — la
tarea sigue en su contexto, solo gana un chip con la hora asignada. También puedes hacer clic en
una hora vacía para crear una tarea nueva directamente ahí.

### Sincronización con Google Calendar al planificar

Si tienes Google Calendar conectado, el Planificador crea y actualiza eventos automáticamente:

- **Asignar hora** a una tarea → se crea un evento en Google Calendar.
- **Mover o redimensionar** el bloque → el evento de Google Calendar se actualiza al instante.
- **Quitar la hora** → el evento de Google Calendar se elimina.

Los eventos que ya existen en Google viven solo en Google (no se copian como notas en Fromly): se
muestran en el Planificador y en la Agenda con su color original, y al hacer clic en uno se abre su
editor con un botón **"➕ Crear nodo en Fromly"** — solo se crea una nota si lo pulsas tú.

---

## 8. Google Calendar

### Conectar

Ve a **Ajustes → Integraciones → Google Calendar** y sigue el proceso de autorización. Solo
necesitas hacerlo una vez.

### Cómo funciona

- Tus eventos de Google Calendar aparecen en el Planificador y en la Agenda con el color de cada
  calendario.
- Crear un evento en Fromly lo crea también en Google Calendar.
- Editar o eliminar un evento funciona en ambas direcciones.
- La sincronización tiene en cuenta tu zona horaria local.

Fromly sincroniza con **Google Calendar**, no con Apple Calendar/EventKit.

---

## 9. Compartir a Fromly (iPhone)

Cuando ves un vídeo en redes y quieres quedarte con **lo que dice, no con el vídeo**: pulsa
**Compartir → Fromly**.

- Se guarda una **captura** en tu día de hoy con el enlace, el autor, un título y resumen
  automáticos (en el idioma del vídeo) y la **transcripción** completa.
- Ocurre **en segundo plano**: la nota aparece al instante y la transcripción se rellena sola en
  unos segundos. No tienes que esperar.
- Funciona con **TikTok, YouTube, Instagram, X y muchos más**. Si compartes un enlace normal o un
  texto, se guarda tal cual (sin transcribir).
- **La primera vez**, activa Fromly en la hoja de compartir: desliza la fila de apps hasta el
  final → **Más / Editar** → activa **Fromly**.
- La transcripción usa tus **tokens de IA** (plan Pro o prueba).

---

## 10. Fromly para iPhone

La app de iPhone está disponible en el App Store con la misma cuenta que web y Mac. Todo lo que
capturas en iPhone aparece sincronizado en tiempo real en el resto de tus dispositivos, y viceversa.

Lo que puedes dar por seguro hoy en iPhone:

- **Notas, tareas y eventos**: crearlos, editarlos, marcarlos como hechos, asignarles fecha.
- **Sincronización en tiempo real** con la misma cuenta que web y Mac, viajando solo los cambios
  (deltas), no la base de datos completa.
- **Compartir a Fromly** desde otras apps (ver sección anterior).
- **Google Calendar**, si lo tienes conectado.

La app de iPhone está en un proceso de paridad progresiva con la interfaz de chat de la web y Mac:
si buscas específicamente la experiencia de tres columnas (Contextos / Chat / cinco pestañas)
descrita al principio de este manual, confirma en la propia app qué parte ya está disponible en tu
versión antes de asumir que coincide al cien por cien con la web.

---

## 11. Conexión con Claude (MCP)

Fromly está en el **directorio oficial de conectores de Claude** (Anthropic). Una vez conectado,
Claude puede buscar, crear, editar, **borrar y mover** tus notas y tareas, subir archivos reales y
hacer limpiezas por lotes — sin que tengas que pedirlo cada vez.

### Cómo conectar — directorio de Claude (recomendado)

Funciona desde cualquier dispositivo: claude.ai, iPhone, Android y Claude Desktop.

1. Abre Claude (claude.ai, app de iPhone/Android o Claude Desktop).
2. Ve a **Ajustes → Conectores**.
3. Busca **"Fromly"** en el directorio.
4. Pulsa **Conectar** e inicia sesión con tu cuenta de Fromly mediante OAuth.
5. Listo — Claude puede guardar notas y tareas en tu vault desde ese momento.

No necesitas instalar extensiones, copiar tokens ni introducir URLs manualmente.

### Cómo conectar — Claude Code (CLI)

Para Claude Code (la CLI de terminal), configura la conexión manualmente. Primero genera tu token en
**Fromly → Ajustes → Accesorios**. Luego añade la entrada `from` a `~/.claude.json` bajo la clave
`mcpServers`:

```json
"mcpServers": {
  "from": {
    "type": "http",
    "url": "https://from-server-production.up.railway.app/mcp",
    "headers": { "Authorization": "Bearer TU_TOKEN" }
  }
}
```

Reinicia Claude Code. Fromly funciona automáticamente desde ese momento.

### Qué hace Claude con Fromly automáticamente

- **Guarda documentos y análisis** que genera durante la conversación, como notas normales (no
  listas de puntos).
- **Crea tareas** cuando mencionas acciones pendientes.
- **Guarda resúmenes de sesión** cuando dices "fin".
- **Busca en tu vault** antes de responder para darte contexto real.
- **Puede borrar y mover** notas y tareas cuando se lo pides, además de crear y editar.

**Ejemplos:**

```
"¿Qué tareas tengo pendientes para hoy?"
"Añade una tarea para llamar a Adrián mañana a las 10"
"Busca en mis notas todo lo relacionado con el proyecto X"
fin  →  Claude guarda el resumen de la conversación en Fromly automáticamente
```

---

## 12. Accesorios — captura desde cualquier sitio

Fromly no te obliga a tener la app delante. Estos accesorios mandan lo que tengas a tu **día de
hoy**, y la inteligencia de Fromly se encarga de clasificarlo (tipo, fecha, contexto). Todos —salvo
la barra de menús— se conectan con el **token de API** de tu cuenta.

### El token de API

Es la llave que usan Raycast, Chrome y Claude Code (CLI) para hablar con tu Fromly. Se genera y
copia en **Ajustes → Accesorios** (es el mismo token para los tres; regenerarlo invalida el
anterior). Vive 1 año. Para Claude en web, iPhone, Android y Desktop no necesitas el token — usa el
directorio de conectores (ver sección 11).

### Barra de menús (Mac)

Fromly vive en la barra de menús del Mac con su icono.

- **Clic en el icono** (o menú → *Captura rápida*) → abre una ventana de captura tipo Spotlight:
  escribe una nota, tarea o evento y cae en tu día de hoy. Fromly detecta el tipo, la fecha y el
  contexto.
- Cerrar la ventana principal **no** cierra Fromly: sigue disponible en la barra de menús.
- **Ocultarlo**: Ajustes → Accesorios → desactiva "Mostrar icono en la barra de menús", o clic
  derecho en el icono → *Ocultar este icono*.

### Atajo de Apple (tecla global)

Para capturar desde **cualquier app** con una sola tecla.

1. En **Ajustes → Accesorios → Atajo de Apple** pulsa **"Instalar atajo de Apple"** (abre el atajo
   listo en la app Atajos) y añádelo.
2. En la app Atajos, abre los **Ajustes del atajo → Tecla rápida** y asígnale la combinación que
   quieras (por ejemplo ⌃⌥Espacio).
3. Al pulsarla, te pide el texto y lo guarda directamente en tu día de hoy.

Por debajo usa el enlace `from://capture?text=…&silent=1`. Si prefieres montarlo a mano, crea un
Atajo con la acción *"Abrir URL"* usando ese enlace y sustituye `[Texto]` por *"Pedir texto"* o
*"Portapapeles"*.

### Raycast

Extensión de Fromly para [Raycast](https://raycast.com):

- **Create in Fromly** — escribe y cae en tu día de hoy (Fromly decide si es nota, tarea o evento).
- **Search Fromly** — busca en todo tu vault y abre el resultado en la app o en la web.
- **Open Today's Note** — abre la agenda de hoy.

Instálala desde la Raycast Store y pega tu token de API en sus preferencias (Ajustes → Accesorios →
Raycast → copiar token).

### Chrome

Extensión de Fromly para Chrome:

- **Clic en el icono** → guarda la URL de la pestaña actual en tu día de hoy (se convierte en
  enlace).
- **Selecciona texto → clic derecho → "Enviar selección a Fromly"** → lo guarda como nota.

Instálala desde la Chrome Web Store, abre sus **Opciones** y pega tu token de API.

### Conexión con Claude (MCP)

La integración con Claude Desktop/Code está descrita en la sección anterior — usa el mismo token de
API para Claude Code.

---

## 13. Backup y privacidad

### Backup automático en el servidor

Fromly crea un snapshot completo de tus datos en el servidor cada 2 horas (solo cuando hay
cambios). Se conservan los últimos **12 snapshots** (~24 horas de historial continuo).

Puedes crear un snapshot manual cuando quieras: **Ajustes → Datos → Backups → "Crear snapshot
ahora"**.

### Restaurar un backup

En **Ajustes → Datos → Backups**, elige cualquier snapshot de la lista y pulsa "Restaurar". Antes
de sobrescribir tus datos, el servidor crea automáticamente un snapshot de seguridad (`pre-restore`)
para que puedas deshacer si te equivocas.

### Exportar tus datos

En **Ajustes → Exportar** puedes descargar todos tus datos en cualquier momento:

- **JSON**: formato estructurado con todos los metadatos (para uso programático o migraciones).
- **Markdown**: una carpeta de archivos `.md`, uno por elemento con contenido. Legible en cualquier
  editor.

Tus datos no están atrapados en Fromly. La exportación es completa, sin restricciones, y funciona
en el plan gratuito.

### Privacidad

- La IA solo accede al contenido que está en el contexto de la conversación activa: la
  conversación abierta, sus archivos adjuntos y los contextos que tengas activos. No escanea todo
  tu vault de forma automática salvo cuando le pides explícitamente que busque en tus notas.
- El backup local en Mac se guarda en `Application Support/Fromly/Backups/` en tu propio ordenador.
- Fromly usa un sistema de sincronización por operaciones (op-log): registra cada cambio en vez de
  inferir borrados, así que nunca pierde ni borra nada por error — incluidos los cambios hechos
  desde Claude o tus agentes.

---

## 14. Ajustes

### Cuenta

- **Email**: solo lectura (cambiarlo rompería el inicio de sesión con Google/Apple).
- **Contraseña**: puedes cambiarla (pide la actual).
- **Suscripción**: tu plan y, si tienes suscripción activa, renovación, «Cancelar» y «Gestionar
  facturación» (portal de cliente). En plan gratuito solo verás «Mejorar».
- **Eliminar cuenta**: protegida — pide confirmar con tu contraseña (o tu email si entras con
  Google).

### Idioma

Fromly está disponible en **12 idiomas** de interfaz: español, inglés, alemán, francés, italiano,
portugués, griego, neerlandés, polaco, ruso, turco y sueco. El idioma se detecta automáticamente a
partir de la configuración de tu navegador o sistema operativo (inglés si el tuyo no está
disponible — nunca asume español).

Para cambiarlo manualmente: **Ajustes → 🌐 Idioma** y elige tu idioma. El cambio se aplica de
inmediato sin necesidad de recargar. La IA y la voz siguen el mismo idioma de la interfaz.

### Apariencia

- **Tema**: claro u oscuro.
- **Color de acento**: varios colores para el interfaz.
- **Calendario y Planificador**: hora de inicio y fin del día visible (por defecto 7:00-23:00).

### IA

- **Tokens incluidos**: tu saldo de tokens de IA del mes, y opción de comprar una recarga.
- **Claves API propias**: con licencia perpetua puedes usar tus propias claves de Anthropic/OpenAI/
  Google (el consumo va a tu cuenta).
- **Idioma de la IA**: español, inglés o automático.

### Integraciones

Conectar/desconectar Google Calendar y ver el estado de sincronización, y gestionar la conexión MCP
con Claude.

### Accesorios

Token de API, barra de menús (Mac), Atajo de Apple, Raycast, Chrome y Claude. Ver sección 12.

### Datos / Backup

- Snapshots automáticos cada ~2h; crear snapshot manual; restaurar uno anterior.
- **Exportar** una copia completa en JSON o Markdown.

### Importar

Fromly importa desde otras apps con un **asistente paso a paso**. Ve a **Ajustes → Importar** y
elige la fuente:

- **Obsidian** — sube la carpeta del vault (.md). Se respeta la estructura de subcarpetas.
- **Notion** — exporta a «Markdown & CSV», descomprime el .zip y sube la carpeta.
- **Apple Notes** — pásalas antes a .txt/.md y súbelas.
- **Markdown / texto** — uno o varios archivos .md/.txt, o una carpeta entera.
- **Fromly (JSON)** — una copia de seguridad exportada desde Fromly.

Lo importado se organiza en un contexto propio (con fecha de importación) para que lo revises y
reorganices sin tocar tus notas actuales.

---

## 15. Atajos de teclado

| Acción | Atajo |
|---|---|
| Dictado por voz en el chat | `Alt+Espacio` |
| Negrita (en el editor de documento) | `⌘B` |
| Cursiva (en el editor de documento) | `⌘I` |
| Deshacer | `⌘Z` |
| Rehacer | `⌘⇧Z` |

Fromly sigue añadiendo atajos de teclado a la interfaz de chat; consulta **Ajustes → Atajos** para
ver los disponibles en tu versión.

---

## 16. Planes y precios

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | €0 | Hasta 1.000 nodos sincronizados. Outliner + diario, búsqueda avanzada, Mac + iPhone + web, sync en tiempo real. Sin IA, sin archivos adjuntos, sin publicar notas. |
| **Pro Mensual** | €7/mes | Todo lo de Gratis + nodos ilimitados + IA completa (Claude) + Agentes + Prompts + vistas tabla/kanban/calendario + archivos adjuntos + publicar notas con URL + soporte prioritario + 2.000.000 tokens de IA al mes incluidos. |
| **Pro Anual** | €49/año (~€4,08/mes) | Todo lo de Pro Mensual, facturado anualmente. Ahorras cerca de un **42%** frente al mensual (7×12 = 84€ → 49€). |
| **Lifetime** | €149 pago único | Todo lo de Pro, para siempre, sin suscripciones, + 3.000.000 tokens de IA incluidos de una vez. |

**Recarga de tokens:** si agotas los tokens incluidos en tu plan Pro o Lifetime, puedes comprar un
paquete adicional de 5.000.000 de tokens de forma puntual.

**Sobre el plan Lifetime:** es un pago único que te da acceso a todo lo de Pro de forma indefinida,
más 3.000.000 tokens de IA de regalo al comprarlo. El checkout está disponible tanto en **Ajustes →
Cuenta → Planes** dentro de la propia app como en [fromly.app/pricing.html](https://fromly.app/pricing.html).

### Prueba gratuita

El acceso de prueba a las funcionalidades Pro se activa por invitación (un enlace que recibes por
email) o mediante un checkout con periodo de prueba configurado específicamente para ti — no hay un
botón de autoservicio "empieza tu prueba gratis" en la pantalla de precios de la app. Si has
recibido una invitación de prueba, la barra superior te mostrará un badge con los días restantes
mientras dure.

### Gestionar tu suscripción

Gestiona tu plan en **Ajustes → Cuenta → Suscripción** o en
[app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Tras completar el pago, tu
plan se actualiza automáticamente en la app en cuestión de segundos — no hace falta recargar ni
cerrar sesión.

Si tienes código de beta o cupón, introdúcelo en el checkout al comprar. Los cupones del 100%
activan el plan igual que un pago normal.

---

## 17. Canal de Telegram — @FromMagicBot

Suscríbete al canal oficial de Fromly en Telegram para recibir tips semanales sobre cómo sacar el
máximo partido a la app: flujos de trabajo, casos de uso con la IA y novedades.

**Cómo unirte:** busca **@FromMagicBot** en Telegram o accede desde el enlace en fromly.app.

Los tips se envían de forma automática sin necesidad de interacción. Es un canal de difusión, ideal
para aprender Fromly de forma gradual sin saturar tu bandeja de entrada.

---

## Preguntas frecuentes

**¿Puedo usar Fromly sin conexión?**
Sí. La app Mac e iPhone funciona sin conexión. Los cambios se sincronizan automáticamente cuando
recuperas la conexión.

**¿Qué pasa si supero los 1.000 nodos en el plan gratuito?**
Puedes seguir leyendo tus notas, pero no crear nuevas hasta que elimines contenido o actualices a
Pro.

**¿Dónde se guardan mis datos?**
En los servidores de Fromly (Europa) y, en Mac, también en un backup local en tu propio ordenador.
Puedes exportar todo en JSON o Markdown desde Ajustes en cualquier momento.

**¿La IA lee todas mis notas?**
No, salvo que se lo pidas explícitamente ("busca en mis notas..."). Por defecto, la IA solo accede
al contenido de la conversación activa: lo que has escrito o adjuntado ahí y los contextos que
tengas activos.

**¿Puedo importar mis notas de Obsidian, Notion u otras apps?**
Sí. Ve a **Ajustes → Importar**. Fromly acepta exports de Obsidian, Notion, Apple Notes y carpetas
de Markdown en general.

**¿Puedo compartir una nota con alguien que no tiene Fromly?**
Sí, en el plan Pro. Desde el detalle de la nota, "Publicar" genera una URL pública del tipo
`fromly.app/p/...` con el contenido renderizado. Solo quienes tengan el enlace pueden verla.

**¿Cómo funciona la sincronización entre dispositivos?**
Los cambios se sincronizan en tiempo real por operaciones (op-log): solo viajan los cambios, no toda
la base de datos, y nunca se infiere un borrado. En condiciones normales, los cambios aparecen en
segundos en todos tus dispositivos.

**¿El backup automático consume cuota?**
No. Los snapshots automáticos son parte del servicio en todos los planes. El historial guarda los
últimos 12 snapshots.

**¿Cómo cancelo la suscripción?**
Desde **Ajustes → Cuenta → Suscripción** o en
[app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Tu acceso Pro se mantiene
hasta el final del periodo pagado.

**¿Puedo usar mis propias claves de API de IA?**
Sí, con licencia perpetua (Lifetime). Ve a **Ajustes → IA** y añade tus claves de Anthropic, OpenAI
o Google. El consumo irá a tu cuenta y no descuenta de los tokens de Fromly.

**¿Qué pasa si se me acaban los tokens de IA del mes?**
Puedes comprar una recarga puntual de 5.000.000 tokens adicionales desde Ajustes → IA, o esperar a
que se renueven con tu siguiente ciclo de facturación.

---

## Apéndice: la vista clásica (Fromly 1.0)

Antes de julio de 2026, Fromly abría en un árbol de bullets con un lienzo infinito como pantalla
principal: slash menu (`/`) para crear tipos de nodo, sidebar con paneles y contextos, un panel
lateral de cuatro modos (asistente, filtro, planificador, contexto) y atajos de teclado propios
para navegar el árbol (indentar con Tab, colapsar nodos, arrastrar con un handle, etc.).

Ese modelo de datos — nodos, tareas, contextos, recursos — es el mismo que usa Fromly 2.0 por
debajo. Si prefieres trabajar así, la vista clásica sigue activa en
[fromly.app/v1](https://fromly.app/v1) con su propia interfaz de árbol y lienzo. No es la puerta de
entrada por defecto ni la que documenta el resto de este manual.

---

*fromly.app — Tu segundo cerebro. Que te entiende.*
