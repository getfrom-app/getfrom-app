# Fromly — Manual de usuario

> Web · Mac · iPhone · fromly.app · Última actualización: 25 agosto 2026 (Web v9.6.984)

---

## Fromly 2.0 — lo que ves al entrar hoy

Desde julio de 2026, **Fromly abre en el chat** (Fromly 2.0). Este manual documenta esa
experiencia, que es la única disponible en web, Mac e iPhone.

Al entrar en Fromly tienes **tres columnas**:

- **Izquierda — Agenda / Chat / Elementos, y tus Contextos**: arriba del todo, tres accesos
  generales que no dependen de ningún contexto — **Agenda** (destino por defecto al abrir la app: el
  Planificador semanal en el centro, con el día elegido siempre en el centro de 3 columnas, y a la
  derecha lo que ese calendario no cubre —atrasadas y sin fecha— con la nota diaria de hoy embebida
  debajo; ya no existe un destino "Día" aparte, se fusionó aquí), **Chat** (empezar una conversación
  nueva sin contexto) y **Elementos** (buscador de todo tu contenido). Debajo, tus Áreas (siempre activas, p. ej. "Trabajo", "Personal") y
  Proyectos (subcontextos que se abren y se cierran), en jerarquía. Clic en cualquiera de los dos
  —destino general o contexto— para cambiar lo que ves en el centro y la derecha.
- **Centro — el chat, o lo que tengas abierto**: tu forma principal de trabajar. Escribe lo que
  necesites en lenguaje natural — «recuérdame llamar a Ana el lunes», «resume mi día», «busca en
  mis notas sobre X» — y la IA crea tareas, notas y eventos, les pone fecha, los clasifica en su
  contexto, o te responde con lo que ya guardas. Arrastra un PDF, una imagen o un archivo
  directamente al chat para incorporarlo a la conversación. Si abres una nota, tarea o el
  Planificador, ocupan este mismo espacio central.
- **Derecha — cambia según lo que elijas a la izquierda**: normalmente 1 o 2 pestañas — la del
  destino/contexto activo (p. ej. la Ficha de un contexto, el buscador de Elementos, o el timeline
  del día) y, en cuanto abres algo concreto, una pestaña **Chat** con la conversación de ESE elemento
  (siempre la misma, la retomes cuando la retomes). Al abrir una tarea o nota que pertenece a un
  contexto, las tres columnas se van con ella: el contexto queda seleccionado a la izquierda y su
  Ficha pasa a la derecha.

**Archivos y RAG.** Cuando subes un archivo, Fromly lo indexa: puedes preguntarle sobre su
contenido en cualquier momento, no solo justo después de subirlo. Los PDF se abren con visor real
(subrayado de texto + recorte de región como imagen).

**Primera vez.** Un tour guiado de 6 pasos aparece automáticamente la primera vez que entras,
explicando estas mismas piezas. Puedes saltarlo o revisarlo de nuevo borrando el localStorage del
navegador si algún día quieres repasarlo.

---

## Novedades (agosto 2026)

- **Publicar un contexto entero**: además de compartir grupos, ahora puedes generar un enlace
  público con TODO el contenido de un contexto (nota + elementos + los grupos que tenga dentro,
  ver sección 4). Mismas opciones que un Grupo — nombre personalizado, contraseña opcional,
  contenido siempre en vivo.
- **Elementos, rediseñado**: el buscador y la lista viven ahora en el espacio central, mucho más
  ancho — con vista de **Tabla** por defecto (antes Lista) y **Kanban** siempre disponible, no solo
  filtrando tareas. Clic derecho sobre cualquier fila (en cualquier vista) abre el menú con
  renombrar, mover, añadir a grupo y eliminar. Un icono de **carpeta** en cada elemento (al pasar
  el ratón, o en su propia ficha) lo añade a un grupo existente o crea uno nuevo al momento.
- **Agentes con acceso a internet real y fiable**: cualquier agente puede buscar y leer la web por
  su cuenta — ya no se queda atascado en el primer aviso de cookies o bloqueo que encuentra, lo
  detecta y lo descarta, reintentando con otra vía antes de rendirse. Las cotizaciones de mercados
  (acciones, índices, cripto, divisas) usan ahora una fuente de datos directa, mucho más fiable que
  leer una web de noticias financieras.
- **Notificaciones con la pestaña cerrada (web)**: activa el aviso desde el menú de tu nombre →
  «Avisarme aunque tenga la pestaña cerrada». Antes, si un agente terminaba con la web cerrada, no
  te enterabas hasta volver a abrirla.
- **Tema Solar**: junto a Claro/Oscuro/Sistema, un cuarto modo que sigue la luz del día — claro de
  día, oscuro de noche, con la hora de tu propio dispositivo, sin pedir tu ubicación. Disponible en
  web y en iPhone/iPad.
- **Widgets para la pantalla de inicio (iPhone/iPad)**: tareas y eventos de hoy, tu nota diaria, y
  accesos rápidos — mantén pulsado un hueco vacío de la pantalla de inicio y elige «Añadir widget».
- **Accesos rápidos del icono (iPhone/iPad)**: mantén pulsado el icono de Fromly para nueva tarea,
  nota de hoy, nota de voz o preguntar directamente.
- **Gestos de borde en el chat (iPhone)**: estira desde el borde derecho de la pantalla para ver las
  tareas de hoy, desde el izquierdo para tu nota diaria.
- **Salta a cualquier día**: desde tu nota diaria, un icono de calendario abre un selector para ir
  directo a cualquier fecha — verás la nota de ese día y un enlace a su agenda.
- **Barra de creación**: arriba de la columna izquierda, una fila de iconos crea directamente en el
  contexto que tengas activo — **Chat**, **Nota**, **Lienzo**, **Tarea**, **Grabar** y
  **Adjuntar**. Sustituye a los botones «Nueva conversación» y «Nuevo elemento».
  No hay botón de Evento porque no hace falta: una tarea con hora ya es un evento (aparece en el
  timeline del día y se sincroniza con Google Calendar).
- **Adjuntar**: un único sitio para meter cualquier cosa de fuera — arrastrar o elegir un archivo,
  pegar un enlace (Fromly lo guarda como recurso y le pone título solo) o importar desde Google
  Drive. Antes solo existía el botón de Drive.
- **Historial de conversaciones**: en el destino **Chat**, la columna derecha tiene dos pestañas —
  **Chat** (la conversación) e **Historial**. En Historial ves tus contextos con el número de
  conversaciones de cada uno; al pulsar uno se abre su lista de conversaciones. Debajo, las
  últimas conversaciones de todos, con buscador.
- **Tarjetas de contexto en el chat vacío**: cuando no hay conversación empezada, el chat muestra
  tus contextos en tarjetas, ordenados por uso reciente. Pulsar una abre sus conversaciones.
- **Perfil conversacional**: al abrir **Perfil** (menú de tu nombre, abajo a la izquierda), la nota
  del perfil ocupa el centro y a la derecha Fromly te hace una pregunta para ampliarlo. Escribe con
  naturalidad: Fromly lo adapta, lo añade al perfil y te dice exactamente qué ha guardado. De vez
  en cuando te propondrá él mismo ampliarlo — aparecerá como aviso en la barra izquierda.
- **Rediseño**: líneas más suaves, mejor acabado y **cero emojis** en toda la interfaz — cada tipo
  de elemento tiene ahora su icono propio, del mismo estilo en toda la app.
- **Clic en «Fromly»** (arriba a la izquierda) te lleva siempre al día de hoy. **Volver** desde un
  contexto, cuando ya estás en el primer nivel, hace lo mismo.

## Novedades (julio 2026, Fromly 2.0)

- **Crear ya no está en la cabecera del chat**: la barra de creación de la columna izquierda y el
  **"+"** de cada contexto crean siempre dentro del contexto correcto, sin depender de qué
  conversación tengas abierta.
- **Crear documento desde una selección**: selecciona cualquier texto dentro de una nota y usa el
  botón 📄 de la barra flotante de formato — el texto seleccionado se convierte en un documento
  nuevo (título tomado de la primera frase, mismo contexto que la nota de origen) y desaparece del
  original.
- **Agentes: empiezas de cero**: ninguna cuenta nueva recibe agentes de fábrica — el "Informe del
  día" (por la mañana) y "Repasa el día conmigo" (por la noche) son funciones propias del asistente,
  no agentes, y se configuran en Ajustes → Asistente. La sección Agentes queda vacía hasta que crees
  los tuyos.
- **Deshacer al eliminar**: al borrar cualquier nota, tarea o archivo (individual o en bloque desde
  Elementos), el aviso de confirmación incluye un botón "Deshacer" — nada desaparece sin que tengas
  unos segundos para recuperarlo antes de que pase a la papelera de forma silenciosa.
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
- **La pestaña Historial se fusionó con Elementos** (14 jul 26): era el mismo buscador con el
  filtro "conversación" implícito y sus elementos anidados debajo — y esos elementos ya se ven al
  abrir la conversación en sí. Filtra Elementos por "💬 Conversaciones" para el mismo resultado.
- **Agentes y Prompts, ahora en cualquier contexto**: puedes crear un Agente (una automatización que
  corre sola cada día en la nube) o un Prompt (una plantilla de instrucciones reutilizable)
  colgando de cualquier contexto o proyecto, igual que una nota o una tarea — pídeselo a la IA por
  chat ("quiero un informe diario de X") o créalo con el botón correspondiente. Empiezan
  desactivados hasta que revisas y activas el prompt tú mismo. Aparecen junto al resto de elementos
  del contexto, con su propio icono.
- **Prompts en el chat**: el botón "⚡ Prompt" junto al campo de escritura lista tus plantillas
  guardadas — seleccionar una la envía directamente, con sus variables ya rellenas.
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

Busca **Fromly: pizarra infinita** en el App Store o accede desde [fromly.app/ios](https://fromly.app/ios).
Instala la app e inicia sesión con la misma cuenta. Tus notas aparecen en segundos.

### El primer arranque: qué ves

La primera vez que entras aterrizas directamente en Agenda (tu día de hoy), con las tres columnas
descritas al principio de este manual (Agenda/Chat/Elementos + Contextos a la izquierda, el centro,
la columna derecha según lo que elijas). Un **tour guiado de 6 pasos** te va señalando cada pieza —
puedes saltarlo en cualquier momento.

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
- **Solo anotar**: cuando solo quieres dejar constancia rápida de algo, sin que el asistente
  conteste ni interprete nada, usa el botón de anotar rápido (el icono junto a Enviar) en vez de
  Enviar — el texto va tal cual a tu nota diaria y el chat responde solo "Anotado".

### Crear elementos — la barra de iconos de la columna izquierda

Crear una nota, tarea o lienzo no depende de tener una conversación abierta: se hace desde la
**barra de creación**, la fila de iconos que hay arriba de la columna izquierda. Todo se crea en el
contexto que tengas seleccionado en ese momento, o sin contexto si no hay ninguno activo.

- **Chat** — empieza una conversación nueva.
- **Nota** — documento de texto enriquecido.
- **Lienzo** — lienzo de dibujo.
- **Tarea** — tarea directa, sin pasar por el chat. Si le pones **hora**, se comporta como un
  evento: aparece en el timeline del día y se sincroniza con Google Calendar. Por eso no hay un
  botón de Evento aparte.
- **Grabar** — abre la grabadora de audio (ver «Nota de voz» en la sección de tipos de elemento).
- **Adjuntar** — abre una ventana con las tres formas de meter algo de fuera: arrastrar o elegir un
  archivo (PDF, imagen, audio, markdown…), pegar un enlace, o importar desde Google Drive (requiere
  Google conectado en Ajustes).

Además, el **"+"** que aparece al pasar el ratón sobre cualquier contexto de la lista crea
directamente dentro de ese contexto sin entrar en él, y abre un menú con las mismas opciones más
**Subcontexto** (un proyecto nuevo colgando de ese contexto). El **"+"** de la cabecera
«CONTEXTOS», también al pasar el ratón, crea un contexto en la raíz.

El **Planificador** (vista de calendario semana/mes/año) se abre desde **Agenda**, en la columna
izquierda — no desde el chat.

Junto al campo de escritura, en el propio composer, tienes además:

- **⚡ Prompt** — despliega tus plantillas guardadas; elegir una la envía directamente al chat, con
  sus variables ya resueltas.
- **🎙️ Dictado** — el icono de micrófono transcribe en vivo lo que dices mientras hablas (atajo
  **Alt+Espacio**). Es distinto del botón **Grabar** de la cabecera: el dictado escribe
  directamente en el chat, mientras que Grabar guarda una nota de voz aparte con su propia
  transcripción.

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

Clic en cualquier contexto de la columna izquierda para centrar la conversación en él — el centro
abre su Memoria y la columna derecha su Ficha (tareas y elementos de ese contexto). Elementos, en
cambio, es un buscador global: para verlo filtrado por un contexto concreto, elige ese contexto en
el propio filtro del buscador.

**Cada contexto tiene su propio chat**, independiente del chat general: la pestaña Chat de su Ficha
empieza vacía y solo guarda lo que hables ahí, sin mezclarse con ninguna otra conversación (lo mismo
pasa al abrir el chat de cualquier nota o tarea concreta — cada una tiene la suya).

**Seleccionar varios elementos y agruparlos**: dentro de la pestaña Elementos de un contexto (o en
la pantalla global de Elementos) puedes marcar varios y crear un **Grupo** con un solo enlace
público — ver sección 6, "Grupo".

**Publicar un contexto entero**: igual que un Grupo, puedes generar un enlace público
(`fromly.app/c/tu-usuario/nombre-del-contexto`) con TODO el contenido de un contexto — su nota
principal y todos sus elementos (incluidos los grupos que contenga, que se ven con su propio
apartado). Mismas opciones que un Grupo: nombre personalizado del enlace, contraseña opcional, y
contenido siempre en vivo — si añades o quitas algo del contexto, la página pública se actualiza al
instante sin volver a publicar. Se genera desde el mismo botón de compartir de la nota del contexto.

### Asignar un contexto

Cada nota o tarea tiene un único contexto, y puedes asignarlo de dos formas equivalentes:

- **`#` dentro del texto de cualquier nota o documento** (incluida tu nota diaria): escribe `#` y el
  nombre y aparece un desplegable con tus contextos existentes; elige uno para vincularlo de verdad
  a esa línea, o si no coincide con ninguno, pulsa Enter para crearlo nuevo en la raíz. No está
  disponible dentro del chat (un mensaje de chat no es un documento al que asignar contexto).
- **El chip de contexto** en la ficha de cualquier elemento: si no tiene contexto verás un
  indicador para asignarlo; si ya lo tiene, el chip muestra su nombre y te deja cambiarlo con un
  clic. El mismo chip te lleva directamente a ese contexto.

Cuando creas algo desde el chat en lenguaje natural, Fromly decide solo el contexto más apropiado
según lo que escribes — tú puedes corregirlo después con el chip en cualquier momento.

### Contexto padre

Puedes asignar o cambiar el contexto padre de cualquier contexto directamente desde la columna
derecha, para reorganizar tu jerarquía de Áreas y Proyectos sin perder nada.

### "Memoria" — el recuerdo de cada contexto

Cada contexto acumula su propia memoria: un documento vivo, "Memoria", que se actualiza solo a
medida que guardas cosas relevantes ahí. No hace falta contárselo aparte — Fromly decide si algo
es lo bastante significativo para recordarlo y cómo integrarlo (puede reescribir o fusionar la
información existente, no solo añadir al final). Se abre sola en el centro en cuanto eliges ese
contexto en la columna izquierda — con su propio chat en la pestaña Chat de la derecha, para
pedirle que la resuma, corrija o amplíe.

### Perfil — quién eres tú, no un contexto concreto

El Perfil es distinto de la Memoria de un contexto: es lo que Fromly sabe sobre ti en general, y
se usa en cualquier conversación sin importar el contexto activo (tu nombre, cómo prefieres que te
hable, datos personales estables). Se accede desde el menú de tu cuenta ("Perfil"). Igual que la
Memoria de contexto, se actualiza solo a medida que hablas con Fromly — pero también puedes abrirlo
y editarlo tú mismo como un documento normal en cualquier momento.

**Ampliarlo hablando.** Al abrir el Perfil, la nota ocupa el centro y en la columna derecha Fromly
te hace una pregunta para completarlo («¿Qué quieres añadir a tu perfil?», y variantes), con
sugerencias sacadas de los contextos en los que has estado trabajando. Escribe con naturalidad:
Fromly lo redacta para que encaje en el perfil, **lo añade solo** y te dice exactamente qué ha
guardado. Después repregunta una cosa concreta para afinarlo.

**Y él te lo propondrá de vez en cuando.** Cada cierto tiempo, si has ido metiendo cosas nuevas en
Fromly, verás un aviso en la columna izquierda («Fromly quiere saber más de ti») con una
conversación ya empezada y varias opciones de las que hablar — o escribe cualquier otra cosa. No
interrumpe nada: entras cuando quieras, o lo ignoras.

**Notificaciones.** Si tienes algo pendiente con hora y todavía no has decidido si activar los
avisos del navegador, verás el mismo tipo de aviso ofreciéndotelo — solo cuando de verdad hay un
recordatorio real en juego, nunca al azar nada más entrar. Sin ellas activadas, el brief, el
resumen de la tarde y los recordatorios siguen apareciendo en el chat al abrir Fromly; con ellas,
también te llegan aunque tengas la pestaña cerrada.

---

## 5. Navegación — Agenda, Chat, Elementos y tus Contextos

Arriba de tus Contextos, en la columna izquierda, tienes tres accesos generales que no dependen de
ningún contexto concreto: **Agenda**, **Chat** y **Elementos** (ya no existe un destino "Día" aparte,
se fusionó con Agenda). Clic en cualquiera de los tres, o en un contexto de más abajo, cambia lo que
ves en el centro y en la columna derecha.

### Agenda — el Planificador completo, con un asistente vivo al lado

Es el destino por defecto al abrir Fromly. El centro muestra el Planificador (semana de 3 columnas
con el día elegido siempre en el centro, mes o año — navegable, ver sección 7), sin nada más encima
— limpio. Mientras no tengas nada abierto, la columna derecha tiene, de arriba abajo: la **nota del
día** elegido (siempre visible, con scroll propio), la lista de **atrasadas y sin fecha** (lo que el
calendario no cubre, para poder arrastrarlas al Planificador) y, debajo, un **chat de verdad** —
el mismo asistente que en iPhone o Telegram: pregúntale, pídele que cree o modifique tareas, anótale
cosas. Además de responder lo que le escribas, va soltando avisos solo, sin que hagas nada: el
saludo del día, cuando completas una tarea de hoy o atrasada, y un recordatorio si un evento con hora
está a punto de empezar.

Abrir una tarea, evento o timeblock desde el Planificador la centra y **la columna derecha pasa a
acompañarla**: fecha/hora/recurrencia/prioridad editables, su contexto y grupo, los enlaces que
tenga en sus Notas, y qué otros elementos la mencionan — además de su propia pestaña **Chat** (ver
más abajo). Si esa tarea pertenece a un contexto, además queda seleccionado a la izquierda. La nota
del día en sí no tiene chat propio.

### Chat — empezar una conversación sin contexto

Abre un composer completo en la columna derecha, con el centro en blanco — lo que crees desde ahí
(una nota, una tarea, un documento) pasa al centro en cuanto la IA lo crea, y la conversación sigue
disponible en el mismo hilo, sin perder el rastro.

La columna derecha aquí es tu **historial de verdad**: una fila por cada conversación que tengas con
algún mensaje (una por contexto, más "General" si has hablado sin ninguno asignado), con un avance
del último mensaje, su contexto y la fecha — ordenadas por la más reciente. Un buscador arriba filtra
por texto o por contexto. Clic en una fila abre ESE hilo en el centro, tal cual lo dejaste — sin
saltar a la ficha del contexto ni perder dónde estabas en el resto de la app.

### Elementos — el buscador de todo lo que tienes guardado

Notas, tareas, eventos, archivos, lienzos, conversaciones, agentes y prompts (clic en una
conversación la retoma donde la dejaste; filtra por "💬 Conversaciones" para verlas solas). Filtra
por tipo y, debajo, por contexto. Kanban y Calendario solo aparecen al filtrar Tareas — para el
resto no hay estado ni fecha que organizar en un tablero. El icono ✓ junto al buscador activa la
**selección múltiple**: marca varios elementos y elimínalos de golpe. Las notas diarias no
aparecen aquí — se abren solo desde el Calendario o desde Agenda.

### Un contexto — Ficha + Chat

Al elegir un contexto en la barra lateral, su "Memoria" (qué sabe Fromly del tema) se abre
directamente en el centro, como cualquier documento — con más espacio para leer y editar. La
columna derecha tiene 2 pestañas: **Contexto** (su Ficha — tareas y elementos que cuelgan de él) y
**Chat** (la conversación de la Memoria, siempre la misma). Elegir OTRO contexto sustituye lo que
tengas abierto en el centro.

### La pestaña Chat, en cualquier sitio

En Elementos, en un contexto, o tras abrir cualquier nota/tarea/PDF/imagen desde donde sea, en
cuanto algo queda centrado aparece una pestaña **Chat** en la columna derecha — la conversación de
ESE elemento, independiente de dónde estuvieras navegando. Es SIEMPRE la misma conversación para
ese elemento, la retomes cuando la retomes — no una nueva cada vez que le hablas. Puedes pedirle
que resuma, convierta en tareas, mejore la redacción, o directamente que **edite el documento que
tienes delante** ("añade un párrafo sobre...", "quita la segunda sección") — lo hace sobre la
marcha, sin que tengas que copiar/pegar tú el resultado. Cerrar lo que tengas abierto hace que esa
pestaña desaparezca sola.

---

## 6. Tipos de elemento

Dentro de cada contexto puedes tener distintos tipos de elemento. Todos comparten el mismo chip de
contexto (siempre visible y editable) y quedan indexados para el chat y la búsqueda.

**Fecha y orden.** Cada elemento muestra su fecha (pasa el ratón por encima para ver creación y
última modificación completas). En Elementos, el icono junto al buscador cambia el
orden entre última modificación, fecha de creación o título.

### Tipos personalizados

Además de los tipos de elemento fijos de más abajo, puedes crear tus propios tipos — Libro, Persona,
Película, Receta, o cualquier otro que te haga falta. Desde **Elementos → bloque "Tipos" → "+"**:
ponle un nombre, elige un icono y define las propiedades que quieras, al estilo de una base de datos
de Notion — texto, número, selección única o múltiple, fecha, casilla, enlace y **calificación**
(estrellas de 1 a 5). Un elemento creado a partir de un tipo sigue siendo una nota normal (se edita
igual, se busca igual, se comparte igual): solo lleva encima una ficha con sus propiedades, editable
en el momento. Disponible en Mac, web y iPhone.

### Documento

Un documento es una nota de texto enriquecido — el mismo editor tipo Notion en cualquier sitio
donde escribas una nota larga: formato, favoritos, exportar y publicar con una URL pública. Créalo
con **📝 Nota** en el menú "+" de un contexto, o pídeselo a la IA ("apúntame esto en una nota").
Pegar prosa larga en una conversación también puede convertirse en documento.

**Crear documento desde una selección:** selecciona cualquier fragmento de texto dentro de un
documento y pulsa el botón 📄 de la barra flotante de formato — el texto seleccionado se mueve a un
documento nuevo (título = primera frase, mismo contexto que el original) y desaparece de la nota de
origen.

### Lienzo (Pizarra)

Un lienzo es un espacio de dibujo libre dentro de un contexto — distinto de un documento desde que
lo creas ("🎨 Lienzo" en el menú "+" de un contexto), no se convierte el uno en el otro después.
Útil para bocetar,
tomar notas a mano o organizar visualmente ideas.

**Herramientas básicas:** lápiz, formas (línea, flecha, rectángulo, elipse), texto libre, borrador
y selección — con paleta de colores y varios grosores de trazo. Lo que dibujas o escribes se
sincroniza entre tus dispositivos, incluido el iPad.

**Cada día es también su propio lienzo.** Dentro del Planificador y la Agenda, cada día tiene su
espacio en blanco donde puedes escribir o dibujar directamente sobre la jornada, además de sus
tareas y eventos.

### Tarea

Las tareas tienen un checkbox ☐/☑. Márcala como hecha para archivarla y actualizar su estado.

**Cómo crear una tarea:** con **☑️ Tarea** en el menú "+" de un contexto, o pidiéndoselo a la IA
en lenguaje natural ("recuérdame llamar a Ana el lunes"). Fromly interpreta la fecha, la prioridad
y el contexto directamente de lo que escribes.

**Propiedades de tarea (panel derecho):**

- **Estado**: Pendiente / En progreso / Hecho / Vencido.
- **Fecha de vencimiento**: escribe en lenguaje natural (`hoy`, `mañana`, `el próximo viernes`, `en
  3 días`, `15 junio`) y Fromly interpreta la fecha.
- **Prioridad**: alta, media o baja.
- **Repetición**: diaria, semanal, mensual o personalizada (cada N días/semanas/meses/años).

**Tareas sin fecha — seguimiento.** No hay un tipo aparte para "lo que tienes en curso": es
simplemente una tarea sin fecha. Permanece visible en la sección **"Sin fecha"** de Agenda → Planner
hasta que la marcas hecha o le pones fecha. Esa sección arranca colapsada con un contador, porque
suele haber muchas.

### Evento

Los eventos tienen hora de inicio y de fin. Aparecen en el Planificador, en la columna de su día
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
y buscable desde Elementos.

### Nota de voz (Grabadora)

El botón **Grabar** de la cabecera abre la grabadora de audio, pensada para una reunión o una nota
de voz larga:

1. Al pulsar **Grabar** empieza a grabar: ves un icono animado, un temporizador y, cuando el
   navegador lo soporta, la transcripción en vivo.
2. Al terminar, verás "Procesando…" mientras Whisper transcribe el audio completo.
3. El resultado queda como una nota con la transcripción, lista para que le pidas al chat que la
   resuma o extraiga tareas de ella.

**Dictar directamente en una nota**: distinto de la grabadora anterior (que crea una nota nueva),
cualquier nota que abras — incluida tu nota diaria — tiene un botón de micrófono en su barra de
formato. Lo dictado se transcribe directamente en el texto, en el punto donde tengas el cursor,
sin crear nada aparte.

### Conversaciones

Cada conversación que mantienes con el chat es en sí misma un elemento: aparece en Elementos con
su propio filtro (💬 Conversaciones), junto a notas, tareas y lienzos — clic para retomarla donde
la dejaste.

### Agente IA

Un agente es una automatización con instrucción propia, fuentes y horario propio, que cuelga de
cualquier contexto (no de una raíz única). Se crea pidiéndoselo a la IA por chat ("quiero un
informe diario de X") o con **+ Nuevo agente** en Elementos (filtra por 🤖 Agentes).

**Empiezan desactivados.** Tienes que revisar el prompt generado y activarlo tú mismo antes de que
corra. El resultado de cada ejecución es un documento real, colgado del contexto del agente.

**Agentes de ejemplo.** Toda cuenta trae 8 agentes predefinidos (📈 Informe de mercado, 📰 Resumen
de prensa, 🔎 Investigar un tema, 🧾 Resumen de un enlace, 🗓 Revisión semanal, 🌅 Diario, 🎯
Seguimiento de objetivos, 🧘 Check-in de bienestar) en Elementos → Agentes, también desactivados —
ábrelos para ver cómo están planteados antes de crear los tuyos propios.

**Horario (schedule):** al abrir la app, diario, semanal o manual (lo ejecutas tú cuando quieras
con el botón ▶).

**Aviso en iPhone/iPad:** cuando un agente programado termina de ejecutarse recibes una notificación
push en el momento, sin tener que dejar la app abierta ni comprobarlo manualmente.

**Aviso en web:** cuando pides por chat crear un agente (o un prompt), se abre solo, con el chat
siguiéndolo a la columna derecha. Si le pides otra cosa desde el chat de un elemento — un
documento, una nota, un recurso — no se abre solo: aparece como un enlace en el propio mensaje del
chat para que decidas tú cuándo verlo, así nunca pierdes de vista lo que ya tenías abierto. Cuando
un agente AUTÓNOMO termina de ejecutarse en el servidor, aparece un aviso "N informes de agente
nuevos" en la sidebar (igual que ya pasaba con los agentes conversacionales, que avisan con "N
conversaciones esperando" hasta que abres cada una).

**Prueba terminada — solo 1 agente activo a la vez.** Si activas un segundo agente sin ser Pro, el más
reciente se queda "Activo" en apariencia pero el servidor no lo ejecuta — el panel de Propiedades del
agente te avisa explícitamente cuando le pasa esto a uno de los tuyos.

**Casos de uso habituales:**

- Resumir el diario de hoy cada noche.
- Extraer tareas de una nota larga cuando la terminas.
- Buscar en internet sobre un tema y guardar el resumen como nota.

### Prompt

Un prompt es una plantilla de instrucciones reutilizable, con variables, que cuelga de cualquier
contexto igual que una nota o una tarea. Se crea pidiéndoselo a la IA, con **+ Nuevo prompt** en
Elementos (filtra por ⚡ Prompts), o desde el propio menú del composer del chat.

**Cómo se usa:** el botón **⚡ Prompt** junto al campo de escritura lista tus plantillas guardadas;
elegir una resuelve sus variables (fecha, contexto actual, etc.) y la envía directamente.

Útil para: "resume esto en 3 bullets", "extrae las tareas", "mejora el tono formal", un informe
diario con el mismo formato cada vez.

### Grupo

Un grupo reúne varios elementos ya existentes (notas, imágenes, PDFs, o una mezcla) para compartirlos
juntos con un solo enlace público. Selecciona 2 o más en **Elementos** (el buscador global, en web
también dentro de un contexto) y pulsa **Crear grupo**; ábrelo para renombrarlo, añadir o quitar
elementos, y generar/copiar su enlace público desde ahí — con share sheet nativo en iOS. El enlace
muestra siempre el contenido EN VIVO: si quitas o añades algo al grupo, la página pública se
actualiza al instante, sin tener que volver a publicar. Es buscable como cualquier otro elemento, y
se borra igual que el resto (a la papelera).

El enlace público puede personalizarse: en vez del código aleatorio de 8 caracteres, puedes escribir
un nombre propio (p. ej. `fromly.app/g/tu-usuario/diabeticos-alicante`) desde el campo "Nombre
personalizado del enlace" al publicar. Cada cuenta tiene su propio espacio de nombres, así que dos
personas pueden usar el mismo nombre de grupo sin chocar entre sí. Los enlaces ya compartidos con el
formato antiguo (sin nombre de usuario) siguen funcionando igual que siempre.

**Protege el enlace con una contraseña (opcional):** al publicar, escribe una contraseña en el campo
correspondiente — por defecto ningún enlace la lleva, tú decides ponerla o quitarla. Con ella puesta,
quien abra el enlace tiene que escribirla antes de ver el contenido; el navegador la recuerda durante
30 días, así no hace falta repetirla en cada visita. Puedes cambiarla o quitarla del todo en
cualquier momento sin perder el resto del enlace.

**El grupo aparece donde tiene sentido, no solo en un sitio:** un grupo en sí no pertenece a ningún
contexto (mezcla elementos de donde sea), pero en web aparece en la columna derecha de CADA contexto
al que pertenezcan sus elementos — un grupo con notas de "Autónomo" y de "Inversión" se ve en los dos
sitios a la vez. Además, cualquier elemento que forme parte de un grupo muestra al pasar el ratón por
encima un botón para abrir y editar ese grupo directamente, sin tener que buscarlo.

---

## 7. El Planificador

El Planificador es la vista de calendario completa de Fromly. Es lo que ves en el centro al entrar
en **Agenda** (destino por defecto) — la columna derecha, mientras tanto, muestra tus tareas
atrasadas y sin fecha (lo que el propio calendario no cubre) y, debajo, la nota diaria de hoy.

### Tres vistas: Semana · Mes · Año

- **Semana**: 3 días en columnas, con el día elegido siempre CENTRADO en pantalla y timeline
  horario. Arriba, una franja "todo el día" para las tareas con fecha pero sin hora. La columna de
  hoy se distingue con un fondo propio.
- **Mes**: la cuadrícula del mes, con las tareas y eventos de cada día.
- **Año**: los 12 meses en una grid. Los días con contenido llevan un punto; clic en cualquier día
  te lleva a él.

El timeline de UN día concreto, hora a hora, vive aquí mismo, en la vista Semana — ya no hay una
pestaña "Día" aparte.

**Tareas vs eventos de un vistazo:** las tareas se muestran sin fondo (borde fino con un toque de
color); los eventos (de Google o marcados como evento) llevan un sombreado tenue del color de su
contexto. La línea roja marca la hora actual y se mueve sola sin recargar la página.

### Asignar hora a una tarea

Arrastra cualquier tarea (desde Agenda → Planner, o desde Elementos) al timeline del Planificador
para darle hora — la tarea sigue en su contexto, solo gana un chip con la hora asignada. También
puedes hacer clic en una hora vacía para crear una tarea nueva directamente ahí.

### TimeBlocks — un espacio reservado que no es tarea ni evento

Para algo que necesitas bloquear en tu agenda pero que no es una tarea que marcar como hecha ni una
reunión a la que asistir obligatoriamente (por ejemplo, "estudiar" o "tiempo para escribir"), usa un
**TimeBlock**: botón derecho sobre un hueco vacío del Planificador (en el móvil, mantener pulsado).
Se ve con un rayado diagonal distinto al de una tarea o un evento, no lleva casilla de completar, y
no aparece en ninguna lista de tareas de Fromly — solo en el Planificador. Se sincroniza con Google
Calendar igual que cualquier otro bloque.

### "Lo próximo" — siempre a la vista

Una franja discreta (esquina inferior derecha en web, bajo la barra de pestañas en el móvil) te
recuerda siempre cuál es tu próximo compromiso con hora — tarea, evento o TimeBlock. Se pone en
rojo cuando falta menos de una hora, y parpadea cuando falta menos de un cuarto de hora (toca la
franja para que deje de parpadear). Puedes desactivarla en Ajustes → Apariencia si prefieres no
verla.

### Sincronización con Google Calendar al planificar

Si tienes Google Calendar conectado, el Planificador crea y actualiza eventos automáticamente:

- **Asignar hora** a una tarea → se crea un evento en Google Calendar.
- **Mover o redimensionar** el bloque → el evento de Google Calendar se actualiza al instante.
- **Quitar la hora** → el evento de Google Calendar se elimina.

Los eventos que ya existen en Google viven solo en Google (no se copian como notas en Fromly): se
muestran en el Planificador con su color original, y al hacer clic en uno
se abre su editor con un botón **"➕ Crear elemento en Fromly"** — solo se crea una nota si lo pulsas tú.

---

## 8. Google Calendar

### Conectar

Ve a **Ajustes → Integraciones → Google Calendar** y sigue el proceso de autorización. Solo
necesitas hacerlo una vez.

### Cómo funciona

- Tus eventos de Google Calendar aparecen en el Planificador con el color de cada calendario.
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
- Funciona con **TikTok, YouTube, Instagram, X y muchos más**. Si compartes un enlace sin texto
  (por ejemplo, "compartir esta página" desde Safari), se guarda tal cual.
- Si compartes **texto suelto** (seleccionado de cualquier app, sin archivo), Fromly lo interpreta
  igual que si lo hubieras escrito en el chat: si dice algo como una tarea, la crea; si no, lo
  anota sin más. Al volver a la app verás el intercambio real en tu chat, no solo un aviso de
  "guardado".
- **La primera vez**, activa Fromly en la hoja de compartir: desliza la fila de apps hasta el
  final → **Más / Editar** → activa **Fromly**.
- La transcripción usa tus **tokens de IA** (plan de pago).

---

## 10. Fromly para iPhone

La app de iPhone está disponible en el App Store con la misma cuenta que web y Mac. Todo lo que
capturas en iPhone aparece sincronizado en tiempo real en el resto de tus dispositivos, y viceversa.

Lo que puedes dar por seguro hoy en iPhone:

- **Notas, tareas y eventos**: crearlos, editarlos, marcarlos como hechos, asignarles fecha. Al
  crear cualquier elemento (desde el botón "+", la captura rápida o grabando una nota de voz) se
  abre automáticamente para que veas dónde ha quedado.
- **Sincronización en tiempo real** con la misma cuenta que web y Mac, viajando solo los cambios
  (deltas), no la base de datos completa.
- **Compartir a Fromly** desde otras apps (ver sección anterior) — y también al revés: comparte
  cualquier PDF, imagen o nota (como Markdown o PDF) desde Fromly hacia cualquier otra app con el
  botón de compartir nativo de iPhone.
- **Google Calendar**, si lo tienes conectado.
- **Contextos con pestañas**: al abrir un contexto en iPhone, tienes tres pestañas — Contexto (su
  nota propia, con la misma barra de formato que cualquier nota), Elementos (notas y documentos, sin
  tareas) y Tareas.

La app de iPhone está en un proceso de paridad progresiva con la interfaz de chat de la web y Mac:
si buscas específicamente la experiencia de tres columnas (Agenda/Chat/Elementos + Contextos,
centro, columna derecha) descrita al principio de este manual, confirma en la propia app qué parte
ya está disponible en tu versión antes de asumir que coincide al cien por cien con la web.

---

## 11. Conexión con Claude (MCP)

Fromly se conecta con Claude como **conector personalizado** (MCP con OAuth) — sin depender de
que Anthropic lo publique en ningún directorio. Una vez conectado, Claude puede buscar, crear,
editar, **borrar y mover** tus notas y tareas, subir archivos reales y hacer limpiezas por lotes —
sin que tengas que pedirlo cada vez.

### Cómo conectar — conector personalizado (recomendado)

Se configura una vez en claude.ai o Claude Desktop, y queda disponible también en iPhone y Android
con la misma cuenta.

1. Abre Claude (claude.ai o Claude Desktop).
2. Ve a **Ajustes → Conectores → Añadir conector personalizado**.
3. Pega esta URL: `https://from-server-production.up.railway.app/mcp`
4. Se abre una ventana para iniciar sesión con tu cuenta de Fromly mediante OAuth.
5. Listo — Claude puede guardar notas y tareas en tu vault desde ese momento.

No necesitas instalar extensiones ni copiar tokens.

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
anterior). Vive 1 año. Para Claude en web y Desktop no necesitas el token — añade Fromly como
conector personalizado (ver sección 11).

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
cuando la prueba ha terminado.

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
  facturación» (portal de cliente). Con la prueba terminada solo verás «Mejorar».
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
| **Prueba** | €0 · 15 días | **Fromly entero**, sin funciones bloqueadas: asistente por chat sin límite, agentes, elementos ilimitados, archivos adjuntos, publicar notas, Mac + iPhone + web. Sin tarjeta. Lo único que no incluye es usar tu propia clave de IA (BYOK), que requiere plan de pago. |
| **Prueba terminada** | €0 | Tus datos siguen ahí y puedes seguir leyéndolos, con la sincronización limitada a 1.000 elementos. Lo que se apaga es el asistente: chat, agentes, aviso de la mañana y adjuntos. |
| **Pro Mensual** | €7/mes | Todo lo de la prueba, sin que caduque: elementos ilimitados + IA completa (Claude) + Agentes + Prompts + vistas tabla/kanban/calendario + archivos adjuntos + publicar notas con URL + soporte prioritario + 2.000.000 tokens de IA al mes incluidos + opción de usar tu propia clave de Claude/GPT/Gemini. |
| **Pro Anual** | €49/año (~€4,08/mes) | Todo lo de Pro Mensual, facturado anualmente. Ahorras cerca de un **42%** frente al mensual (7×12 = 84€ → 49€). |
| **Lifetime** | €149 pago único | Todo lo de Pro, para siempre, sin suscripciones, + 3.000.000 tokens de IA incluidos de una vez. |

**Usa tu propia clave de IA (BYOK):** en **Ajustes → IA**, cualquier plan de pago (Pro Mensual, Pro
Anual o Lifetime) puede guardar su propia clave de Anthropic (Claude), OpenAI (GPT) o Google
(Gemini). Si la guardas, Fromly la usa de verdad en tus conversaciones y ejecuciones de agentes —
esas llamadas las pagas tú directamente al proveedor y no consumen tus tokens incluidos de Fromly.
No es lo mismo que una suscripción de consumo (ChatGPT Plus, Claude Pro/Max): hace falta una clave de
API (facturación por uso, en la consola de cada proveedor), no las credenciales de tu app de chat.

**Recarga de tokens:** si agotas los tokens incluidos en tu plan Pro o Lifetime, puedes comprar un
paquete adicional de 5.000.000 de tokens de forma puntual.

**Enlace directo desde la sidebar:** con la prueba terminada, junto al aviso de plan en la esquina inferior
izquierda, un enlace "Pasar a Pro" lleva directo a esta comparativa sin esperar a chocar con un límite.

**Sobre el plan Lifetime:** es un pago único que te da acceso a todo lo de Pro de forma indefinida,
más 3.000.000 tokens de IA de regalo al comprarlo. El checkout está disponible tanto en **Ajustes →
Cuenta → Planes** dentro de la propia app como en [fromly.app/pricing.html](https://fromly.app/pricing.html).

### La prueba de 15 días

Toda cuenta nueva empieza con **15 días de Fromly entero**, asistente incluido y sin tarjeta. No
hay funciones bloqueadas durante ese tiempo: se prueba lo mismo que se compra.

Al terminar, **no se borra nada**. Sigues entrando y leyendo todo lo tuyo, con la sincronización
limitada a 1.000 elementos; lo que se apaga es el asistente (chat, agentes, mensaje de la mañana y
adjuntos). Activar Pro en cualquier momento lo devuelve todo tal y como estaba.

Si la prueba se te pasó sin haber podido probarlo en condiciones, recibirás por correo la opción de
**un mes más**, gratis y sin tarjeta. Se canjea con un clic desde ese correo y solo se puede una vez
por cuenta.

**Correos:** te escribimos en el idioma en el que usas la app, y todos llevan al pie un enlace para
darte de baja. La baja solo afecta a los correos de consejos y novedades: los de contraseña, compra
o cancelación se envían igual, porque son de servicio.

Si tienes un cupón o un código de beta, se introduce en el checkout: activa el plan igual que un
pago normal, sin fecha de caducidad distinta a la del propio plan.

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

**¿Qué pasa si supero los 1.000 elementos con la prueba terminada?**
Puedes seguir leyendo tus notas, pero no crear nuevas hasta que elimines contenido o actualices a
Pro. Durante los 15 días de prueba no hay ningún tope. Chatear con Fromly dentro de una conversación ya empezada no cuenta contra este límite — solo
cuenta 1 elemento por conversación, no cada mensaje.

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
`fromly.app/p/...` con el contenido renderizado. Solo quienes tengan el enlace pueden verla — y si
quieres una capa extra, puedes ponerle contraseña opcional desde el mismo menú de publicar.

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

*fromly.app — Tu segundo cerebro. Que te entiende.*
