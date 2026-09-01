# Fromly — Documentación completa

> Documento vivo. Actualizado en cada sesión de desarrollo.
> Última actualización: 2026-09-01 (server, sin cambios de web esta sesión)

---

## Sesión 2026-09-01 (sesión 23) — el repaso nocturno podía perder una respuesta sin guardarla

Server `1fe7ef6`, sin cambios de web. Detalle completo en
`logs/2026-09-01-sesion23-repaso-nocturno-perdia-respuestas.md`.

- Bug reportado en vivo: contestar al repaso nocturno y que no quedara anotado en la nota diaria. Causa:
  el mensaje del usuario solo se guardaba DESPUÉS de que la llamada a IA terminara bien — un fallo a
  mitad de turno lo perdía sin que ni el cierre automático por inactividad pudiera rescatarlo.
- Fix: el mensaje se persiste inmediatamente al recibirlo; la carga de contexto (`dayStateText`,
  `loadUserKnowledge`) deja de usar un `Promise.all` sin red de seguridad.
- `bun test` 405/405.

---

## Sesión 2026-09-01 (sesión 22) — el chat distingue evento de tarea + prioriza novedades de vida sobre tareas

Server `84d14f7` → `ae178b1`, sin cambios de web. Detalle completo en
`logs/2026-09-01-sesion22-evento-vs-tarea-novedades-de-vida.md`.

- **Bug real (captura)**: el repaso nocturno llamó "tarea" a una cita con el notario (evento con hora) y
  dijo "te dejo la tarea... como hecha" al cerrarla. `isEvent` ahora llega a los bloques de texto que lee
  el modelo (`AgendaEntry`, `BriefItem` vía `labelForModel()`, separada de `label()` para que la marca
  nunca llegue al texto del usuario) — sin tocar el invariante "tarea y evento son la misma fila de
  datos" de `FROM.md`, esto es solo lenguaje. Bug de segunda vuelta encontrado probando en vivo: el
  modelo copiaba "(evento)" dentro del título al crear una cita — corregido.
- **A petición explícita**: el repaso nocturno preguntaba por tareas de trabajo en vez de por novedades
  de vida (una mudanza, una compra de casa) que el usuario había contado el día anterior — el hecho
  estaba guardado pero enterrado sin fecha entre hasta 60 líneas planas. `loadRecentPills()` nueva
  (últimos 2 días, mismo sistema de píldoras) — el repaso nocturno las antepone y el prompt prioriza
  preguntar por ahí antes que por tareas sueltas.
- Verificado en vivo (API, cuenta de prueba); `bun test` 405/405.

---

## Sesión 2026-09-01 (sesión 21) — Fromly obedece instrucciones de tono + Ajustes → Cómo quiero que me hable

Server `14d1e34`, web `dcb8c75b` (v9.10.31 → v9.10.32). Detalle completo en
`logs/2026-09-01-sesion21-tono-de-fromly-ajustes-y-chat.md`.

- **Bug encontrado probando en vivo**: "sé más breve"/"sé más directo" se perdían en silencio (el chat
  contestaba bien pero no lo recordaba); "sé más entretenido" a veces sí funcionaba — azar del modelo.
  `missedStandingInstruction` (sesión 20) gana un segundo patrón para órdenes de tono DIRECTAS sin
  ninguna frase de permanencia, más una red de seguridad: si el reintento sigue sin guardar, se guarda
  el mensaje del usuario tal cual en vez de perderlo del todo.
- **Nuevo, a petición explícita**: Ajustes → "Cómo quiero que me hable Fromly" — 6 chips de tono (Muy
  breve/Detallado/Directo/Cercano/Desenfadado/Formal, toggle) + texto libre. Cada chip es una píldora de
  conocimiento normal (mismo sistema de la sesión 19) con una clave para que la UI sepa qué está
  encendido sin adivinar comparando texto — lo dicho por chat sigue entrando por la misma vía de siempre,
  sin clave. `GET/PUT /assistant/tone` nuevos; reutiliza el componente de chip ya existente en el
  frontend, sin CSS nuevo.
- Verificado en vivo (API + UI real, cuenta de prueba): chips y texto libre persistiendo correctamente;
  `bun test` 403/403.

---

## Sesión 2026-09-01 (sesión 20) — check-in de tareas más elegante, instrucciones permanentes que se perdían

Server `8ddd9f9`→`359c08e`, sin cambios de web. Detalle completo en
`logs/2026-09-01-sesion20-checkin-elegante-instrucciones-permanentes.md`.

- **Auditoría previa**: el check-in de tareas estancadas (preguntar si una tarea atascada sigue vigente)
  ya existía desde el 12 ago — se confirmó antes de tocar nada, para no duplicarlo.
- **Check-in menos repetitivo**: si el usuario ignoraba la pregunta, el siguiente check-in volvía a
  preguntar por la MISMA tarea. Ahora salta a otra estancada distinta si la hay, y si es la única lo
  reconoce en el mensaje en vez de fingir que es la primera vez. Menciona el contexto de la tarea cuando
  lo tiene. Las plantillas de "organizar tareas sueltas" ganan variedad (antes eran fijas).
- **Instrucciones permanentes que se perdían en silencio**: "a partir de ahora sé siempre muy breve" →
  el modelo contestaba "entendido" sin guardar nada, sin ninguna mentira que la red de seguridad
  existente pudiera detectar. `missedStandingInstruction()` (misma familia y mecanismo de reintento que
  `isFalseConfirmation`) cierra ese hueco.
- Verificado en vivo vía API con la cuenta de prueba real; `bun test` 401/401.

---

## Sesión 2026-09-01 (sesión 19) — memoria del usuario en píldoras, un único escritor, mención "#" de contextos en el chat

Web **v9.10.28 → v9.10.30**, server `d4625dd`→`4bcb7d7`. Detalle completo en
`logs/2026-09-01-sesion19-memoria-en-pildoras-mencion-contextos.md`.

- **Historial de chats**: cada fila de `V2ThreadHistory.tsx` (columna derecha del destino Chat) gana una
  flecha que despliega, en la misma columna, la conversación completa del hilo — antes solo se veía la
  primera línea, truncada a 140 caracteres.
- **El caso que disparó el rediseño**: el chat dijo "lo guardo bajo el nodo La Isla del Trading" sin que
  apareciera nada ahí (sí en el Perfil) — `remember` solo sabe escribir en el perfil global, la frase la
  inventaba el modelo sin ningún cruce contra la acción real. Regla nueva en el prompt prohibiendo esa
  confirmación, y `remember` añadido como acción de respaldo válida en `isFalseConfirmation`.
- **Rediseño de fondo, a petición explícita** ("sistema único y centralizado... que no aprenda
  información por tres sitios distintos y los guarde en cuatro sitios"): auditoría confirmó DOS
  escritores completos del mismo formato (servidor `assistantMemory.ts` + cliente `userKnowledge.ts`,
  mantenidos a mano en paralelo, mismo riesgo de carrera de un incidente real anterior) y un hueco real
  (`DocEditor.tsx`, la superficie principal de escritura hoy, sin ningún gancho de aprendizaje).
- Lo aprendido pasa de líneas de texto dentro de un documento a **píldoras**: nodos reales
  (`🧠 Conocimiento` como contenedor, `_knowledgeFact` por hecho, `source` + `createdAt` real). **Único
  escritor, en servidor** (`rememberFacts`) — el cliente deja de escribir del todo, solo lee para pintar
  la nueva **columna de píldoras en el Perfil** (`V2KnowledgePills.tsx`, mismo patrón que el Historial).
  Gancho de extracción nuevo en documentos (cerraba el hueco real). Reconciliación en segundo plano
  (`maybeReconcilePills`, cada 6h con 6+ píldoras activas) que archiva duplicados/contradicciones con
  alta confianza y, en los casos dudosos, deja una PREGUNTA pendiente que el disparador de "Fromly
  quiere saber más de ti" prioriza en vez de decidir sola.
- **Mención "#" de contextos en el chat** (`V2Chat.tsx`): mismo patrón que la mención "@" ya existente —
  al elegir un contexto inserta su título, que la búsqueda por palabras del servidor ya encuentra sola.
  Bug real encontrado probando en vivo: con títulos de más de una palabra, el "#" rompía el renderizado
  de etiquetas al crear una tarea desde ese mensaje — se omite el símbolo en esos casos.
- Verificado en vivo (cuenta de prueba real, vía API directa y por UI): píldoras creadas/archivadas
  correctamente, sin duplicados ni basura de intentos fallidos; mención "#" funcional; columna de
  píldoras ordena y expande bien; documento editado genera píldora nueva. Datos de prueba limpiados al
  terminar.

---

## Sesión 2026-09-01 (sesión 17) — fix del bug flageado en la sesión 15: "Ver y editar"/"Ver" de Ajustes → Memoria no abrían nada

Web **v9.10.26 → v9.10.27**. Detalle completo en
`logs/2026-09-01-sesion17-fix-ver-y-editar-memoria.md`.

- `SettingsView.tsx` (`MagicPane`): "Ver y editar" (Perfil) y "Ver" (conocimiento por contexto) usaban
  `navigate('/node/:id')` — ruta de v1 que dentro del shell v2 cambia la URL sin abrir ningún overlay
  visible. Sustituido por el evento `from:open-detail` que `V2App.tsx` ya escucha globalmente. Bug
  preexistente encontrado y flageado aparte durante la sesión 15, resuelto ahora tal cual se dejó
  anotado. Verificado en vivo: ambos botones abren el nodo correcto.

---

## Sesión 2026-08-31 (sesión 16) — timeblocks sin checkbox + columna derecha de Agenda a tercios

Web **v9.10.24 → v9.10.26**. Detalle completo en `logs/2026-08-31-sesion16-tercios-timeblocks.md`.

- **Timeblocks**: un timeblock (`isTimeBlockNode`, arrastrado sobre el grid del Planificador) ya no
  pinta checkbox — la condición `checkable` de `PlannerPanel.tsx` solo excluía eventos (`isEvent`), no
  timeblocks.
- **Columna derecha de Agenda**: `V2RightColumn.tsx`/`v2.css` pasan de `flex` a `grid` con
  `grid-template-rows` animado — nota del día, cockpit (atrasadas/sin fecha) y chat reparten el alto a
  tercios iguales cuando la nota está abierta, en vez del reparto desigual anterior donde el chat se
  quedaba con muy poco sitio (Alberto: "la columna derecha queda muy amontonada... primer tercio nota,
  segundo tareas, tercero chat").

---

## Sesión 2026-08-31 (sesión 15) — planner en vivo, chat de Agenda con recordatorios reales, memoria del perfil unificada

Web **v9.10.20 → v9.10.24**. Detalle completo en
`logs/2026-08-31-sesion15-planner-vivo-memoria-unificada.md`.

- **Planner**: línea de "ahora" congelada desde el montaje → tick por minuto sincronizado al reloj real
  (`PlannerPanel.tsx`; el primer intento se aplicó por error a `CalendarPlanner.tsx`, código huérfano
  nunca importado — revertido). Eventos (gcal crudo o nodo `isEvent`) llevan ahora un sombreado tenue
  del color de su CONTEXTO en vez de relleno pastel del color crudo de Google; las tareas se quedan sin
  relleno (borde + barra de acento), diferenciándose de un vistazo.
- **Bug de arquitectura real, fix de raíz**: `assistantCron.ts` (brief/evening/reminders/checkin) solo
  procesaba usuarios con push o Telegram registrado — pero `notifyUser()` siempre escribe en
  `assistant_messages` (lo que sirve el chat vía `GET /assistant/inbox`) ANTES de intentar cualquier
  canal, así que sin push esa proactividad NUNCA se generaba, ni siquiera para verla en el propio chat.
  Ahora procesa a cualquier usuario con fila de `assistantPrefs` (se crea sola al primer uso),
  independiente del canal de notificación.
- **Chat**: recordatorios con `kind`/`dueAt` de extremo a extremo (color propio, desaparecen del hilo
  activo ~20 min tras su hora); saludo/check-in de tarde pasan de comprobar la hora solo al montar el
  componente a revisarla cada minuto; fix de un bug donde un disparador interno
  (`askProfileQuestion`) podía disparar la red de seguridad `isFalseConfirmation` y mostrar "No he
  podido guardarlo bien" sin ningún mensaje de usuario delante (`internalTrigger` ahora viaja hasta el
  servidor). Acciones de chat nuevas sobre tareas existentes: renombrar, reasignar contexto, posponer a
  fecha exacta.
- **Memoria del perfil, unificada de verdad**: "lo aprendido" vivía en CUATRO sitios distintos bajo el
  mismo nodo Perfil de IA (tres formatos de hijos + el `body` que de verdad leen iOS/Telegram/chat
  real) — solo convergían de forma perezosa al abrir la pantalla de Perfil, mientras los escritores de
  hijos seguían creando hijos nuevos. Unificado en un único escritor (`rememberFactsLocal` en el
  cliente, mismo formato/lógica que `rememberFacts` del servidor) que escribe directo en `body`.
  Retirados 7 funciones/endpoint ya sin llamadores. Tope duro nuevo (200 líneas, antes ninguno) y
  compactación semántica en segundo plano (funde duplicados dichos con otras palabras, nunca bloquea
  el turno del usuario).
- **Aviso de notificaciones push**: se ofrece en la sidebar (mismo patrón que el aviso de perfil) solo
  cuando el permiso sigue sin decidir Y hay algo pendiente con hora en el futuro.

---

## Sesión 2026-08-30 (sesión 12) — Agenda como asistente vivo, historial de chats real, dos fixes de producción

Web **v9.10.13 → v9.10.15**. Detalle completo en `logs/2026-08-30-sesion12-agenda-viva-y-fix-502.md`
y los invariantes nuevos en `FROM.md` ("30 ago 2026 (sesión 12)").

- **Cola de 6 bugs** reportados en vivo, misma jornada que la sesión 11 (continuación directa):
  columna derecha desaparecía al abrir una nota con contenido largo (`min-width:0` faltante en el
  grid), menú de botón derecho en favoritos, página de enlace rediseñada (quitado un selector "Tipo"
  duplicado), saludo de Agenda en párrafos + eventos de hoy ya pasados dejan de contar como
  pendientes, bandeja de revisión ya permitía asignar contexto sin abrir el elemento (sin cambios),
  `DocEditor` se tragaba el párrafo explicativo de debajo de una casilla en su `text`.
- **Historial de chats real**: se descubrió que el historial de conversaciones (`_aiSession`/
  `aiChatStore`) estaba desconectado del chat real desde la migración a `assistantStore` — abrir una
  conversación mostraba una nota vacía. Rediseñado sobre hilos reales: `GET /assistant/threads`
  (servidor) + `V2ThreadHistory.tsx` (web), un hilo por contexto con mensajes de verdad, más
  recientes primero. `V2ContextBrowser.tsx`/`v2/conversations.ts` eliminados.
- **Agenda como asistente vivo**: `V2AgendaAssistant.tsx` sustituye al brief estático — el chat REAL
  embebido (mismo motor que iOS/Telegram), que avisa solo al completar una tarea o cuando un evento
  está a punto de empezar. Maquetado antes con el skill `design`, aprobado por Alberto.
- **Dos fixes reales en producción**: 502 en `/assistant/chat` por una carrera al crear el diario de
  hoy con id determinista (fix: `onConflictDoNothing` sobre la PK compuesta real de `sync_nodes`,
  verificado con logs de Railway); una tarea pegada entre dos documentos "saltaba" de uno a otro al
  abrirlos (mismo bug de fondo que `keepOnSplit`, pero al pegar entre documentos — ver invariante en
  `FROM.md`).

---

## Sesión 2026-08-30 (sesión 11) — 13 bugs reportados en vivo por Alberto, cola completa

Web **v9.10.13**. iOS **build 180** (Xcode Cloud, sin enviar a revisión — pendiente de decisión).
Servidor: `assistantTurn.ts` (`buildSystemPrompt`). Detalle completo en
`logs/2026-08-30-sesion11-cola-13-bugs.md`.

Alberto fue reportando bugs uno tras otro mientras se auditaba el resto de la app; se resolvieron
en cola, probando cada uno antes de pasar al siguiente.

- **Contextos raíz con `_closed` residual no se podían asignar** ("Inversión" aparecía en el picker
  pero el chip nunca se pintaba tras elegirlo): `isContextClosed()` (`utils/cajones.ts`) ahora
  siempre devuelve `false` para un contexto raíz, en vez de depender de que cada caller (había
  varios) recordara la excepción por separado.
- **Mención `#contexto` en el editor de documentos se borraba del texto** tras Enter (aunque la cita
  del párrafo sí se creaba): `DocContextMention.tsx` ahora inserta el texto `#nombre` como enlace
  interno visible con clase propia `.doc-ctx-mention` (color de acento, algo más pequeño — estilo
  Tana), en vez de `deleteRange`.
- **Captura rápida no detectaba evento+hora sin palabra de fecha explícita** ("Reunión con X a las
  11:30" sin "hoy"/"mañana"): `extractDateFromEnd()` (`utils/naturalDate.ts`) ahora asume HOY como
  fallback cuando hay hora pero ningún día reconocible en el texto. De paso, `captureHelper.ts`
  ahora también marca `isTask` para un evento detectado automáticamente (antes solo el shortcut
  `-e` lo hacía) — invariante "todo evento nace también con status" (ver más abajo, 5 ago 2026).
- **Duplicado de evento local + evento crudo de Google Calendar en la vista Mes del planner**:
  `monthDayItems()` (`PlannerPanel.tsx`) no aplicaba el dedup por `gcalIdCore()`/
  `linkedGcalIdCores()` que sí usan `getTimedBlocks`/`getAllDayTasks` del mismo archivo — único
  punto que se había quedado sin el patrón.
- **Fechas de tareas acopladas en documentos con varios checkboxes** (cambiar la fecha de una
  cambiaba todas; solo una aparecía en las listas generales): el atributo `dataNodeId` de
  `TaskItemLinked` (`DocEditor.tsx`) no tenía `keepOnSplit: false` — TipTap clonaba el id al partir
  una casilla con Enter, así que dos checkboxes visuales acababan apuntando al mismo Node real.
  Añadida también una red de seguridad en `syncTasksToNodes` que detecta `dataNodeId` duplicado
  dentro del mismo recorrido y crea un Node propio para el duplicado (cubre documentos ya afectados).
- **Botón "Hoy" del planner no recentraba** si ya estabas en el día de hoy pero habías desplazado el
  scroll horizontal a mano: el efecto de reset de scroll estaba atado solo a
  `centerDate.toDateString()`, que no cambia si ya era hoy. Añadido `recenterTick`, un contador que
  se incrementa en cada clic del botón y fuerza el reset del scroll independientemente de si la
  fecha cambió.
- **Columna derecha no acompañaba el evento/tarea/timeblock abierto desde el planner** (destino
  Agenda): seguía enseñando brief+cockpit+nota diaria de un día cualquiera. Nuevo
  `V2AgendaElementSide` (`V2RightColumn.tsx`) — fecha/hora/recurrencia/prioridad vía `TaskPropsBody`
  (ya existente, reutilizado sin cambios), contexto+grupo vía `V2NoteContext` (exportado, ya
  existía), enlaces internos/externos de sus Notas (nuevo, extrae `<a href>` del body de la nota-hija
  `_containerNotes`), y elementos relacionados vía `V2Backlinks` (recién exportado desde
  `V2DetailView.tsx`, antes privado).
- **Brief+cockpit vuelven a la columna derecha, planner limpio**: A3 de la auditoría (29 ago) los
  había subido arriba del planner central. Revertido a petición de Alberto en vivo — el planner
  (centro) solo muestra el calendario; `V2BriefCard`+`DailyCockpit` (atrasadas/sin fecha) se mueven
  al pie de `V2RightColumn`, encima de la nota diaria — mismo sitio para el que ya existía CSS sin
  usar (`.v2-agenda-cockpit-strip`, `.v2-brief-card`).
- **Barra "Lo próximo" ("Después: …") se cortaba sin indicador** contra el borde de la ventana:
  `.v2-nextevent-after` no tenía `min-width:0`/`overflow:hidden`/`text-overflow:ellipsis` — añadidos,
  mismo tratamiento que `.v2-nextevent-text`.
- **El asistente confundía el día de la semana al resolver "el martes"/"el lunes que viene"**: el
  prompt (`buildSystemPrompt`, `assistantTurn.ts`) ya inyectaba HOY con su día correcto, pero dejaba
  la aritmética de "próximo martes desde hoy" al LLM — fuente clásica de errores. Ahora se calcula en
  TypeScript una tabla determinista (próximo de cada día de la semana) y se inyecta ya resuelta, con
  instrucción explícita de copiarla en vez de recalcularla.
- **iOS — scroll horizontal por días en el planificador semanal**: un `DragGesture(minimumDistance:
  0)` en `WeekDayColumn` (añadido 26 ago para long-press→crear TimeBlock) bloqueaba el pan del
  `ScrollView(.horizontal)` ancestro en cuanto el dedo tocaba la rejilla de horas. Sustituido por
  `HourGridLocation`, un `UILongPressGestureRecognizer` real vía `UIGestureRecognizerRepresentable`
  — mismo patrón que `RowPanGesture` (ver invariante del 25 ago más abajo).
- **iOS — swipe "Hoy" en una tarea del chat también la abría**: `RowPanGesture`
  (`AssistantSwipeRow.swift`) reconocía el toque simultáneamente con el `Button` del botón de swipe
  revelado, y el guard `offset != 0` de `onTap` dejaba de proteger nada porque el `Button` ya había
  puesto `offset = 0` antes. Ahora `RowPanGesture` recibe `isOpen` y su delegate implementa
  `gestureRecognizer(_:shouldReceive:)` para rechazar el toque entero mientras la fila está abierta.
- **iOS — "atrás" desde una tarea abierta volvía a una conversación anterior**:
  `AssistantChatView.currentChatNodeId` seguía actualizando `store.currentThreadKey` en iPhone
  aunque el comentario del código asumiera que ahí "casi siempre vale nil" — el `fullScreenCover` no
  desmonta la vista de abajo, así que el `navigator` compartido sí lo cambiaba de verdad. Ahora es
  `nil` explícito en iPhone (`isPad`, ya existía) — el mecanismo solo tiene efecto real en iPad.
- **Fix urgente de producción, no relacionado con la cola**: un botón de menú móvil (feature del 29
  ago) se renderizaba siempre en el DOM como primer hijo de `.v2-root` (grid de 3 columnas) pero solo
  tenía estilo dentro de `@media (max-width:900px)` — en escritorio se colaba como ítem de grid sin
  columna asignada y desplazaba sidebar/centro/derecha una posición cada uno. `display:none` base
  añadido.
- **Changelog de la web desincronizado de Telegram desde el 13 ago**: `changelog.html` se editaba a
  mano por separado de `docs/CHANGELOG.md`, y se dejó de hacer mientras Telegram (`post-changelog.sh`)
  seguía enlazando ahí en cada aviso. Nuevo `scripts/gen_changelog_html.py` regenera TODO el contenido
  entre marcadores `<!-- CHANGELOG:START/END -->` desde el `.md` (163 versiones históricas, incluidas
  16 antiguas en formato párrafo sin viñetas); `post-changelog.sh` lo llama automáticamente tras cada
  publicación — el HTML ya no puede desincronizarse en silencio.

---

## Sesión 2026-08-27 (sesión 9) — Tipos de elemento personalizados + fix de rendimiento en Elementos

Web **v9.7.32**. iOS **build 161 (v2.18)**, enviada a revisión de Apple. Servidor: `GET/PUT
/assistant/node/:id` amplía su contrato. Detalle completo en
`logs/2026-08-27-sesion9-tipos-custom-elementos.md`.

- **Elementos iba lenta** con muchos elementos: la función que clasifica cada nodo por tipo
  reparseaba su JSON interno sin caché en cada evaluación. Arreglado reutilizando la caché que ya
  existía para otro propósito en el store.
- **Tipos de elemento personalizados**: desde Elementos → "Tipos" → "+", el usuario crea un tipo
  propio (Persona, Libro, Película, Receta…) con icono y propiedades estilo Notion — texto, número,
  selección (única o múltiple), fecha, casilla, enlace y el nuevo tipo **calificación** (estrellas de
  1 a 5). Un elemento de ese tipo sigue siendo una nota normal, con su ficha de propiedades encima
  del contenido. Disponible en web/Mac y en iOS (implementación completa en las dos plataformas, no
  solo web — iOS no tenía nada parecido en producción, se construyó desde cero siguiendo el mismo
  formato de datos que la web para no romper la sincronización entre dispositivos).

---

## Sesión 2026-08-27 (sesión 7, tramo 3) — Publicar contexto entero, pulido de Elementos

Web **v9.7.27 → v9.7.29**. Servidor: varios commits (sin migración de versión propia). Detalle
completo en `logs/2026-08-27-sesion7-elementos-agentes-perfil.md` (sección "Tramo 3").

### Publicar un contexto entero, con URL propia

Igual mecanismo que ya existía para grupos (`routes/groups.ts`), extendido a contextos enteros
(`routes/contexts.ts`, nuevo): tabla `public_contexts` (slug + `customSlug` editable, `passwordHash`
opcional, `description`), `POST /contexts/publish` (requiere Pro), vista pública sin auth en
`/c/:userSlug/:customSlug`. `contentOfContext(userId, contextId)` resuelve en una query tanto los
elementos sueltos del contexto como los grupos que le pertenecen — SIEMPRE en vivo en cada visita,
nunca snapshot. La plantilla HTML pública (`lib/sharedPublicPage.ts`) se comparte entre `/g/*` y
`/c/*`: sidebar de elementos con scroll-to-anchor, y un grupo dentro de un contexto se pinta como su
propio encabezado con sus elementos debajo (antes de esta sesión solo se veía el título, plano).
Requirió una ruta nueva `/c/*` en el Worker de Cloudflare que ya servía `/g/*` y `/p/*`.

**Bug real con datos de producción**: un grupo puede tener el contexto asignado a **sí mismo** (se
arrastró/movió como bloque) en vez de a cada uno de sus miembros — `contentOfContext()` solo miraba
el contexto de los miembros, así que ese grupo se colaba como elemento suelto sin su contenido
debajo. Arreglado contando también el `_ctxRefs` propio del nodo-grupo. Server-only por ahora — el
cliente (`V2ContextView.tsx::contextGroups`) sigue con la regla original a propósito (decisión de
diseño del 26 ago: "un grupo no tiene contexto propio, se deriva de sus miembros").

### Elementos — 3 arreglos más

- **"‹ Volver" no restauraba Elementos**: un listener global (`from:open-detail`, `V2App.tsx`) tenía
  el closure de `onOpenNode` congelado desde el primer render — leía siempre el `rightMode` inicial,
  nunca el actual. Arreglado con refs siempre actualizados en vez de leer el `useState` directamente.
- **"Seleccionar varios" no funcionaba en la vista Tabla** (la vista por defecto): `TableView` no
  tenía ningún concepto de modo selección. Añadidos props + checkbox por fila.
- El toggle de selección y el switcher Tabla/Lista se movieron del centro a la columna derecha
  (`ElementsFilters.tsx`); el enlace "Limpiar" se quitó del centro (el chip "Todos" de la derecha
  ya cumple esa función).

---

## Sesión 2026-08-13 (sesión 3) — Agentes unificados, Web Push, tema Solar, widgets de iOS

Web **v9.6.956 → v9.6.961**. iOS **build 147 → 149, enviada a revisión con los 2 IAP + grupo de
suscripción + 2 suscripciones, tras retirar la 147 del proceso**. Servidor: varios commits, sin
migración de versión propia.

### 1. La lista de agentes del chat vs. la pestaña Agentes — dos fuentes de datos distintas

`loadAgentsContext()` (`assistantTurn.ts`) leía **solo** la tabla `agent_schedules` — la que revisa
el cron para disparar agentes por hora. Las pestañas Agentes de web (`agentesHelper.ts`) e iOS
(`AgentsHelper.swift`) leen **los nodos** con `extraData._agentDef === "1"`. Un agente creado desde
la web (`ElementsPanel.tsx` → `createAgentUnder`) solo escribe el nodo — la fila en
`agent_schedules` solo aparece si el usuario le pone hora después, desde el panel de propiedades. El
resultado: agentes visibles en la pestaña Agentes pero invisibles para el chat, sin poder pedirle
"ejecuta X ahora".

Arreglo: `loadAgentsContext()` pasa a leer `sync_nodes` (`extraData._agentDef==="1"`, no borrados, no
en papelera — mismo filtro exacto que las dos pestañas) como fuente primaria, y solo usa
`agent_schedules` para completar horario/activado cuando existe una fila. `AgentEntry.id` pasa a ser
el id de la fila de `agent_schedules` cuando existe, si no el id del nodo — seguro de cambiar porque
el JSON que ven los clientes ya mapeaba `id: a.nodeId` (`routes/assistant.ts`), nunca el id de la
fila. `POST /agents/schedule` (programar desde cualquier plataforma) ya hacía upsert correcto en
`agent_schedules`, así que el cron seguía disparando bien — el bug era solo de visibilidad en el chat.

De paso: los dos `emitOpsForNodes(...).catch(() => {})` sin log (creación de agente por chat, escribir
en la nota diaria) pasan a loguear el error en vez de tragarlo en silencio.

### 2. Web Push real — tercer canal de `notifyUser()`

La web no tenía NINGÚN aviso posible con la pestaña cerrada — solo el badge `_agentResultUnseen` en
la sidebar, que exige tenerla abierta y enfocada. Nuevo:

- `web_push_subscriptions` (`userId`, `endpoint`, `p256dh`, `auth`) — equivalente de `device_tokens`
  para el navegador.
- `lib/webPush.ts` — `sendWebPush()`, mismo patrón que `push.ts` (APNs): sin `VAPID_PUBLIC_KEY` /
  `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` no hace nada, no rompe nada. Suscripciones que el navegador
  invalida (404/410) se borran solas.
- `POST /webpush/subscribe|unsubscribe`, `GET /webpush/vapid-public-key`.
- `notifyUser()` (`lib/notify.ts`) manda por los tres canales (push iOS, web push, Telegram) sin que
  quien llama sepa cuál está activo.
- Cliente: `public/sw.js` (recibe el push, muestra la notificación, en clic enfoca una pestaña
  abierta vía `postMessage` o abre una nueva con `?openNode=`), `hooks/useWebPush.ts` (registra el
  SW, suscribe con la clave del servidor), toggle "Avisarme aunque tenga la pestaña cerrada" en
  `V2Sidebar.tsx`. Sin pedir el permiso solo al cargar — requiere un clic explícito.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` ya en Railway.

### 3. Tema Solar — claro de día, oscuro de noche, sin geolocalización

Mismos umbrales en las dos plataformas (dawn 6:00–7:00, dusk 19:30–20:30, hora LOCAL del
dispositivo, sin pedir ubicación):

- Web (`hooks/useTheme.ts`): durante la ventana de transición interpola en directo (cada minuto) los
  colores de superficie entre su versión clara y oscura, escribiéndolos como overrides inline de las
  CSS custom properties — fuera de la ventana, vuelve a la hoja de estilo normal (`data-theme`).
- iOS (`Services/SolarTheme.swift`): corte discreto a mitad de cada ventana de 30 min;
  `preferredColorScheme` cambia envuelto en `.animation()`, igual que el propio "Automático" de iOS
  hace su cross-fade con el sensor de luz.

### 4. Chat — tres pulidos de paridad web/iOS

- El separador de hora ya no exige >3h de hueco: sale al principio de la conversación y cada vez que
  cambia el minuto entre dos mensajes.
- "Abrir" pasa de "›" (mismo signo que el prefijo del mensaje del usuario) a "→ Abrir".
- Nuevo campo `autoOpen` en la respuesta de `/assistant/chat`: `true` solo cuando `plan.openToday`
  (el usuario pidió justo VER su nota de hoy) — el cliente navega solo, sin esperar un toque en
  "Abrir". Nunca en confirmaciones de escritura (`appendToDiary`), donde un salto de pantalla sería
  un susto.

### 5. iOS — Google Calendar, gestos, calendario de días, widgets, Quick Actions

- **Google Calendar nunca conectaba**: `connectGoogle()` solo fijaba
  `presentationContextProvider` bajo `#if os(macOS)` — en iOS `ASWebAuthenticationSession.start()`
  fallaba siempre con `presentationContextNotProvided` (error 2). Nuevo
  `IOSPresentationAnchorHelper` (UIWindowScene) con su propio `retainSession` (la propiedad es
  `weak`).
- **"Sin conexión" falso**: una sync cancelada por otra más reciente (`NSURLErrorCancelled`, típico
  al cambiar de pantalla) se interpretaba como fallo de red. Ahora una cancelación no toca
  `isOffline`/`lastSyncError`.
- **Gestos de borde** en `AssistantChatView`: 20pt en cada borde del hilo (no del composer);
  izquierda abre/crea la nota diaria, derecha presenta `IOSAgendaView` (vista de agenda que había
  quedado huérfana tras el pivote a chat-first, reaprovechada en vez de duplicada) como sheet.
- **Selector de calendario** (`AssistantDayPickerSheet`, `DatePicker` gráfico) en la toolbar de
  cualquier nota diaria, para saltar a cualquier fecha; nueva `AssistantDayAgendaView` generaliza la
  agenda de "hoy" a un día cualquiera. `navigator.open(id)` ahora soporta transiciones id→id con la
  cubierta ya abierta — necesitó `.id(navigator.rootId)` en el `fullScreenCover`, si no
  `AssistantNodeView` conservaba su identidad y `.task` no volvía a correr.
- **Target `FromWidget` nuevo** (WidgetKit — el directorio existía desde el 16 jul pero nunca se
  había registrado en el `.pbxproj`): 3 widgets (`FromTodayWidget`, `FromNoteWidget`,
  `FromQuickWidget`) reusando el App Group `group.com.albertolezaun.from` y el token de sesión que ya
  comparte `FromServerService` con la Share Extension — sin sesión/red, "Abre Fromly para ver tus
  tareas", nunca datos inventados. `syncCaptureCredentialsToAppGroup()` llama
  `WidgetCenter.shared.reloadAllTimelines()` al sincronizar, sin esperar el ciclo de refresco.
- **Quick Actions** del icono (`UIApplicationShortcutItems` en `Info-Extra.plist` + `AppDelegate`):
  4 accesos — nueva tarea, nota de hoy, nota de voz, preguntar — convergen en los mismos
  `Notification.Name` que ya posteaba (sin que nadie los escuchara) `FromAppIntents.swift` para Siri.

### 6. App Store — primera vez con una extensión nueva en el envío

Al archivar con la extensión `FromWidget` recién registrada, el archive falló la primera vez:
`Provisioning profile doesn't include the App Groups capability`. `xcodebuild archive
-allowProvisioningUpdates` lo resolvió solo, regenerando el perfil con el entitlement — mismo
mecanismo (sesión de Xcode ya autenticada, cero credenciales extra) que ya se usaba para el
upload. Export con `destination: upload` en el plist (nuevo `ExportOptionsAppStore***Upload.plist`)
sube directo, sin pasos manuales de Transporter.

Cancelar+resubir con una build que YA incluye una extensión nueva no cambió el procedimiento de las
sesiones anteriores: "eliminar del proceso de revisión" → editar → swap de build → cada IAP y cada
suscripción (grupo Y tiers, por separado) con "Añadir a revisión" eligiendo el borrador existente,
nunca "Crear nuevo envío" → enviar todo junto al final.

### 7. Auditoría de pagos y email — todo verificado en vivo, nada roto

Repaso completo de checkout/LemonSqueezy, IAP/StoreKit, sincronización de plan, paywall, precios y
deliverability de email. Único hallazgo real: `.env.example` tenía variantes de LemonSqueezy
desactualizadas — Railway (producción) ya tenía los valores correctos, confirmado leyendo
`railway variables` directamente. Confirmado además, con acceso a los paneles: el webhook de
LemonSqueezy responde `200 {"ok":true}` en las últimas entregas, y `fromly.app` está `Verified` en
Resend con envíos "Delivered" en las últimas horas (transaccionales y de nurturing).

---

## Sesión 2026-08-13 (sesión 2) — El embudo de la prueba de 15 días

Web **v9.6.955 → v9.6.956**. iOS **build 147 subida a App Store Connect** (no adjuntada: ver
abajo). Log completo en `logs/2026-08-13-sesion2-embudo-prueba-15-dias.md`.

### El problema: correos de un producto que ya no existe

La prueba de 15 días entró el 12 ago (`lib/plan.ts`), pero los correos seguían siendo los del plan
gratis. `/auth/register` encolaba la secuencia `free` —24 correos en 90 días— cuyo argumento era
«el plan gratis te da 1.000 elementos, pásate a Pro», dirigido a alguien que **ya tenía Pro**
durante la prueba. Y del día 16 en adelante no había nada: quien no compraba, desaparecía.

### El ciclo de vida nuevo (`lib/email-sequences.ts` + `services/trialLifecycle.ts`)

```
registro ──> trial (15 días, 9 correos)
               ├─ compra ──> pro / lifetime          (se cancela UNPAID_SEQUENCES)
               └─ vence ──> post_trial (2: "te doy un mes más")
                              ├─ canjea ──> trial_extra (8 correos / 30 días)
                              │                └─ vence ──> winback
                              └─ no canjea ──> winback (+30/+60/+90/+150 días)
```

Invariantes que hay que respetar al tocar esto:

- **Quien encola `post_trial`/`winback` es el cron, no el registro.** La prueba se puede ampliar
  (mes extra, días de regalo desde admin) y la fecha real de vencimiento no se conoce el día que
  alguien se apunta.
- **Al activar un plan hay que cancelar `UNPAID_SEQUENCES`** desde LOS DOS sitios: el webhook de
  LemonSqueezy y `routes/storekit.ts` (compra y restauración). Que StoreKit no lo hiciera es por lo
  que un comprador de iPhone seguía recibiendo «te quedan 3 días de prueba».
- **El mes extra se ofrece una vez por cuenta** (`users.trial_extended_at`), con enlace firmado de
  14 días → `GET /auth/trial-extend`. El recordatorio va al día +4 para caber en esa ventana.
- **`enqueueSequence(..., skipPast)`**: con una fecha de referencia antigua, sin esto el cron manda
  la secuencia entera de golpe. Mismo motivo tras el corte de 7 días de `referenceFor()`.
- **Desde cuándo cuenta el backfill**: fin de prueba menos 15 días, NO `createdAt`. A las cuentas
  que ya existían se les dio la prueba a mano meses después de registrarse; con `createdAt` los 9
  pasos caían en el pasado y 25 personas se habrían quedado sin un solo correo.

### El idioma, de punta a punta

`users.locale` decide el idioma de todo el correo y **ningún camino de registro lo rellenaba** —ni
email, ni Google, ni Apple—: la columna se quedaba en su `DEFAULT 'en'`, así que todo el mundo,
españoles incluidos, recibía los correos en inglés. Además, quien entraba con Google o Apple no
recibía **ningún** correo: solo `/auth/register` encolaba. Los tres caminos comparten ahora
`onNewSignup()`.

Regla de reserva, en las tres capas (plantillas, `email-i18n.ts` y el `i18n.js` de la landing):
**idioma exacto → inglés. Nunca español.** Las tres caían a español, que no lo entiende quien no lo
habla.

### Cobertura de idiomas

| Superficie | Idiomas |
|---|---|
| Correos | 15 (embudo de captación completo; pro/lifetime/monthly caen a inglés en los 6 nuevos) |
| Página de precios | 15 (`i18n-pricing.js`, solo esa página) |
| App web / iOS | 12 |
| App Mac | 7 |
| Resto de la landing | 2 (es/en) |

`i18n.js` entiende `?lang=xx` —lo que usan los enlaces de los correos—, resuelve por prefijo
(`de-AT` → `de`) y calcula los idiomas disponibles en vez de tenerlos fijos.

### Endpoints nuevos

- `GET /auth/unsubscribe?token=` — baja de marketing (público, HTML, 9 idiomas). Antes el pie de
  todas las plantillas llevaba un `{{unsubscribe}}` literal que no sustituía nadie: **no había
  forma de darse de baja**.
- `GET /auth/trial-extend?token=` — canje del mes extra.
- `POST /admin/email/run-lifecycle` — pasa el ciclo sin esperar al cron.
- `POST /admin/users/:id/extra-month` — concede el mes extra a mano (soporte).
- `POST /admin/email/preview` acepta ya `locale`.

### Migraciones

`users.trial_extended_at`, `users.email_opt_out`, y la cancelación de los pasos pendientes de la
secuencia `free`. ⚠️ Esa cancelación va **después** del `CREATE TABLE email_sequences`: puesta
antes, una base de datos nueva no arranca.

## Sesión 2026-08-09 — Auditoría del cobro: ninguna vía de compra funcionaba

Web **v9.6.952 → v9.6.953**. iOS **2.13 (142) → 2.14 (143)**, enviada a revisión con los 4
productos in-app. Log completo en `logs/2026-08-09-auditoria-compra-pro.md`.

**Por qué no había ni una venta real.** Las tres vías de compra estaban rotas a la vez:

1. `createLSCheckoutUrl` (`server/src/routes/auth.ts`) concatenaba
   `&checkout[success_url]=…` a la URL **ya firmada** por LemonSqueezy → la pasarela respondía
   *«Invalid signature»*. Ahora la URL firmada se devuelve intacta y el retorno se configura en
   la propia petición de creación, con `product_options.redirect_url`.
2. El webhook de LemonSqueezy apuntaba a `getfrom.app/api/webhooks/lemonsqueezy` (dominio
   viejo) → 301 → 405. Re-apuntado por API a
   `from-server-production.up.railway.app/webhooks/lemonsqueezy`.
3. En App Store Connect no existía **ningún** producto in-app; el paywall de iOS pedía cuatro
   identificadores desconocidos para Apple y recibía una lista vacía.

**Concesión de plan, endurecida.** La decisión pasa por un único `isPaidPlan()`
(`server/src/lib/plan.ts`, 10 llamadas) y el límite del plan gratis por un único
`freeNodeCapacity()` — antes MCP y captura escribían en `sync_nodes` sin comprobarlo. La
lógica de StoreKit se extrajo a `server/src/lib/storekitLogic.ts`, pura y con 13 tests:
rechaza transacciones no verificadas por Apple, entorno Sandbox (salvo
`ALLOW_SANDBOX_PURCHASES=1`), `bundleId` ajeno, caducadas, y `productId` que no cuadre. El
`productId` y la fecha de caducidad se toman **de Apple**, nunca del cuerpo de la petición;
`ownedByAnotherUser()` devuelve 409 si esa transacción ya está ligada a otra cuenta. La
verificación de firma de los webhooks pasa a fail-closed (sin secreto configurado → 401) y
`isLicense` exige que `VARIANT_LICENSE` esté definida y coincida (antes, variante vacía =
Lifetime).

**Nuevo `POST /webhooks/appstore`** (App Store Server Notifications V2): hasta ahora el
servidor solo conocía una compra de iOS si la app se la contaba, así que una cancelación, un
reembolso o una renovación fallida pasaban desapercibidos. En el cliente, `StoreKitService`
persiste en `UserDefaults` una cola de avisos pendientes y la reintenta.

**`/webhooks/license-verify`, eliminado.** Activaba `licenseStatus: "active"` sin
autenticación y escribía un `fromUserId` tomado del cuerpo. Existía desde el commit inicial y
ningún cliente lo llamó nunca (el Mac valida contra la API de LemonSqueezy directamente,
`LicenseService.swift:147`).

**No existen las pruebas gratuitas.** Fuera `trialing` como plan de pago, `/auth/trial-invite`,
el cron de invitaciones y el de expiración, la opción del dashboard admin y el copy de «7 días
gratis» en web e iOS (12 idiomas cada uno), términos legales ES/EN y manual ES/EN. `trialing`
queda como valor histórico en base de datos y **no** concede acceso.

**Informe diario** (`lib/daily-report.ts`): todas las consultas filtran ya por
`exclude_from_stats = false`, y las filas distinguen suscriptores de pago, licencias Lifetime,
pago pendiente, «activas ya vencidas ⚠» y churn.

**Verificación en vivo** (no solo compilación): plan gratis contra función Pro → 402; compra de
iOS con transacción inventada → 400; webhook mal firmado → 401; webhook Lifetime bien firmado →
200 con licencia, 3M tokens y publicación desbloqueada; cancelación → acceso revocado. Cuentas
y cupón de prueba borrados al terminar.

⚠️ **`ALLOW_SANDBOX_PURCHASES=1` debe volver a `0`** cuando Apple apruebe los productos: el
revisor compra en Sandbox, así que hasta entonces tiene que seguir activo.

---

## Sesión 2026-08-05 (sesión 6b) — «Nodo» es palabra interna: elemento de cara al usuario

Web **v9.6.951 → v9.6.952**. Barrido de terminología y de lo que promete el plan gratis, a
raíz del correo de bienvenida de una cuenta de prueba real ("sigue hablando de nodos").

- **Regla nueva en `FROM.md`**: «nodo» solo existe en el código (`Node`, `nodeId`,
  `from_create_node`, tabla `nodes`). De cara al usuario es **elemento** en todos los
  idiomas.
- Corregidos: correos transaccionales (9 idiomas), secuencias de nurturing (8 idiomas),
  landing ES/EN, términos, tips de Telegram, `PaywallModal` y los strings es/en de la app
  web, strings de iOS en 12 idiomas, y el manual.
- **Plan gratis, mensaje único**: 1.000 elementos · Mac, iPhone y web · sin IA, sin
  adjuntos y sin publicar notas. El servidor mantiene `FREE_CHAT_LIMIT` (5 chats/mes):
  decisión explícita de prometer menos de lo que se da.
- Pendiente: los strings de la app web en los otros 10 idiomas (declinaciones y género
  hacen inseguro el reemplazo automático).

---

## Sesión 2026-08-05 (sesión 6) — Elementos limpio, «un evento es una tarea», paridad iOS

Web **v9.6.948 → v9.6.949** (solo cliente) · iOS **v2.12 (140) → v2.13 (141)**, subida a App Store
Connect. Log completo: `logs/2026-08-05-sesion6-elementos-evento-tarea-ios.md`.

### 1. INVARIANTE NUEVO — un evento es una tarea con día y hora

`status` dice que es una tarea; `isEvent` dice que va al timeline y a Google Calendar. Dos
propiedades del mismo tipo, no dos tipos. Ver la sección «Tarea y evento son LO MISMO» de `FROM.md`
para la regla completa (predicado único por plataforma, migraciones, y la excepción deliberada del
cockpit de Hoy, que sigue excluyendo `isEvent` para no duplicar con el bloque de eventos del día).

- Web: `utils/taskNode.ts` (`isTaskNode`/`hasTimeOfDay`) + `utils/migrateEventsToTasks.ts`.
- iOS: `Node.isTaskLike`/`hasTimeOfDay` + migración de datos **v19**.
- Las vías de creación de las dos plataformas ponen ya `status` al crear un evento.

### 2. Página de Elementos

Centro vacío propio en el destino Elementos (era el único destino general que no tocaba
`centerElementId`, así que heredaba el chat o la nota diaria); «Limpiar» solo con filtro activo
(`canClear` en `FilterViewSwitcher`); chips en varias líneas, sin los tipos vacíos y sin Evento/
Contextos/Memoria; retirado el filtro por contexto (duplicaba sidebar → ficha del contexto).

### 3. iOS — además de la unificación

- **Recurrencia**: `toggleCockpitDone` no creaba la siguiente instancia y `toggleComplete` avanzaba
  el `due` del mismo nodo (modelo descartado en FROM.md) — una tarea recurrente completada en el
  iPhone se perdía. Ahora ambas vías marcan done, estampan `_doneAt` y llaman a
  `NodeService.spawnRecurrence`.
- **Google Calendar**: `IOSGCalPlannerView` pintaba el evento crudo y el nodo enlazado a la vez.
  Nuevo `visibleGoogleEvents` + `gcalIdCore` + `Node.linkedGcalEventId` (puerto del fix de la web).
- **Ajustes → IA**: clave BYOK de DeepSeek (con el aviso de servidores en China) y selector de
  modelo (`availableModels`/`aiPreferredModel`, que iOS no leía ni enviaba).

---

## Sesión 2026-08-05 (sesión 5) — Duplicado de Google Calendar, Día/Agenda separados, contexto al abrir una tarea

Web **v9.6.947 → v9.6.948**. Solo cliente. Log completo:
`logs/2026-08-05-sesion5-gcal-duplicado-dia-agenda.md`.

### 1. Un evento de Google, UNA ficha — causa raíz del duplicado

Los eventos de Google no se materializan como nodos: el planner y la columna del día pintan a la vez
los nodos-evento locales y los eventos crudos del pull, y deduplican por id. Ese dedup **nunca
acertaba** para los eventos creados por Fromly:

- el LISTADO (`fetchGCalEvents`, `server/src/routes/google.ts`) devuelve ids COMPUESTOS
  `<calendarId>::<eventId>` —los necesita para saber a qué calendario escribir—,
- pero `POST /google/calendar/events` devuelve el id PELADO de Google, que es el que se guarda en
  `node.gcalEventId`.

`"abc" !== "correo@gmail.com::abc"`, así que lo único que quedaba en pie era un heurístico por
`título|hora de inicio`, que se rompe justo al mover un bloque (el nodo ya está en su hora nueva y
el crudo de Google sigue en la vieja → dos fichas; y una encima de otra cuando Google propaga).

**Regla nueva**: comparar siempre por `gcalIdCore(id)` (`utils/gcalNodesSync.ts`), que quita el
prefijo del calendario y el sufijo de instancia recurrente (`_20260805T110000Z`, consecuencia de
`singleEvents=true`). `linkedGcalIdCores()` devuelve el Set de los que ya tienen nodo vivo,
resolviendo el link con `getGcalEventId` (columna + las dos formas de `extraData`). Aplicado en
`PlannerPanel` (timeline y franja de todo el día) y en `DayColumn`.

**Segundo fallo del mismo origen**: `PlannerPanel.syncNodeToGcal` decidía crear-o-actualizar leyendo
solo la columna, así que arrastrar un nodo cuyo link vivía en `extraData` CREABA un segundo evento
en Google y dejaba el anterior huérfano. Ahora usa `getGcalEventId`, igual que `removeNodeFromGcal`.

Blindado en `src/__tests__/gcalIdCore.test.ts` (5 tests). No verificado contra la API de Google (la
cuenta local no la tiene conectada).

### 2. Día y Agenda vuelven a ser dos destinos de la sidebar

Deshace la fusión de la sesión 2 del mismo día. **Día** (primero, destino por defecto) = timeline
horario a la derecha + nota diaria en el centro. **Agenda** = calendario semana/mes/año en el centro
+ atrasadas/sin fecha/contextos en seguimiento a la derecha. `RightMode` gana `'dia'`; se retiran
`agendaView`/`onAgendaViewChange` y las tabs fijas Día/Planner de `V2RightColumn` (cada destino usa
el mecanismo genérico Tab1/Tab2). `diaResetKey` lo dispara ahora la fila «Día».

### 3. Abrir un elemento con contexto lleva también la columna derecha

Excepción deliberada a «abrir un elemento nunca cambia `rightMode`» (30 jul): la sidebar ya se iba
con el contexto del elemento, así que las tres columnas hablaban de dos cosas distintas. `onOpenNode`
fija `rightMode='contexto'` cuando el elemento tiene contexto; si no lo tiene, no toca nada.

### 4. Dos arreglos de usabilidad

- **Fondo de la columna de hoy**: `--accent-soft` entero (12%) se leía como un fondo oscuro sobre
  toda la columna → velo del ~3%, y ninguno en la vista de un solo día (`.pp-root--single`).
- **Clic bajo el texto de una nota → cursor al final**: el hueco pertenece al contenedor, no al
  ProseMirror. Cubierto en `V2NoteBody` (también en `inlinePage`, que es el caso de las «Notas» de
  una tarea) y en `.v2-detail-body` de `V2ElementView`.

### 5. «Seguimiento» = lo que sigues, sin más condiciones

`DailyCockpit` excluía de ese bloque los contextos con tareas de hoy/atrasadas — resto de cuando
«Para hacer» agrupaba por contexto. Con la lista plana actual eso hacía desaparecer de la columna a
un contexto seguido en cuanto tenía una tarea atrasada. Filtro actual:
`contextParent(c) && isContextFollowed(c)`.

---

## Sesión 2026-08-05 (sesión 3) — Restyling, iconos propios, historial, perfil conversacional

Web **v9.6.944 → v9.6.946**. Desplegado a producción (solo cliente). Log completo:
`logs/2026-08-05-sesion3-restyling-iconos-perfil.md`.

### 1. Sistema de iconos propio — fin de los emojis

`landing/web/src/v2/components/Icon.tsx` pasa a ser la ÚNICA fuente de iconos de la app: ~60 SVG de
trazo sobre rejilla 24×24, grosor 1.7, `stroke="currentColor"` (heredan tema claro/oscuro y acento
sin una línea de CSS). Sustituyen a todos los emojis de la interfaz: sidebar, chat, composer,
menús, filas de elemento, modales, paywall, onboarding, menú «/» y menú contextual del outliner,
barra del editor, visor PDF, planner y columna del día. `isIconName()` permite listas mixtas (el
menú «/» combina glifos tipográficos «H1»/«⊞»/«☰» con iconos reales).

**Los emojis que viven en el DATO no se migran.** Muchos nodos los llevan escritos como prefijo
(agentes «📈 …», sesiones «✦ …», raíces «📅 Agenda», «🧠 Contexto»). Reescribirlos rompería los
helpers que localizan esas raíces por su nombre exacto (`isContextKnowledge`, `NON_AGENDA_ROOTS`,
`findContextRoot`). Se ocultan AL PINTAR con `utils/displayText.ts`
(`stripLeadingEmoji`/`displayTitle`), centralizado en `elementDisplayTitle()` (`utils/docNode.ts`),
por el que pasa cualquier título de elemento. Los nodos NUEVOS ya nacen limpios: `createAgentUnder`,
agentes predefinidos, `createSessionNode`, el transcript y `migrateContextNotes`.

Limpiados también los 12 JSON de `src/i18n/` (43 cadenas por idioma). Se conservan los glifos
TIPOGRÁFICOS (⌘ ⇧ → ✓ ✦ ○ ★): no son emoji y varios son atajos de teclado.

Y la regla alcanza al texto que escribe la IA: bloque de estilo global en
`aiChatStore.buildPayload` («No uses NUNCA emojis»). Verificado en vivo — sin él, el modelo
salpicaba 🎯/✨ dentro de una interfaz que ya no tenía ninguno.

### 2. Restyling — capa de tokens `--v2-*`

Nombres NUEVOS que solo leen las reglas `.v2-*`, así que no se tocan los tokens de
`styles/index.css` (compartidos con v1 y la landing). Van declarados en **`:root`**, no bajo
`.v2-root`: los modales de la v2 se montan con `createPortal(document.body)` y allí las variables
no existirían — bug real, el modal «Adjuntar» salía transparente.

Dirección visual: escalonado de superficies tipo Drive/Claude (`--v2-surface` centro blanco,
`--v2-surface-panel` columna derecha, `--v2-surface-sunken` sidebar), bordes casi invisibles +
sombras cortas en vez de líneas duras, radios 6/9/13/18, una sola curva y duración de transición
(`--v2-ease`/`--v2-fast`), scrollbars finas, composer con sombra y anillo de foco, tabs
segmentadas, cabeceras de las 3 columnas alineadas a 52px.

### 3. Historial de conversaciones y tarjetas de contexto

`v2/components/V2ContextBrowser.tsx` — un solo componente en dos pieles (`variant`), porque el
comportamiento (entrar en un contexto → ver sus conversaciones → volver) es idéntico y no debe
divergir:

- `cards` — rejilla en el estado vacío del chat, en el hueco que dejaron el saludo «Hola 👋» y las
  4 sugerencias genéricas.
- `list` — tab «Historial» del destino Chat: contextos + últimas conversaciones, con buscador.

Datos en `v2/conversations.ts` (`listConversations`, `conversationCountsByContext`,
`listContextCards`). El drill-down es estado LOCAL: mirar las conversaciones de un contexto NO
cambia el contexto activo de la app. `RightSubTab` pasa a `'primary' | 'chat' | 'historial'`.
Única excepción de navegación añadida: abrir una conversación desde el Historial devuelve la
columna a la tab «Chat» (si no, la conversación no se vería en ningún sitio).

### 4. Tres bugs reales

1. **Tarea asignada a un contexto que no aparecía en su ficha.** `V2ContextView` listaba las tareas
   con `store.children(ctxId)` (hijos directos). Asignar un contexto a algo que ya existe NO lo
   mueve en el árbol: `assignContext` escribe una REFERENCIA (`extraData._ctxRefs`), que es lo que
   hace el badge de contexto de cualquier fila. La tarea quedaba asignada de verdad pero invisible.
   Ahora usa `nodesInContext()` (referencia + slug clásico + escrita dentro de la nota) unido a los
   hijos directos, deduplicando. Los ELEMENTOS ya lo hacían bien; las tareas no.
2. **Los puntos de contexto se teñían con el acento del contexto abierto.** `contextColor()` caía
   en un `defaultAccentHex()` que leía el `--accent` VIVO del documento — que `V2App` sobrescribe
   para teñir la app con el color del contexto activo. Ahora el por-defecto es un color FIJO de
   marca (claro `#2C4356` / oscuro `#8FB4D9`).
3. **Modales transparentes** — ver §2 (tokens bajo `.v2-root` + portal a `body`).

### 5. Sidebar y creación

- La marca «Fromly» es el botón de INICIO (día de hoy + nota diaria + su columna). «Volver» desde
  el primer nivel de contextos hace lo mismo — el reset del tinte de acento sale solo al
  deseleccionar el contexto.
- El «+» de la cabecera «CONTEXTOS» aparece en hover, como el de cada fila.
- **Barra de creación** (`.v2-createbar`) en lugar de los botones «Nueva conversación» / «Nuevo
  elemento»: chat · nota · lienzo · tarea · grabar · adjuntar, todo en el contexto activo. **Sin
  botón de EVENTO a propósito**: `NewTaskModal` usa un input `datetime-local`, así que una tarea
  con hora YA es un evento (timeline del día + sync con Google Calendar).
- **`V2AttachModal`** (nuevo) — «Adjuntar» sustituye al botón «Drive»: arrastrar/elegir archivo
  (delega en `onFilesDropped`, la ruta única de importación) · pegar un enlace (crea el
  nodo-recurso y lo completa con `unfurlUrl`) · importar desde Drive.
- La MEMORIA de un contexto ya no enseña ni su título («Memoria») ni el selector de contexto: es un
  documento interno que pertenece a su contexto por definición. Quitado también el globo «Hablar de
  esto» de la cabecera de nota (la tab «Chat» ya ES la conversación de lo centrado) y el prop
  muerto `onOpenChat`.
- Elementos del contexto ordenados por `createdAt`, no `updatedAt` (con updatedAt la lista se
  reordenaba sola en cada edición).

### 6. Perfil conversacional + proactividad

`v2/profileChat.ts` (nuevo). Una sesión de perfil es un chat normal con
`extraData._profileChat='1'`; ese flag inyecta `PROFILE_CHAT_INSTRUCTIONS` en el turno y activa el
aviso «He añadido esto a tu perfil».

**No se reinventó la escritura del perfil**: `aiChatStore.learnFromUserMessage` ya extraía hechos
de cada mensaje (`extractUserKnowledge`) y los guardaba (`saveUserKnowledgeToProfile`). Faltaba (a)
un sitio donde eso sea el objetivo explícito, (b) DECIR lo guardado y (c) que Fromly sepa arrancar
la conversación solo. El aviso es **determinista**: lista lo que el extractor guardó de verdad,
nunca lo que el modelo diga. Fuera del chat de perfil sigue silencioso.

Las instrucciones viajan dentro de `userProfile` (`buildPayload`) — único canal libre hacia el
system prompt del servidor, así que **todo el sistema es cliente puro, sin desplegar servidor**.

`aiChatStore.openAssistantSession()` es la primitiva nueva de «conversación que empieza Fromly»:
sesión con flags propios + primer mensaje del asistente ya persistido. Los chips de apertura van en
el NODO (`_openChips`), no en el transcript (que solo guarda rol+texto) — si no, una conversación
proactiva abierta días después perdería sus sugerencias.

**Proactividad**: `maybeOfferProfileChat()` corre al arrancar (V2App). Condiciones: ≥1 semana desde
la última vez, ninguna propuesta sin responder y ≥5 elementos nuevos creados desde entonces. Crea
la conversación con `_pendingReply='1'` y `open:false` — no abre nada; el aviso de la sidebar
(`listPendingAgentConversations`) ya la pinta, con texto propio («Fromly quiere saber más de ti») e
icono de perfil cuando es de perfil.

---

## 🗓️ Sesión 2026-08-05 (sesión 2) — Navegación v2: destinos en la sidebar, fusión Agenda+Día, tab Planner

Web **v9.6.943 → v9.6.944**. Desplegado a producción (solo cliente). Log completo:
`logs/2026-08-05-sesion2-navegacion-agenda-planner.md`.

### 1. Rediseño — destinos generales en la sidebar (Chat/Agenda/Elementos/Día)

Alberto señaló que la columna derecha mezclaba dos conceptos en las mismas 5 tabs fijas:
Contexto/Chat describían "lo seleccionado"; Agenda/Elementos/Día eran vistas GLOBALES sin relación
con el contexto activo. Validado con un mockup HTML interactivo (estructura actual vs. propuesta)
antes de tocar código; aprobado con una corrección explícita: nada de una tab "Chat" genérica para
Agenda/Elementos/Día — en su lugar, un destino "Chat" propio y general, fuera de contextos.

Implementado con plan formal (`EnterPlanMode`), que detectó un catch real antes de escribir
código: el centro YA renderizaba el chat general por defecto sin nada abierto — si el destino
"Chat" abría TAMBIÉN el composer en la derecha, se duplicaba (dos cajas de texto compitiendo por la
misma sesión). Resuelto con una rama nueva en el ternario del centro (`V2App.tsx`):
`rightMode==='chat'` sin `centerElementId` → hueco neutro (`.v2-empty`), el composer vive solo en
la columna derecha.

- **`V2Sidebar.tsx`**: nueva sección de destinos generales, mismo estilo visual (`v2-ctx-row`) que
  una fila de contexto, sin etiqueta de sección propia (evita colisión con la fila pseudo-contexto
  "General" ya existente).
- **`V2RightColumn.tsx`**: `RightMode` de 5 tabs fijas a 1-2 dinámicas — Tab 1 = contenido del
  destino activo (Contexto→Ficha, Chat→composer embebido, Elementos/Agenda/Día→su vista de
  siempre); Tab 2 "Chat" (solo si `elementId`) = la conversación de ese elemento
  (`V2ElementChat`→`aiChatStore.getOrCreateElementSession`), en cualquier destino.
  `effectiveSubTab` se calcula de forma DEFENSIVA (`rightSubTab==='chat' && elementId ? 'chat' :
  'primary'`) — si `centerElementId` vuelve a `null` desde cualquiera de los muchos sitios que lo
  limpian, sin que ese sitio recuerde resetear `rightSubTab`, no deja una Tab 2 fantasma.
- **`V2Chat.tsx`**: nuevo prop `elementScoped?: boolean` que desacopla `embedded` (maquetación:
  `.v2-right-fill` vs `.v2-col.v2-center`) de si el copy (sugerencias/saludo/título) es genérico o
  "sobre este documento" — antes `embedded` decidía ambas cosas a la vez. El destino Chat general
  necesita maquetación `embedded` + copy genérico (`elementScoped={false}`); el resto de usos no
  pasa el prop nuevo, cae en `embedded` como siempre (cero cambio de comportamiento existente).
- **`V2App.tsx`**: nuevo handler `onSelectGeneral(dest)`, hermano de `onSelectCtx`; retirado
  `handleRightMode`. Los 9 sitios que hacían `setRightMode('detalles')` se repartieron según su
  intención real: "muestra el chat de lo que acabo de centrar" → `setRightSubTab('chat')` sin
  tocar `rightMode`; "vengo de iniciar una conversación general sin nada centrado" →
  `setRightMode('chat')`. `onNewChatInCtx` es un caso aparte: se queda en `rightMode='contexto'`
  (no es el destino Chat general, que es "sin contexto" por definición) con `rightSubTab='chat'`.

Verificado en vivo contra el test account: Chat (composer solo en la derecha, centro neutro, crear
una nota de prueba la lleva al centro con la MISMA conversación siguiendo en su Tab 2),
Agenda/Elementos/Día (Tab 2 aparece/desaparece sola al abrir/cerrar algo), contexto real sin
regresión (Ficha+Chat). Nota de prueba eliminada al terminar.

### 2. Bug real: setState durante el render (`V2TaskDetailView.tsx`)

Al abrir una tarea, React avisaba "Cannot update a component (`V2App`) while rendering a different
component (`V2TaskDetailView`)". Root cause: `getOrCreateContainerNotes` (mutación real del store,
`store.createNode`) se llamaba dentro de un `useMemo` — fase de render, no efecto. Cualquier
componente suscrito al store vía `useStore()` (V2App entre ellos, `useEffect`+`store.subscribe`)
recibía un `forceUpdate` síncrono en mitad del render de otro componente.

Fix: lectura sin crear (`containerNotesNode`, ya existía) en el `useState` inicial — no pierde un
render con las notas ya existentes — y la creación (`getOrCreateContainerNotes`) diferida a un
`useEffect` sobre `[node.id]`. Render condicional (`{notesNode && <V2NoteBody .../>}`) para el
instante entre montaje y efecto. Verificado con instrumentación temporal en `NodeStore.notify()`
(capturando `new Error().stack` de cada llamada en `window.__notifyStacks`, revertida tras
confirmar) — el warning desaparece tanto con tareas nunca abiertas como con las que ya lo
disparaban antes del fix.

Pendiente (no tocado, ya anotado en "Próxima sesión" antes de esta): `V2ConversationView.tsx`
tiene el mismo patrón.

### 3. Cabecera de tabs oculta cuando solo hay una

`V2RightColumn.tsx`: la barra `.v2-right-tabs` ya no se pinta cuando `elementId` es `null` (solo
Tab 1 disponible, nada que elegir) — reaparece en cuanto hay algo centrado y la Tab 2 "Chat" es una
alternativa real.

### 4. Rediseño (2ª parte) — fusión Agenda+Día, nuevo tab Planner

Alberto: "Agenda y Día son en la práctica la misma área de trabajo" — pidió fusionarlas en un
único destino "Agenda" (primero en la sidebar, destino por defecto al abrir la app), con un tab
nuevo "Planner" que separa "ver mi día" de "organizar/planificar". Aclarado con 3 preguntas de
seguimiento (contenido del tab Día tras la fusión, qué muestra la derecha en Planner, si
Chat/Elementos cambian de orden) antes de planificar. Un agente de diseño revisó el primer borrador
de los efectos de sincronización y encontró 3 problemas reales antes de escribir código:

- **Arranque en frío (F5)**: un efecto con deps `[agendaView, rightMode]` se dispara una vez al
  montar, pero en ese instante el store puede seguir vacío (antes de `runStartupMigrations`) — la
  reposición del centro debe depender de `ready`, no solo de esas 2 deps.
- **Carrera con `PlannerPanel`**: la tab "Día" (`PlannerPanel initialView="day"`) tiene su PROPIO
  efecto interno (línea ~311-315, dispara `from:open-detail` en cada montaje/cambio de día). Al
  desmontar/remontar entre Planner↔Día, su `centerDate` (estado LOCAL) siempre reinicia a HOY — un
  ref "recordando el último día visto" en `V2App` quedaría neutralizado un instante después por
  este mecanismo. Se descartó por completo (no aporta nada real).
- **Orden del ternario del centro**: la rama `agendaView==='planner'` debe ir DENTRO del `else` de
  `centerElementId ?`, no antes — si no, abrir una tarea desde la lista recortada de la derecha
  (que sí fija `centerElementId` sin tocar `agendaView`) nunca se vería mientras "Planner" siga
  activo.

Diseño final:

- **`V2Sidebar.tsx`**: 3 filas — Agenda (nueva, primera) → Chat → Elementos. Fila "Día" retirada
  (vive dentro de Agenda).
- **Centro de Agenda**: siempre la nota diaria del día activo (comportamiento de "Día" sin
  cambios) — salvo que se le quita el icono "Hablar de esto" (`V2ElementView.tsx`,
  `!node.isDiaryEntry`, mismo criterio que ya excluía la fila de fecha) — esa nota no tiene chat
  propio.
- **Columna derecha de Agenda** (`V2RightColumn.tsx`): 2 tabs FIJAS propias, independientes del
  mecanismo genérico Tab1/Tab2 — **Día** (el `PlannerPanel key={diaResetKey} viewTabs={['day']}
  dayOnlyHeader` de siempre, sin cambios) y **Planner** (nuevo: centro = `PlannerPanel
  viewTabs={['week','month','year']} centerToday`, antes vivía embebido en el chat general
  (`V2Chat.tsx`, retirado de ahí); derecha = `<DailyCockpit bare disablePlanner hideToday
  hideFuture />`, solo atrasadas+sin fecha+seguimiento — hoy/futuras ya las cubre el planner
  central). Un 3er tab "Chat" aparece si se abre una tarea normal desde dentro
  (`elementId && !store.getNode(elementId)?.isDiaryEntry`) — nunca para la nota diaria.
- **`onAgendaViewChange`** (`V2App.tsx`): handler SÍNCRONO, no un efecto reactivo — evita la
  carrera de arriba. Re-pulsar la tab ya activa es un no-op (`if (next === agendaView) return`);
  solo la fila "Agenda" de la sidebar (`onSelectGeneral`) fuerza el reset duro a hoy
  (`setAgendaView('dia')` + `setCenterElementId(getTodayDiaryUnderAgenda().id)` +
  `setDiaResetKey(k=>k+1)`).
- **`PlannerPanel.tsx`**: nuevo prop opcional `centerToday` — centra la columna de hoy en el
  scroll horizontal en vez de pegarla al borde derecho (comportamiento por defecto). La función
  `todayRightPos()` (renombrada `todayScrollPos()`) es la ÚNICA fuente de verdad que consultan sus
  3 usos (montaje, `centerNow()`, `isAlreadyCentered()`) — bastó bifurcar su fórmula interna por el
  prop, sin tocar cada llamador. No se cambió el comportamiento por defecto: 2 rutas de v1
  (`MainLayout.tsx:1254`/`:1336`) SÍ quieren hoy pegado a la derecha para arrastrar tareas — el
  riesgo resultó no existir de todos modos (`App.tsx` confirma que v1/`MainLayout` está retirada de
  las rutas de la web desde el 15 jul 2026, código muerto sin ruta que lo monte), pero el prop
  opt-in era la forma correcta de todos modos. `renderCol(day)`: clase `pp-col--today` cuando
  `isToday` (ya calculado, antes solo pintaba la línea "ahora") + CSS `background:
  var(--accent-soft)` (`styles/index.css`) — el cuerpo de la columna horaria no tenía ningún fondo
  distinto para hoy hasta ahora (solo la cabecera teñía el texto). Sin botón CAL en el header
  multi-tab de Planner — confirmado en vivo que solo existe en el header `dayOnlyHeader` de la tab
  Día, sin tocar.
- **`DailyCockpit.tsx`**: nuevo prop opcional `hideFuture`, envuelve el bloque "Futuro" —
  Atrasadas/Seguimiento/Sin fecha no dependen de Futuro, sin efectos colaterales.
- **Limpieza de código muerto**: `V2AgendaView.tsx` eliminado (único importador era
  `V2RightColumn.tsx`, confirmado por grep); `showPlanner` retirado de `V2Chat.tsx` (prop +
  bloque JSX del overlay + import de `PlannerPanel`) y de sus 3 call-sites
  (`V2App.tsx`/`V2RightColumn.tsx`/`V2ElementChat.tsx`, los 3 quedaban siempre en `false` tras el
  cambio); función `classify()` muerta en `V2RightColumn.tsx` (nunca se llamaba, encontrada al
  limpiar un import de tipos).

Verificado en vivo: arranque directo en Agenda con la nota de hoy; tab Planner cambia
centro+derecha, columna de hoy centrada y con fondo distinguible, sin CAL, lista recortada correcta
(Atrasadas+Sin fecha, sin Hoy/Futuro, Seguimiento ausente por falta de datos de test); abrir una
tarea desde ahí la centra y revela su Tab "Chat" (probado completo con respuesta de la IA); volver
a Día reconstruye el timeline de hoy limpio; contexto real sin regresión. Google Calendar en el
timeline de Día verificado por CÓDIGO (mismo `PlannerPanel`/mismas funciones — `fetchGcalEvents`,
`getTimedBlocks`, `getAllDayTasks` — que Planner, sin ninguna condición que excluya `viewMode==='day'`)
— no se pudo probar con un evento real porque la cuenta de test no tiene Google conectado
(confirmado en Ajustes → Google: "No conectado").

### 5. Sidebar — avisos como notificación de texto, hueco en blanco corregido

Alberto: los avisos de "conversación pendiente"/"informe de agente nuevo" deberían ser texto
destacado, no botones — y sobraba mucho espacio en blanco bajo Elementos. Root cause del hueco: el
bloque de destinos generales (Agenda/Chat/Elementos) reutilizaba la clase `.v2-ctx-list` (la misma
que la lista de Contextos de abajo), y ambas tienen `flex:1` dentro del sidebar
(`display:flex;flex-direction:column`) — el bloque de 3 filas cortas se estiraba ocupando todo el
espacio libre en vez de dejárselo a Contextos. Fix: `flex:'none'` inline en ese bloque concreto (la
lista de Contextos, que sí necesita `flex:1` para scrollear con muchos contextos, no se tocó).
Avisos: nueva clase `.v2-sidebar-notice` (franja de acento `border-left` de 2px, sin fondo salvo
`:hover`, texto 12px/600) sustituye el estilo de botón (`.v2-newchat` con overrides inline de
`background`/`border`) que tenían antes.

Verificado: `tsc -b` limpio, 80/80 tests, `npm run build` sin errores.

---

## 🗓️ Sesión 2026-08-05 — Bug real de recurrencia, badge de fecha, Seguimiento con estilo de tarea

Web **v9.6.942 → v9.6.943**. Desplegado a producción (solo cliente). Log completo:
`logs/2026-08-05-recurrencia-fecha-badge-seguimiento.md`.

1. **Bug real: las tareas recurrentes completadas desde la v2 nunca creaban la siguiente
   instancia.** Alberto marcó "Revisar el morning fórmula" (cada 6 meses) como hecha desde la tab
   Agenda — no apareció ninguna instancia nueva en Futuro. Root cause: `toggleTaskDone`
   (`utils/dailyCockpit.ts`), la función que usa TODO checkbox de tarea de la v2 (`TaskRow`,
   `DailyCockpit`, `DayColumn`), nunca llamaba a `spawnRecurrence` — esa lógica solo existía
   duplicada dentro de `OutlinerNode.tsx` (el outliner v1). Cualquier tarea recurrente completada
   desde Agenda, Elementos o Contexto en la v2 se "perdía" — nunca volvía a aparecer. Fix:
   `spawnRecurrence(node)` extraída a `utils/dailyCockpit.ts` (misma lógica — crea SIEMPRE un nodo
   nuevo bajo el día correcto del diario, nunca recicla el `due` del nodo existente), llamada
   desde `toggleTaskDone` al completar. `OutlinerNode.tsx` no se tocó (v1, ya funcionaba
   correctamente, fuera del alcance del bug). Verificado en vivo end-to-end contra producción:
   tarea de prueba con recurrencia "cada 6 meses" completada hoy (5 ago 2026) → nueva instancia
   confirmada el 5 feb 2027 con el badge `🔁 cada 6 meses`, comprobado navegando el calendario
   anual. Datos de prueba eliminados al terminar.
2. **Badge "+" para poner fecha, quitado el botón de calendario del hover.** Alberto: "las tareas
   que no tienen fecha, podrían tener debajo del título un pequeño badge para añadirle fecha...
   como el badge de interrogación de contexto... y de esa forma quitamos el botón de calendario
   que aparece en hover, porque ya no sería necesario." Implementado en `TaskRow.tsx`: badge
   `.dc-due--empty` ("+", mismo lenguaje visual dashed-border que `.dc-ctx-chip--empty`) cuando no
   hay fecha, visible solo para tareas abiertas. Quitado el botón de calendario de
   `TaskHoverActions.tsx` (ahora solo: 🎯 Hoy · → Futuro · 🗑 Eliminar). **Regresión encontrada y
   corregida en la misma sesión**: `TaskHoverActions` es compartido por 5 componentes, y 3 no
   tenían ningún otro sitio para abrir el popover de fecha/recurrencia (dependían solo del botón
   quitado) — `DayColumn.tsx` (ambas variantes de `renderTaskCheckboxRow`), `ElementsPanel.tsx`
   (fila de tipo `'event'`) y `ContextPropertiesPanel.tsx` (tareas sin fecha). Añadido el mismo
   badge en los tres sitios.
3. **Bloque Seguimiento — mismo estilo que las tareas, sin números irrelevantes.** Alberto: "el
   bloque seguimiento... el contexto padre debería aparecer alineado a la derecha, como en el
   resto de bloques... los números que aparecen son irrelevantes, quítalos... que seguimiento
   tenga contextos en lugar de tareas, pero guarde el mismo estilo con las tareas del resto de
   bloques." `renderCtxRow` (`DailyCockpit.tsx`) pasa al mismo patrón dos-líneas que `TaskRow`:
   título arriba (`dc-text--wrap`), contexto PADRE alineado a la derecha abajo (mismo sitio que el
   chip de contexto de una tarea) en vez de pegado al título. Quitados los dos contadores
   numéricos (nº de tareas del contexto, nº de nodos que contiene).

Verificado: `tsc -b` limpio, 80/80 tests, build sin errores.

---

## 🗓️ Sesión 2026-08-04 — Navegación v2: Agenda/Día vuelven a su centro, Elementos sin truncar ni duplicar

Web **v9.6.940 → v9.6.942**. Desplegado a producción (solo cliente). Log completo:
`logs/2026-08-04-navegacion-v2-agenda-elementos.md`.

Sesión de reportes reales encadenados sobre la v2 (chat-first), cada fix revelando el siguiente:

1. **Tab Agenda se quedaba con la tarea abierta** en vez de volver al planner al pulsarla de
   nuevo. La causa era que un comentario en `V2App.tsx` describía un mecanismo ("pulsar Agenda
   limpia `centerElementId`") que ya no existía en el código — se había quitado a propósito el 30
   jul al desacoplar las tabs del centro. Como el fix revertía esa decisión explícita, se confirmó
   el alcance con Alberto antes de tocar nada: Agenda y Día pasan a ser la excepción 3 de la regla
   ("clicar una tab nunca toca el centro") — cada una lleva su propio centro fijo (planner / nota
   diaria de hoy), así que pulsarlas siempre lo restaura. Implementado en `handleRightMode`
   (`V2App.tsx`). `V2AgendaView` tenía además su propio bug de estado (día/año navegado se quedaba
   pegado) — remount forzado vía `key={agendaResetKey}`, incrementada en cada clic en la tab.
2. **Sidebar de contexto se quedaba naranja** tras abrir un elemento sin contexto — `onOpenNode`
   solo actualizaba `selectedCtxId` cuando el nodo abierto SÍ tenía contexto asignado. Fix:
   `setSelectedCtxId(ctx ? ctx.id : null)` incondicional (mismo patrón que `onOpenConversation`).
3. **Fila "🧠 Memoria" duplicada** en la tab Contexto — como `onSelectCtx` ya abre siempre la
   memoria del contexto en el centro (decisión del 30 jul), la fila de acceso rápido en
   `V2ContextView.tsx` mostraba el mismo documento ya abierto al lado. Quitada.
4. **`TaskRow` (componente único de fila de tarea, usado en TODA la app) rediseñado a dos
   líneas**: título siempre completo arriba, fecha/hora/repetición/contexto/acciones abajo —
   mismo patrón `.dc-row-main`/`.dc-row-l1`/`.dc-row-l2` que ya existía en `PorPlanificarPanel`.
   Antes competían todos en una sola línea y el título podía encogerse casi a 0px en filas con
   chip de contexto. Aplicado también a los dos renders de "Todo el día" en `DayColumn.tsx`, que
   antes ni siquiera pintaban el chip de contexto (tenían su propio render, fuera de `TaskRow`).
5. **Mismo truncado en `ElementsPanel.tsx`** (lista virtualizada, `@tanstack/react-virtual`) —
   al quitar el truncado en sus filas de evento/nota/conversación, las alturas fijas por tipo
   (`ROW_H`/`TASK_ROW_H`) dejaron de bastar y las filas empezaron a solaparse. Fix: medición
   dinámica real por fila (`ref={virtualizer.measureElement}` + `data-index`) + un
   `virtualizer.measure()` forzado tras el primer pintado (sin esto, la primera fila visible se
   quedaba con su tamaño ESTIMADO en vez del medido). Verificado con `getBoundingClientRect()`
   fila a fila: 0 solapamientos tras el fix, en listas mezclando tipos.
6. **Notas diarias excluidas de Elementos** — revierte una decisión del 22 jul (entonces tenían su
   propio tipo buscable 'día'); ahora `classify()`/`classifyElement()` devuelven `null` para
   `n.isDiaryEntry` en ambos clasificadores (`ElementsPanel.tsx` y `v2/elementKind.ts`). Solo se
   abren desde Calendario o la tab Día.
7. **Auditoría explícita** ("revisa si hay más bugs o indicaciones contradictorias") sobre el
   mismo patrón (comentario describiendo un mecanismo que el código ya no tiene) encontró 3 más:
   la tab Día tenía el bug del punto 1 sin arreglar (mismo fix aplicado, `diaResetKey`);
   `elementsFilter` no se reseteaba nunca tras "← Agentes"/"← Prompts" (`handleRightMode` ahora lo
   limpia al entrar a Elementos por un clic normal); y la clase `dc-text--wrap` (la que de verdad
   desactiva el truncado vía CSS) se aplicó bien en `ElementsPanel.tsx` pero se olvidó en
   `TaskRow.tsx` y en los dos renders de `DayColumn.tsx` del punto 4 — los títulos seguían
   cortándose con "…" pese al rediseño a dos líneas.
8. **Corrección sobre el punto 5**: en Elementos, un título de nota/conversación a 2 líneas
   dejaba la fecha de la l2 pegada al icono de la fila siguiente, sin aire entre filas (Alberto,
   en vivo tras el deploy: "en este caso sí que el título se debería truncar... que no ocupe dos
   líneas"). Solo afecta a la fila genérica de `ElementsPanel.tsx` (nota/PDF/enlace/conversación)
   — vuelve a truncar en una línea con elipsis. `TaskRow` y las filas de evento (el caso que sí se
   pidió arreglar en el punto 4) se quedan a dos líneas sin truncar, sin este problema.

Verificado en vivo end-to-end contra la cuenta real (`localhost:5173` apuntando a producción):
`tsc -b` limpio, 80/80 tests (`vitest run`), build de producción sin errores. Datos de prueba
creados durante la verificación (1 tarea temporal, 1 nota sin título, 1 conversación) eliminados
al terminar.

---

## 🗓️ Sesión 2026-07-30 (fase 7) — El mismo bug seguía sin resolverse del todo: max_tokens con margen real

Web **v9.6.939 → v9.6.940**. Log completo: `logs/2026-07-30.md` (fase 7).

Al reverificar en vivo el caso real de la fase 6 (checklist exhaustiva del contrato de Cliente
Nova) tras desplegar `max_tokens=8192`, se seguía cortando. Además, la respuesta cruda reveló que
el modelo a veces escribe un `<function_calls>` literal como preámbulo antes del bloque
`from-action` — no forma parte de nuestro protocolo, es un hábito de otros formatos de
function-calling, y se vería como texto suelto feo en el chat si la respuesta llega a completarse.

Lo que realmente lo resolvió: la documentación oficial de Anthropic confirma que `claude-haiku-4-5`
(el modelo real de la mayoría de usuarios) soporta hasta **64.000 tokens de salida** en la API
síncrona — el límite de 8192 estaba lejísimos de ese techo sin motivo. Subido a 16000. Se
complementó con un tope numérico duro en el prompt (máx. 6 secciones, máx. 6 puntos cada una — un
límite concreto es más fácil de seguir para el modelo que una prioridad cualitativa) y con un
filtro de `<function_calls>` en cliente (`stripActions` en `V2Chat.tsx`,
`stripActionBlocksForDisplay` en `aiChatStore.ts`).

Verificado en vivo con el mismo mensaje otra vez: el modelo generó 15 secciones (no respetó el
tope de 6) pero el documento se completó entero sin cortarse — confirma que el margen real de
tokens, no la instrucción de prompt, era lo que faltaba. Datos de prueba limpiados, cuenta
devuelta a su estado exacto previo.

---

## 🗓️ Sesión 2026-07-30 (fase 6) — Bug real: el chat pisaba la nota abierta al crear un documento

Web **v9.6.938 → v9.6.939**. Server: `max_tokens` 2048→4096 en `/ai/chat` + instrucción de JSON
válido en el prompt. Ambos desplegados a producción. Log completo: `logs/2026-07-30.md`.

Caso práctico real de Alberto (no un test dirigido): con una tarea abierta en el centro y su chat
asociado a la derecha, pidió un dossier comercial largo. Reportó tres problemas encadenados en un
único mensaje ("vamos con todo"), root-causados y arreglados en vivo contra la cuenta real:

1. **`create_document` fallaba en silencio con contenido largo**: `extractActions` (`aiChatStore.ts`)
   hacía `JSON.parse` directo del bloque `from-action` — con contenido largo el modelo casi siempre
   mete saltos de línea reales dentro del string en vez de `\n` escapado, JSON inválido, parseo
   falla sin fallback, el chat dice "hecho" y no pasa nada. Arreglado con `parseActionJson` +
   `sanitizeJsonControlChars` (reintento escapando control chars solo dentro de strings) y aviso
   explícito al usuario si sigue sin parsear con el bloque cerrado. `max_tokens` subido a 4096 en el
   servidor — un dossier con secciones + el JSON + la prosa se acercaba al límite de 2048.
2. **El documento creado apartaba la nota que se estaba trabajando** (corrige la nota de la fase 5,
   arriba: "el chat creando un documento salta a la pestaña Chat" ya NO es el comportamiento
   correcto tras este fix). Dos causas independientes: `aiChatStore.ts` disparaba
   `from:open-artifact` para CUALQUIER creación de un solo elemento (ahora solo `create_agent`/
   `create_prompt`, vía `AUTO_OPEN_ALONE`); y el efecto de `V2App.tsx` que promueve un artifact al
   centro al terminar el streaming no comprobaba si ya había algo abierto (corregido comprobando el
   `centerElementId` actual — un primer intento con un ref de "estado al empezar el turno" no
   funcionó de forma fiable por el doble-montaje de efectos de React StrictMode). Documentos/notas/
   recursos creados desde el chat de un elemento ahora quedan como chip clicable en el propio mensaje
   (mismo patrón que ya existía para agentes/prompts) en vez de sustituir el centro solos.
3. **JSON crudo visible al reabrir la conversación por Elementos**: `appendToTranscript` persistía el
   texto sin limpiar de bloques `from-action` — la burbuja en vivo se veía bien porque el stripping
   solo se aplicaba en pantalla (`V2Chat.tsx`). Nueva `stripActionBlocksForDisplay` aplicada también
   antes de persistir.

Verificado en vivo end-to-end tras desplegar servidor y cliente: documento largo creado sin
cortarse, centro intacto en la tarea original, chip clicable en el chat, clic abre el documento.
Datos de prueba limpiados de la cuenta al terminar.

---

## 🗓️ Sesión 2026-07-30 (fase 5) — Navegabilidad: memoria del contexto al centro, tabs desacopladas

Log completo: `logs/2026-07-30.md` (fase 5). Alberto pidió repasar TODA la navegación de las 3
columnas: "vamos a buscar sentido a toda la navegabilidad". Regla final acordada punto por punto
(con una pregunta directa sobre un detalle de diseño): **clicar una pestaña nunca toca el centro;
abrir un elemento cualquiera (ahora también conversaciones guardadas) va al centro sin mover la
pestaña**. Dos excepciones deliberadas: seleccionar un CONTEXTO sí navega a su ficha (cambiar de
área de trabajo, no "abrir un elemento"); el chat CREANDO un documento sigue saltando a la pestaña
Chat (es el mismo chat trasladándose, no una tab reaccionando a algo ajeno).

**"Lo que Fromly sabe" sale de la columna derecha** — antes vivía embebida ahí compitiendo por
espacio con tareas/elementos; ahora se abre en el centro como cualquier documento al seleccionar el
contexto (elegido explícitamente por Alberto frente a la alternativa de vista-previa-bajo-demanda),
heredando de regalo su propio chat asociado y edición por chat (fase 1-4). La ficha queda con una
fila compacta de acceso rápido + Tareas + Elementos, con mucho más espacio.

`V2App.tsx`: `onSelectCtx` reescrito (abre el doc de memoria en el centro, navega siempre a
'contexto'); quitado el efecto que vaciaba el centro al entrar en la tab Agenda; `onOpenConversation`
simplificado (la conversación se ve en el centro vía V2Chat, ya no decide "1 elemento → detalle").
`V2ContextView.tsx`: memoria de editor inline (`V2NoteBody`) a fila clicable (`V2ElementRow`).
Quitado `mostRecentConversationOf` (ya no se "adivina" la última conversación al seleccionar el
contexto — el chat de la memoria es ahora el hilo canónico). Verificado en vivo los 5 escenarios de
navegación; solo cambios de cliente, sin tocar el servidor.

---

## 🗓️ Sesión 2026-07-30 — Chat asociado a documento: rediseño chat-elemento, edición por chat

Log completo: `logs/2026-07-30.md`. Sesión en tres fases, cada una motivada por feedback en vivo de
Alberto probando el resultado de la anterior.

**Fase 1**: botón "Hablar de esto" en cualquier documento/tarea/recurso abierto en el centro — abre
una conversación centrada en ese nodo, en la columna derecha, con `V2Chat.tsx` en un nuevo modo
`embedded`. De paso, banner de upgrade: morado fijo → `var(--accent)`, texto actualizado a "1.000
elementos · Sin IA", y un bug real encontrado (el banner tapaba la cabecera del documento, incluido
el botón nuevo).

**Fase 2 — rediseño completo**: Alberto probó el botón y señaló que el modelo de navegación era
confuso (a veces el chat en el centro, a veces a la derecha; cada conversación aislada del documento
del que hablaba) y pidió estudiar patrones de otros productos (ChatGPT Canvas, Claude Artifacts,
comentarios de Linear/Google Docs) antes de tocar más código. Propuesta aceptada: **regla única de
sitio** — el centro es siempre lo que está abierto (o el chat general si no hay nada); la columna
derecha es siempre la conversación asociada. **Una conversación por elemento**:
`aiChatStore.getOrCreateElementSession(nodeId)` (nuevo) resuelve la sesión de origen
(`findOriginSession`, movido aquí desde V2App.tsx), o la enlazada (`extraData._chatSessionId` +
`_aboutNodeId` inverso en la sesión), o crea una nueva y la enlaza — nunca una nueva aislada cada
vez. `detailNodeId` (el "artifact de la columna derecha" del diseño de la sesión del 22 jul)
desaparece por completo: `centerElementId` (`V2App.tsx`) es ahora la ÚNICA fuente de verdad de qué
hay abierto. Nuevo componente `V2ElementChat.tsx` monta el chat en la tab derecha
(`V2RightColumn.tsx`, prop `elementId`), con sugerencias/saludo propios para el modo `embedded`
("Resume esto"/"Sácame tareas"/"Mejora la redacción"/"¿Falta algo?" en vez de las genéricas de
"resume mi día"). Bug real encontrado probando: la tab Agenda y la reapertura automática de "Chat"
al primer mensaje competían entre sí — corregido marcando como gestionada cualquier sesión que pase
por el modo elemento.

**Fase 3 — ajustes tras probar el rediseño**: tab renombrada "Detalles"→"Chat" (ya no tenía otro
uso); confirmado en vivo que funciona igual en tarea/documento/agente (PDF/imagen no probado en vivo
por falta de datos de prueba, pero misma cabecera sin condición de tipo). **El chat ahora puede
editar el documento abierto** — dos bugs reales: (1) cliente, `aiChatExecutor.ts` `updateNode()`
tiraba siempre `body` ("la IA nunca escribe body", correcto para el outliner clásico pero no para un
documento, cuyo body ES el contenido) — excepción añadida solo para `_doc='1'`, igual que
`create_document`; (2) servidor, el modelo no ejecutaba la acción pese al fix de cliente — el prompt
(`server/src/routes/ai.ts`) declaraba `body` en `update_node` e inyectaba ID+body de la nota abierta,
pero nunca decía explícitamente que debía usarlos para editarla — regla añadida. De paso, `create_note`
(chat) creaba el formato clásico de nodos en vez de documento — ahora siempre `_doc='1'`, igual que
`create_document`, consistente con el editor unificado desde el 13 jul.

**Fase 4 — deploy a producción + dos bugs MÁS al verificar la edición de documento ya desplegada.**
Railway sufrió una incidencia real de plataforma (`status.railway.com`), resuelta y reintentada con
éxito. Ya en producción: (3) `aiChatStore.ts` (archivo distinto al de la fase 3) tenía una SEGUNDA
barrera — `writeActions` descartaba en silencio cualquier `update_node` con solo `body` ("body
desactivado en Fromly") — el modelo generaba la acción bien y aun así no pasaba nada; corregido
igual, permitido si el nodo es `_doc='1'`, y `undoBundle` ahora guarda `prevBody` (antes "Deshacer"
no revertía una edición de body); (4) con las barreras abiertas, apareció HTML literal escapado como
texto en el documento — el modelo responde en HTML real (no markdown) porque ya LEE el body actual
como HTML, pero el cliente lo pasaba por `mdToHtml()` (pensado para crear desde cero); corregido,
`update_node` usa el body tal cual, sin conversión, preservando los `data-pid` existentes. Verificado
en vivo tras el segundo deploy: el párrafo aparece REALMENTE renderizado, no solo confirmado por texto.

---

## 🗓️ Sesión 2026-07-29 (noche, parte 3) — "Sign in with Claude": investigado y descartado

Sin cambios de código — investigación + documentación. Log: `logs/2026-07-29-sesion2.md` (sección
"Parte 3"). Alberto recordaba correctamente que `from-app` (Mac Swift archivado, v1.0) tuvo un login
OAuth real contra la suscripción Claude Pro/Max del usuario (con selector de modelo Opus/Sonnet/Haiku)
que probó en persona. Confirmado clonando el repo archivado en modo lectura:
`ClaudeAuthService.swift`/`AIService.swift` (commit `b46db95`) implementaban PKCE real contra
`claude.ai/oauth/authorize`, `Authorization: Bearer` + `anthropic-beta: oauth-2025-04-20` para las
llamadas — nunca falló, solo se quedó atrás al reescribir a la arquitectura actual.

Pedido de Alberto: investigar si se puede registrar un client_id propio y replicarlo en 2.0 para
todos los planes de pago. **Resultado: no se puede ni se debe** — la documentación oficial de
Anthropic (`code.claude.com/docs/en/legal-and-compliance`) prohíbe explícitamente desde feb 2026 que
apps de terceros usen credenciales OAuth de Free/Pro/Max en nombre de sus usuarios, con aplicación
server-side sin aviso previo desde el 4 abr 2026. El client_id de Claude Code está hard-coded para esa
única app. Documentado en `FROM.md` (tabla "❌ DESCARTADO") para que no se reintente. La alternativa
que la propia Anthropic recomienda — API key propia — ya está implementada (sesión anterior, mismo
día) para las 4 opciones de pago.

---

## 🗓️ Sesión 2026-07-29 (noche, parte 2) — BYOK realmente roto, precios más claros, "1 chat = 1 elemento"

Web **v9.6.933 → v9.6.934**. Log: `logs/2026-07-29-sesion2.md` (sección "Parte 2").

Alberto, mirando la página de precios, pidió aclarar "nodos" (ya no es el modelo mental del usuario)
y llevar la opción de "usa tu propia clave de IA" a cualquier plan de pago, no solo Lifetime — con
Claude y ChatGPT integrados. Investigando antes de tocar nada aparecieron dos sorpresas: (1) lo que
Alberto recordaba como "ya conectas tu suscripción Claude" es en realidad la función MCP (Fromly
como servidor OAuth para que claude.ai/Claude Code lean tus notas — dirección contraria a "la IA de
Fromly usa tu Claude"); (2) **bug real** — la clave API propia de Ajustes → IA se guardaba cifrada
pero NINGÚN endpoint de IA la leía nunca, todas las llamadas usaban siempre el pool compartido de
Fromly. Corregido de raíz: `resolveModelForUser()` nuevo en `server/src/services/ai.ts` prioriza la
clave del usuario si existe (cualquier plan de pago), y `/ai/chat` + `executor.ts` (agentes manual y
cron) + `middleware/tokens.ts` se saltan el gate/descuento de balance cuando se usa. Cliente
(`SettingsModal.tsx`): gate ampliado de Lifetime a cualquier plan de pago.

Además, "1 chat = 1 elemento": el límite gratis de 1.000 contaba el nodo-sesión, el wrapper de
transcript Y cada mensaje individual — una charla larga se comía decenas de "elementos" invisibles.
`routes/ops.ts` (enforcement real) y `nodeStore.ts atFreeNodeLimit()` (gate proactivo cliente) ahora
excluyen el wrapper y los mensajes del recuento y de la capacidad.

Pricing (`PricingView.tsx`, `landing/i18n.js`, `index.html`): "nodos"→"elementos", nuevo bullet Pro
"Usa tu propia clave de Claude, GPT o Gemini" (heredado por Lifetime).

Verificado en vivo (regresión, cuenta de prueba gratis): el chat normal sigue funcionando tras el
cambio de resolución de modelo/clave; el contador de Elementos confirmó que una conversación de 2
mensajes solo sumó pocos elementos, no docenas. No verificado: el camino BYOK con una clave de pago
real (no hay ninguna disponible para probar sin fabricarla) — pendiente de que Alberto lo compruebe
con su propia clave en una cuenta de pago.

---

## 🗓️ Sesión 2026-07-29 (noche) — Web: artifacts del chat a la columna derecha, sync de agentes con el cron

Web **v9.6.933**. Log: `logs/2026-07-29-sesion2.md`.

**Bug real — agentes/prompts creados por chat no abrían en la columna derecha.** `createAgentAction`/
`createPromptAction` (`aiChatExecutor.ts`) y el disparo genérico "se creó UN solo elemento" en
`aiChatStore.ts` (`undoBundle.createdIds.length === 1`) usaban el evento `from:open-detail` — pero
desde el 22 jul `onOpenNode` (su listener en `V2App.tsx`) cambió de comportamiento: para un elemento
normal abre el CENTRO (sustituyendo el chat), no la columna derecha. Regresión no detectada hasta
ahora. Arreglado con un evento nuevo y dedicado, `from:open-artifact` (`setDetailNodeId` +
`rightMode('detalles')`, sin tocar el centro) — el chat se queda visible con la tarjeta inline del
artifact y la columna derecha se abre sola. `from:open-detail`/`onOpenNode` sigue siendo correcto para
cuando el USUARIO abre un elemento ya existente (navega, sustituye el centro). El disparo genérico
excluye explícitamente tareas y eventos (decisión previa de Alberto: "no tareas sueltas").

**Bug real — `update_agent` (chat) no sincronizaba con el servidor.** Activar o reprogramar un agente
vía chat solo tocaba el `extraData` del nodo local — nunca llamaba a `POST /agents/schedule` como sí
hace `AgentPropertiesPanel` (botón Activar / modal de programación). El cron del servidor
(`agentSchedules`, tabla denormalizada) se quedaba con el estado viejo: un agente podía verse "Activo"
en la UI sin ejecutarse nunca, o ejecutarse a una hora que ya no correspondía. Candidato más fuerte
encontrado para un agente de check-in diario que Alberto reportó que dejó de funcionar tras días
funcionando bien. Corregido: `updateAgentAction` hace el mismo POST de sync que la UI tras aplicar los
cambios. Verificado en vivo contra una cuenta real: crear un agente por chat + "cambia la hora a las
07:15" por chat → `GET /agents/schedules` mostró la fila creada de verdad con `schedule: "daily:07:15"`
— antes de este fix esa fila nunca se habría creado.

**Límite de plan gratis ya no falla en silencio.** `runAgentScheduleCron` (server) salta sin avisar
(y sin desactivar) los `agentSchedules` que excedan `FREE_AGENT_LIMIT=1` en plan gratis — el agente
sigue viéndose "Activo" sin correr de verdad. `GET /agents/schedules` ahora devuelve
`skippedByPlanLimit` por fila; `AgentPropertiesPanel` muestra un aviso explícito cuando aplica.
Verificado en vivo: cazó un caso real y preexistente en la cuenta de prueba (un agente semanal
"Activo" que el cron llevaba saltándose).

**Aviso en sidebar para agentes AUTÓNOMOS terminados.** Antes solo los agentes CONVERSACIONALES
avisaban en la sidebar (`listPendingAgentConversations`/`_pendingReply`). Un agente autónomo que
termina y guarda un documento no tenía ningún aviso en la web (solo push en iOS). Mismo patrón:
`writeAgentResultToDiary` (servidor) marca el resultado con `_agentResultUnseen='1'`; `V2Sidebar`
muestra "N informes de agente nuevos" (`listUnseenAgentResults`); se marca visto al abrir el nodo
(`markAgentResultSeen`, en `onOpenNode`).

**El aviso "N conversaciones esperando" no bajaba al abrir una.** Solo se limpiaba al enviar la
primera respuesta (`aiChatStore.send()`), no al abrir la conversación — el botón seguía diciendo "2"
después de leer una de ellas. Nuevo `markPendingConversationSeen(id)`, llamado desde
`V2App.onOpenConversation`. Verificado en vivo: de "2 conversaciones esperando" a "1" al abrir.

**Enlace "Pasar a Pro" siempre visible en plan gratis.** Antes solo aparecía el paywall al chocar con
un límite concreto. Ahora, junto a "Plan gratuito" en la esquina inferior izquierda de la sidebar
(`V2Sidebar.tsx`), un enlace de texto discreto navega directo a `/pricing`.

**Vocabulario del chat — un contexto nunca se llama "nota".** El texto de confirmación al crear algo
("lo he puesto bajo...") lo redacta el modelo libremente; regla 4bis nueva en el system prompt
(`server/src/routes/ai.ts`) para que distinga contexto/área/proyecto de nota.

---

## 🗓️ Sesión 2026-07-29 — Push notifications APNs, apertura automática al crear, re-auditoría completa

iOS **2.11 → 2.12 (build 140)**. Log: `logs/2026-07-29.md`.

**Push notifications reales (APNs), extremo a extremo**: los agentes programados corren en el cron
del servidor (`runAgentScheduleCron`), no en el dispositivo, así que una notificación local no sirve.
Generada clave APNs en developer.apple.com, configurada en Railway (`APNS_KEY_ID`/`APNS_TEAM_ID`/
`APNS_PRIVATE_KEY`), tabla `device_tokens` (server), rutas `POST /devices/register` y
`POST /devices/unregister` (`requireAuth`), `server/src/lib/push.ts` firma JWT ES256 con `jose` contra
`api.push.apple.com`. iOS: `AppDelegate` vía `@UIApplicationDelegateAdaptor` (SwiftUI no tiene
delegate directo para `didRegisterForRemoteNotificationsWithDeviceToken`) puentea el token a
`FromServerService.registerDeviceToken()`. El logout ahora desregistra el token (`unregisterDeviceToken()`,
guardado en `UserDefaults`) **antes** de limpiar la sesión — pendiente de sesiones anteriores, resuelto.

**Bug real encontrado de paso**: `device_tokens.userId` no tenía `onDelete: cascade` — un usuario con
push registrado no podía borrar su cuenta (violación de FK). Corregido en `DELETE /auth/account`
borrando esas filas antes que el usuario. Detectado revisando el flujo de logout, antes de que
ocurriera en producción.

**Apertura automática al crear (iOS)**: crear una tarea (`IOSQuickTaskSheet`), una nota desde el "+"
(`IOSV2Shell.createNote()`), una grabación de voz (`toggleVoiceRecording()`) o usar "Captura rápida"
(`IOSSmartCaptureSheet`) ahora abre el detalle del elemento recién creado (`detailNode =`) en vez de
volver a la lista sin más — patrón `onCreated: ((Node) -> Void)?` añadido a ambas hojas de creación.

**Bug de UI encontrado durante la prueba en vivo**: la grabación de voz mostraba "✓ Guardado" incluso
cuando el transcript estaba vacío y no se guardaba nada (el caso `.error` de `VoiceCapturePhase` caía
en el mismo branch que `.processing`/`.idle`). Corregido para mostrar el mensaje de error real.

**Build 2.12 archivado, exportado y subido** a App Store Connect vía `altool` (UUID
`0ed9a107-43df-46ae-a76c-b354b8ebbbe6`, build 140 — Apple permite reutilizar el mismo número de build
en distintas versiones, confirmado viendo 2.10/2.11/2.12 todas con build 140 en TestFlight). **Crear
la versión y adjuntar el build sigue bloqueado**: 2.11 continúa "Pendiente de revisión" en Apple;
Alberto decidió esperar en vez de retirarla de la cola.

**Re-auditoría completa de las ~39 tareas de la sesión de paywall/free-tier** (server, web, iOS,
Mac) vía 4 agentes en paralelo verificando código real, no descripciones previas — prácticamente todo
confirmado. Hallazgos de la propia auditoría: (1) el target Xcode "From" (macOS nativo, Swift) está
abandonado a propósito — Sparkle.framework no se re-vendorizó tras borrarlo, sin relación con la app
Mac real (Tauri, `from-mac/`, que sí está verificada y publicada — v9.5.80); (2) la tabla de variants
de LemonSqueezy en `FROM.md` estaba desactualizada (Mensual y Anual habían intercambiado su variant
ID en algún momento sin actualizar la doc) — corregida; (3) el workflow de GitHub Pages
(`pages.yml`) no ejecuta `npm run build`, solo sube el repo tal cual — el bundle de `landing/app/`
depende de compilarse y commitearse manualmente en local antes de cada deploy, sin automatizar; (4)
la validación de recibos StoreKit (`appStoreServer.ts`) decodifica el JWS sin verificar su firma/
cadena x5c (documentado como mejora futura en el propio código) y cae a confiar en el cliente si
faltan las variables `APPLE_ASSA_*` en el entorno — confirmado que SÍ están configuradas en Railway.

---

## 🗓️ Sesión 2026-07-23 — Fix crítico key-prop (pérdida de datos), agentes predefinidos, QA en cuenta real

Web **v9.6.916 → v9.6.928**. Log: `logs/2026-07-23.md`.

**🔴 Bug crítico de pérdida de datos, root-caused y arreglado**: `V2ElementView`/`V2RightColumn` no
llevaban `key={nodeId}` en su punto de render — React reutilizaba la misma instancia al navegar
entre notas, y `useEditor()` de TipTap se recrea de forma asíncrona (un render por detrás) respecto
a los props, dejando una ventana en la que `editor` apunta a la nota vieja mientras `node.id`/`body`
ya son de la nueva. Confirmado en producción: dos notas diarias reales tenían su `body` sobrescrito
con contenido de otra nota. Fix: `key={centerElementId}` (`v2/V2App.tsx`) y `key={detailNodeId}`
(`v2/components/V2RightColumn.tsx`). Datos reparados a mano, verificados con `from_search`. Mismo
bug corrompió 3 agentes predefinidos (instrucción vacía) — reparados con el texto canónico de
`agentesHelper.ts`.

**Agentes predefinidos**: `ensureAgentesNode()` ahora siembra los 8 predefinidos con
`_agentEnabled: 'false'` (antes `'true'`) — coherente con los agentes creados por IA, que ya nacían
desactivados. Nuevo banner en `ElementsPanel.tsx` explicando cómo activarlos.

**Feature nueva**: "Crear documento con esta selección" en `DocEditor.tsx` — `DOMSerializer` de
TipTap serializa el `Slice` de la selección a HTML real, hereda contexto de la cita/nota de origen.

**Sidebar centraliza creación**: quitada la fila de botones de la cabecera del chat
(`V2Chat.tsx`) — el menú "+" de `V2Sidebar.tsx` ahora cubre Nota/Tarea/Evento/Lienzo/Drive/Grabar/
Subcontexto/Nuevo contexto (global).

**IA — contexto y recurrencia en tareas/eventos por chat**: `aiChatExecutor.ts` no asignaba el
contexto activo ni preservaba recurrencia en lenguaje natural cuando el modelo la limpiaba de su
propio título — fix en dos capas (título del modelo primero, mensaje original del usuario como
fallback solo para `.recurrence`).

**Otros fixes**: `window.prompt()` nativo en "Nuevo agente"/"Nuevo prompt" sustituido por
`NewNamedItemModal.tsx` (no automatizable por script, inconsistente visualmente); chip de
recurrencia ignoraba el intervalo (`TaskRow.recLabel` reescrito); layout CAL/título en Agenda-Día;
quitados timestamps y lápiz de contexto en notas diarias.

---

## 🗓️ Sesión 2026-07-14 (cont.) — Elementos: filtros, Contexto reordenado, selección múltiple, deshacer

Web **v9.6.815 → v9.6.820**. Log: `logs/2026-07-14-sesion2.md`. Continuación same-day tras
feedback en vivo de Alberto usando la app (capturas reales), no una nueva auditoría.

**Fix "Limpiar" en Elementos.** Solo limpiaba el texto de búsqueda (`setQ('')`); si no había
texto escrito —el caso típico, con solo un filtro de tipo activo— el botón no hacía nada
visible. Ahora resetea también `filter` y `taskSub`.

**Notas vacías huérfanas — el primer fix no bastaba.** El intento de la sesión 1 (un `Set` en
memoria rastreando qué notas creó `onNewDocument` en esa sesión) seguía dejando escapar
algunas — Alberto siguió viendo "Sin título" nuevos bajo Documentos personales. Reescrito sin
ningún rastreo: al cerrar CUALQUIER documento (`_doc`, no lienzo) con título Y cuerpo vacíos,
se descarta — por construcción, solo un documento nunca tocado tiene ambos vacíos a la vez, así
que es seguro sin depender de cuándo se creó. 6 huérfanos más limpiados; confirmado con consulta
SQL directa a toda la BD que la cuenta quedó en cero.

**"Lo que Fromly sabe" duplicado en Elementos.** `classifyElement()` clasifica cualquier nodo
con `_doc:'1'` como `'document'`, no `'note'` — el filtro que oculta notas sueltas
(`c.kind === 'note'`) no lo pillaba. Excluido explícitamente por `isContextKnowledge(n.text)`
en `V2ContextView.tsx`.

**Causa raíz real de que "Lo que Fromly sabe" nunca se autocompletara.** El efecto que la
actualiza (`V2App.tsx`) solo se disparaba al cerrar una nota editada A MANO en el detalle.
Todo lo que crea la IA por chat (`create_document`/`create_note` en `aiChatExecutor.ts` — la
mayoría del contenido real en un producto chat-first) nunca lo activaba. Extraído a
`maybeUpdateContextKnowledge()` en `cajones.ts`, compartida por ambos disparadores. Conocimiento
de Casa Alicante regenerado a mano desde sus elementos reales, sin inventar nada.

**Kanban/Calendario solo con el filtro Tareas.** No tienen sentido para notas, lienzos u otros
elementos — sin estado ni fecha que organizar en un tablero. `FilterViewSwitcher` gana
`allowBoardViews` (default `true`, no afecta al otro caller, `WFHomeView` de v1). Un
`useEffect` resetea la vista sola a Lista si cambias de filtro con Kanban/Calendario activo.

**Sub-filtro por CONTEXTO en Elementos.** Segundo nivel, para cualquier tipo (no solo tareas) —
mismo patrón visual que el sub-filtro de tareas. Los chips disponibles se calculan sobre lo
filtrado por tipo+búsqueda (capa `byTypeAndSearch` separada de `filtered`), no sobre lo ya
recortado por contexto, para que elegir un contexto no haga desaparecer los demás chips.

**V2ContextView reordenado.** Título del contexto arriba del todo (nuevo — antes no se
mostraba en ningún sitio de la tab) → fila padre+editar+archivar (sin cambios) → "Lo que
Fromly sabe" (antes al final, ahora justo debajo del título, sin cabecera ni fila de acciones
propia — `V2NoteBody` gana `hideToolbar`) → Tareas → Elementos.

**Tab Historial eliminada — fusionada con Elementos.** Era el mismo buscador global con el
filtro "conversación" implícito y sus elementos anidados debajo (ya visibles al abrir la
conversación en sí). `RightMode` pasa de 5 a 4 modos; limpiado el código muerto
(`sessions`/`bySession`/`standalone`/`topLevel` en `V2RightColumn.tsx`) y las claves i18n
huérfanas en los 12 idiomas.

**4 mejoras de UX** (propuestas tras el trabajo anterior, confirmadas por Alberto: "1 hazlo 2
hazlo 3 hazlo 4 hazlo"):
- Indicador "Actualizado hace X" sobre "Lo que Fromly sabe" — `fmtRelative()` nuevo en
  `utils/formatDate.ts` vía `Intl.RelativeTimeFormat` nativo (gratis en los 12 idiomas, sin
  diccionario propio).
- Toast discreto cuando "Lo que Fromly sabe" se autocompleta en segundo plano — antes era
  silencioso, sin forma de distinguir "está funcionando" de "no ha hecho nada".
- Selección múltiple en Elementos: checkbox por fila vía un overlay transparente que
  intercepta el clic sin tocar `TaskRow` (componente compartido con toda la app) ni las filas
  de evento/genéricas — funciona igual para los 3 tipos sin duplicar lógica. Eliminar en
  bloque con toast de confirmación.
- "Deshacer" al eliminar: `store.deleteNode()` pasa de `void` a devolver `string[]` (la
  cascada completa de ids borrados, no solo el nodo raíz) para poder restaurarla exacta con
  el nuevo `store.restoreDeleted()`. `Toast.tsx` gana soporte de botón de acción.

Todo verificado con `tsc --noEmit` limpio en cada commit. La verificación en vivo en
navegador para la selección múltiple no se pudo completar — el login del navegador embebido
de este entorno falló repetidamente (problema del propio sandbox, ya visto antes en la sesión
con código ya confirmado en producción, no una regresión de este cambio).

---

## 🗓️ Sesión 2026-07-14 — Pérdida de datos arreglada, contenido reescrito, MCP corregido, Elementos pulido

Web **v9.6.804 → v9.6.815**. Sesión larga con varios bloques independientes.

**Crítico: pérdida de datos real (notas "Sin título" + "Lo que Fromly sabe" borrado).** Alberto
detectó notas vaciándose al abrir varias desde la columna derecha de un contexto. Causa raíz:
`getOrCreateContextKnowledgeDoc`/`getOrCreateAgentInstructionDoc` migraban destructivamente cuando
el flag `extraData._doc` no se reconocía por un shadow de sync incompleto (reconstrucción parcial
desde otro dispositivo en `opsClient.ts`) — sin hijos-línea que leer, `.body` se sobrescribía a
`<p></p>`, borrando contenido real. Arreglado distinguiendo por el BODY, no solo por el flag: si ya
hay contenido real, nunca se toca (solo se repara el flag que falta). 9 notas huérfanas borradas y
"Lo que Fromly sabe" de Casa Alicante regenerado fielmente desde las fuentes intactas. De paso,
`shadowToNode()` tenía `createdAt`/`updatedAt` clavados a 1970 — corregido derivando el timestamp
real del HLC.

**UX: Planificador + columna Hoy juntos, botón Archivar reubicado.** El Planificador cubría toda la
columna derecha en vez de dejar la pestaña Hoy visible al lado para arrastrar tareas (comportamiento
de v1). `.v2-planner-overlay` pasa de `inset:0` a `right: var(--v2-right)`. Botón Archivar movido a
la fila de PERSONAL; fila de contexto + acciones fusionada en una sola.

**Reescritura completa de contenido de cara al usuario.** Todo el copy (mails de nurturing, blog,
web, manual) seguía describiendo el producto v1 (outliner-first) tras el pivote a chat-first del 8
de julio. Auditoría y reescritura de: ~35+34 posts de blog (ES+EN), landing/pricing/comparativas,
`MANUAL.md`/`MANUAL_EN.md` (1515→830 líneas, mecánica v1 movida a apéndice histórico), `i18n.js`
(diccionario runtime que sobrescribía el HTML corregido — 0 discrepancias verificadas
programáticamente). Fixes de precio reales: Lifetime €49→€149, Pro ~€10/mes→€7/mes, ahorro anual
30%→~42% (error de cálculo). Lifetime ahora concede 3.000.000 tokens al comprar (antes no concedía
nada) vía `addTokens(..., "license_grant", ...)` en el webhook de LemonSqueezy, idempotente
(`licenseGrantKey(eventId)`). Lifetime añadido como 3ª tarjeta en `PricingView.tsx` (in-app).
`requireTokens()` bloqueaba agentes en la nube a usuarios Lifetime-only (solo miraba
`subscriptionStatus`, no `licenseStatus`) — corregido.

**Las 52 plantillas de email de nurturing, traducidas a 9 idiomas.** Antes solo ES/EN. Añadidos
fr/de/zh/ja/pt/it/ko en `email-nurturing-XX.ts` (uno por idioma, agentes en paralelo). Bug real de
runtime encontrado y arreglado: dependencia circular entre `email-nurturing.ts` y los 7 archivos de
idioma (el principal importa `TEMPLATES_XX` de cada uno; cada uno importaba los helpers compartidos
de vuelta desde el principal) rompía en caliente con `Cannot access '...' before initialization` en
cuanto un archivo de idioma usaba un valor importado en una constante de nivel de módulo — solo se
manifestaba en ejecución real, no en `tsc`. Solución: helpers extraídos a `email-nurturing-shared.ts`
sin dependencias, todos importan de ahí, nadie importa de vuelta. Verificado con 468 combinaciones
(52 claves × 9 locales) sin fallos antes de desplegar.

**MCP: corregida una afirmación falsa sobre el directorio de Claude.** Ajustes → Claude (MCP),
`claude.html` y `MANUAL.md` afirmaban "ya disponible en el directorio oficial · conector verificado
de Anthropic" — Alberto lo buscó en Claude y no aparece; el envío (5 jun) nunca se confirmó como
aprobado. El servidor SÍ implementa un authorization server OAuth 2.0 completo e independiente de
cualquier directorio (`/.well-known/oauth-authorization-server` + `/auth/claude/authorize` +
`/token` sobre el endpoint `/mcp`) — exactamente lo que necesita "Añadir conector personalizado" en
Claude. Copia reescrita (12 idiomas + claude.html + manual) para guiar a ese flujo en vez del
directorio no confirmado, con la URL del MCP visible y copiable en Ajustes.

**Elementos: fecha visible + orden, creación de agentes/prompts sin chat.** Pedido explícito de
Alberto que nunca se había implementado (solo se arregló el bug de datos subyacente): cada fila
ahora muestra su fecha (tooltip con creación+modificación completas), icono nuevo junto al buscador
para ordenar por modificación/creación/título (`utils/formatDate.ts` centraliza el formato). Botón
"+ Nuevo agente"/"+ Nuevo prompt" visible al filtrar por esos tipos — antes crear un agente sin
chat no era posible en ningún sitio de la interfaz, y crear un prompt exigía encontrar un icono
escondido en el composer.

**Notas vacías huérfanas (no era el bug crítico de arriba).** Alberto reportó 12 notas "Sin título"
más bajo Casa Alicante. Verificado en BD que ninguna tuvo nunca contenido real (body vacío desde su
`created_at`) — causa distinta: el botón "+Nota" (cambiado ayer, commit `b2530c73`, a crear y abrir
una nota en blanco al vuelo) no limpiaba la nota si el usuario no escribía nada y navegaba a otro
sitio. Ahora, al cerrar una nota creada así (sin plantilla) que sigue completamente vacía, se
descarta sola — solo afecta a notas creadas en esa sesión, nunca a notas existentes. Los 12
huérfanos movidos a la papelera; confirmado por consulta directa a toda la BD que no hay más
orphans de este tipo en ningún otro contexto de la cuenta.

Todo verificado con `tsc --noEmit` + `npm run build` limpios en cada commit, servidor con `bun test`
(74 pass) + verificación real de contenedor en Railway ("Starting Container").

---

## 🗓️ Sesión 2026-07-13 (cont.) — Agentes probados en vivo, 4 bugs reales más

Web **v9.6.801 → v9.6.804**. Tras el primer cierre de sesión, Alberto creó un agente real
("Informe de Mercado Diario") y probó el flujo completo, encontrando 4 problemas más:

- **Instrucción del agente en `Outliner`** (viñetas de lista) en vez de documento — cambiado a
  `DocEditor` normal. `getOrCreateAgentInstructionDoc()` migra automáticamente el contenido de
  agentes ya existentes (formato antiguo de hijos-línea) la primera vez que se abren, sin perder
  la instrucción ya escrita.
- **Prompts de agente demasiado vagos**: la IA redactaba instrucciones tipo "genera el informe de
  mercado" sin detalle suficiente para un buen resultado. `create_agent`/`update_agent` ganan una
  regla explícita en `server/src/routes/ai.ts` con checklist (fuentes exactas, cifras concretas por
  sección, formato y longitud del resultado) + un ejemplo mal/bien basado en el caso real de
  Alberto, para calibrar al modelo.
- **Resultado del agente troceado en outliner**: `AgentPropertiesPanel.handleRun()` (ejecución
  manual) y `writeAgentResultToDiary()` en `server/src/services/serverAgenda.ts` (cron programado)
  creaban un nodo por línea del resultado, siempre bajo el diario de hoy. Ahora ambos crean UN
  documento (`markdownToHtml` del resultado, formato real) colgado del `parentId` real del agente
  (su contexto), con fallback al diario solo si el agente no tiene padre.
- **"Lo que Fromly sabe" y "Notas" unificados**: en `V2ContextView.tsx` había un `<textarea>`
  estrecho ("Lo que Fromly sabe", hijos-línea vía `readContextKnowledge`/`writeContextKnowledge`)
  y, separado, un editor de nota completo ("Notas", `getOrCreateContainerNotes`). Alberto: "creo
  que deberíamos unir una cosa con la otra... que se pueda ampliar, escribir con comodidad, poner
  cabeceras". `cajones.ts` gana `getOrCreateContextKnowledgeDoc()`: el nodo de conocimiento pasa a
  ser un documento (`.body` HTML), migrando el formato antiguo automáticamente y fusionando
  cualquier contenido que ya existiera en el bloque "Notas" separado (sin pérdida). `enrichTag()`
  en `aiChatStore.ts` sigue funcionando igual — `readContextKnowledge()` mantiene su firma `string`.

Todo verificado con `tsc --noEmit` + `npm run build` (el build en modo proyecto sacó 4 errores de
tipo — `store.createNode()` sin el campo `text` requerido — que el `tsc` suelto no detectó; ya
había pasado antes en la sesión, corregido cada vez) + `build:tauri`, 12 idiomas con paridad
exacta, deploy de servidor verificado con "Starting Container" en Railway.

---

## 🗓️ Sesión 2026-07-13 — Agentes+Prompts en v2, RAG verificado, 3 bugs reales de raíz

Web **v9.6.789 → v9.6.801**. Log: `logs/2026-07-13.md`. Auditoría profunda de Fromly 2.0 a
petición de Alberto, ejecutada en piezas SECUENCIALES (no en paralelo — feedback explícito de
Alberto sobre forma de trabajo, guardado en memoria), cada una verificada (`tsc`+`build`+
`build:tauri`+12 idiomas con paridad) y desplegada antes de pasar a la siguiente.

**Sistema de Agentes portado a v2** (`utils/agentesHelper.ts`, `V2AgentDetailView.tsx`). En v1 los
agentes cuelgan de un root único `🤖 Agentes`; en v2 ganan contexto padre libre
(`createAgentUnder({parentId,...})`, `isAgentNode(n)` mira `_agentDef` directo sin depender del
padre) — visibles en Elementos y fusionados en la vista de Contexto. **Bug real**: el editor de v2
mostraba `getOrCreateContainerNotes(node.id)` vía `V2NoteBody`, pero el prompt REAL del agente son
sus HIJOS DIRECTOS (`readAgentNote()`/`syncAgentUserMessage()` en `agentesHelper.ts`) — un nodo
completamente distinto, así que el editor aparecía vacío y desconectado de lo que el cron
realmente ejecuta. Corregido con `Outliner parentId={node.id}` (mismo patrón que
`V2PromptDetailView`, que sí lo hizo bien desde el principio). Nuevas acciones de IA `create_agent`
(siempre `enabled:false` al crear) y `update_agent` (activar/pausar/reprogramar/editar prompt por
chat — antes la IA decía "activado" sin que ocurriera nada real).

**Sistema de Prompts portado a v2** (`utils/promptsHelper.ts`, `V2PromptDetailView.tsx`) — mismo
patrón exacto que Agentes (root único en v1 → contexto libre en v2, `isPromptNode`/
`createPromptUnder`/`listAllPrompts`). Desplegable "⚡ Prompt" en la cabecera del chat: seleccionar
uno resuelve variables (`resolvePrompt`) y envía directo, sin paso intermedio.

**Bug de migración real — `getTagDefNode()` (`nodeStore.ts`)**: seguía buscando la raíz de
contextos por su nombre histórico (`'🏷 Tags'`), migrada hace tiempo a `'🧠 Contexto'` — nunca
encontraba el contexto real, así que "Lo que Fromly sabe" nunca llegaba a inyectarse en el chat
(`enrichTag()` en `aiChatStore.ts`) aunque la lógica de inyección en sí fuera correcta. Síntoma
reportado por Alberto: un contexto recién creado por la IA (nueva acción `create_context`) abría su
primera conversación con saludo genérico, sin continuidad con lo acordado. Arreglado reconociendo
ambos nombres de root + normalizando por slug; `create_context` ahora exige un campo `about`
(resumen de 1-3 frases) que se siembra vía `appendContextFacts` al crear.

**RAG verificado con datos reales, no solo lectura de código.** Confirmado en producción:
`server/src/services/ragNodes.ts`, Postgres dedicada + pgvector + Voyage, indexado automático
incremental vía hook del op-log (`enqueueReembed`, debounce 8s) — cualquier cambio reindexa solo.
Búsqueda semántica real (`/admin/rag-query`) contra la cuenta de Alberto con la query "trading
mercado" devolvió resultados correctos y relevantes de sus contextos reales. La subida de archivos
a R2 es un paso independiente y previo al indexado — un fallo del RAG nunca implica pérdida de
datos.

**Conversaciones/Lienzos como elementos.** Conversaciones fusionadas con el resto de Elementos
(antes bloque aparte en la vista de Contexto). Lienzo separado de Documento como tipo propio
(`_v2canvas`), con rejilla de miniaturas reales (`PizarraThumbnail.tsx`, SVG a escala de
strokes/texts) en vez de lista de títulos indistinguibles.

**Bug real — Nota/Lienzo se pisaban al cambiar de modo.** Compartían el mismo `body` del nodo (uno
como HTML, otro como bloque ```from-pizarra```); el toggle no guardaba/restauraba nada al cambiar
de modo, así que abrir Lienzo y volver a Nota dejaba el JSON del lienzo como texto plano (incluso
como título). Fix intermedio: guardar/restaurar por modo en extraData. Fix final (a petición
explícita de Alberto): el propio TOGGLE se elimina — Nota y Lienzo son tipos separados desde su
creación (botones "+Nota"/"+Lienzo"), ya no intercambiables en un documento existente.

**Bug real — `firstLineTitle()` devolvía `'Documento'` para contenido vacío** (`utils/docNode.ts`).
Un efecto de `DocEditor` ("sanear título al abrir") escribía ese fallback como `text` real nada más
crear un documento en blanco, antes de que el usuario escribiera nada. Corregido: la función
devuelve `''` (todos los llamadores ya encadenaban con `||` esperando exactamente eso). Además:
"+Nota" volvía a abrir siempre un menú de plantillas en vez de crear directo (con una nota abierta
parecía "no pasar nada") → botón partido (clic=crear, flecha=plantillas); autofocus al inicio del
documento al crear.

**i18n — causa raíz real, no cosmética.** 124 claves de v2 usadas en código con
`t('clave','fallback')` no existían en NINGÚN idioma (ni español) → siempre se veía el fallback
español sin importar el idioma elegido. `classifyElement()` (Historial/Contexto) descartaba
cualquier nodo con `text` vacío (un documento recién creado nace así) — quitado ese filtro.

**Paridad v1→v2 adicional**: Ajustes completados (email, acento, backups, pestaña Accesorios,
expansión de texto), Planificador con acceso desde el chat, vistas globales Tabla/Kanban/Calendario
en Elementos, gestión de plantillas, slash-commands en el editor nuevo, `RightColMenu` con
Duplicar/Mover a, micrófono de dictado en vivo (Alt+Espacio).

**2 auditorías de regresión independientes** (mismo resultado: sin problemas) confirmaron que los
cambios en paralelo sobre archivos compartidos (`V2ContextView.tsx`, `ElementsPanel.tsx`,
`aiChatStore.ts`, `aiChatExecutor.ts`) no se pisaron entre sí.

---

## 🗓️ Sesión 2026-07-09 (cont.) — Bug crítico «Documento», Agenda=Hoy, Notas con editor completo

Web **v9.6.771 → v9.6.787**. Log detallado: `logs/2026-07-09-bug-documento-agenda-notas-editor-completo.md`.

**🔴 Bug crítico resuelto: tareas/eventos se corrompían a «Documento» al abrirlos.**
Causa raíz: `V2DetailView` no tenía ruta propia para tarea/evento → caían en `V2NoteBody` (editor de
documento genérico) con `body` vacío; el `DocEditor` calculaba `firstLineTitle('')`='Documento' y lo
GUARDABA como el `text` real del nodo en su próximo auto-guardado, perdiendo el nombre original para
siempre. Fix de raíz + 3 redes de seguridad: (1) nueva vista `V2TaskDetailView` (checkbox + chips
fecha/hora/repetición + contexto + Notas aparte, sin caer nunca en el editor de documento); (2)
`DocEditor.keepsOwnTitle()` ampliado a proteger también tareas/eventos (antes solo notas diarias);
(3) `DayColumn` auto-repara el título de un día si llegó corrompido, sea cual sea la función que lo
trajo (`ensureDayPath`, `store.todayDiary()`, `getTodayDiaryUnderAgenda()`). **Los nodos ya
corrompidos antes del fix no son recuperables** (título original sobrescrito y perdido). Auditoría
con MCP tras el fix: 12 nodos afectados con `bodyLen:0` (1 tarea, 3 «contexto» dentro de
transcripciones, 6 «documentos» bajo el lienzo raíz, 1 de bajo impacto) — Alberto los identifica/
renombra a mano.

**Rediseño Agenda=Hoy.** El día visto desde la tab Agenda pasa a ser IDÉNTICO al de la tab Hoy: el
mismo `DayColumn`, sin «Volver al año» (redundante con clicar la tab), sin toggle colapsable, sin
inputs de alta rápida — «Eventos de hoy»/«Para hacer» llevan un «+» en su propia cabecera (modal
real), cabeceras siempre visibles. Nota de escritura libre al final de todo. `NewEventModal` gana
`parentId`/`defaultDateStr` (antes siempre colgaba de HOY) + `onCreated` (evita navegar fuera de
`/app/v2` con React Router — bug latente que también tenía el botón +Evento del chat).

**TaskRow único.** Existían 4 copias independientes de la fila de tarea (Hoy, otros días, Elementos,
Contexto v2), cada una con piezas distintas. Unificadas en `components/panels/TaskRow.tsx`:
checkbox + texto + chips hora/día/repetición + contexto + hover — un solo componente para las 4
vistas.

**Notas: de casilla de texto a editor real.** Primera pasada (get-or-create de un nodo `_doc` +
`DocEditor` compact) resultó insuficiente para Alberto («quiero el mismo editor que cualquier
nota»). Se exportó `V2NoteBody` (el componente real que abre cualquier nota: toggle Nota⇄Lienzo,
favorito, exportar, publicar, barra de formato completa) con un prop `inlinePage` para vivir dentro
de una página más larga sin depender de `height:100%`. Reutilizado tal cual (mismo componente, cero
duplicación) como sección «Notas» de Contexto/Conversación/Tarea. Prop `hideContext` suprime el chip
de contexto del propio editor cuando ya se muestra arriba en esa misma vista (evita redundancia).

**Drag-and-drop de archivos unificado.** Bug: soltar un archivo en el chat funcionaba, en la sidebar
de contextos daba error (dos rutas de código distintas, una rota). Unificado en una sola ruta
(`onFilesDropped`): con conversación activa se adjunta ahí, sin conversación se importa al
contexto/día activo — sea cual sea la superficie donde se suelte. Nuevo «Quitar de esta
conversación» (reparenta sin borrar, sigue en el RAG).

**PDF — anotación estilo Heptabase.** Subrayado visual persistente: al guardar una selección de
texto se capturan sus rects normalizados (`Range.getClientRects()`) y se pintan como marca amarilla
translúcida sobre la página (mismo SVG que las anotaciones de pluma). Recorte de región: modo de
arrastre que recorta directamente del `<canvas>` renderizado y sube el resultado como imagen,
colgada del PDF de origen.

**Consistencia UI**: contexto navegable + editable en cualquier recurso (PDF/imagen/audio/enlace,
no solo nota/tarea); contexto padre asignable desde la columna derecha (`reparentContext`, ya
existía en `cajones.ts` sin UI en v2); fila redundante quitada del visor de recurso (título ya
arriba); toggle Nota/Lienzo restyled al mismo estilo sutil que el resto de acciones, con anchura
fija igual para los dos botones; Historial oculta sesiones de «solo comando» (1 turno, sin valor
conversacional) sin borrarlas.

---

## 🗓️ Sesión 2026-07-09 — v2 afinado + limpieza masiva + capacidad MCP completa

**MCP / conector Claude (`server/src/routes/mcp.ts`).**
- **Robustez de escritura**: se sustituyó el patrón de N inserts secuenciales (uno por nodo; ~40 en un árbol) por **bulk insert atómico** (`bulkInsertNodes`). Los inserts secuenciales, al superar el timeout del tool, quedaban huérfanos y agotaban el pool de conexiones (max 10) → el server dejaba de responder incluso a lecturas. Además: **pool 10→20** (`db/client.ts`), **timeout de tool 15→25s**.
- Nuevas tools: **`from_upload_file`** (sube el archivo REAL en base64 a R2 como nodo-recurso), **`from_delete_node`** (a la Papelera, reversible, lote). `from_search`/`from_list_nodes` ahora devuelven **snippets** (antes bodies enteros → desbordaban al cliente) con `kind`, `parentId`, `bodyLen`, `childCount`, `total`, paginación `offset` y filtros `contains`/`parentId`; excluyen la Papelera.
- **Notas en formato DOCUMENTO**: `from_create_node`/`from_create_tree` crean `_doc` con `body` HTML (markdown→HTML), ya no listas de bullets.
- Centinelas en `from_update_node` (`parentId="__papelera__"`, `"__purge_dryrun__"`, `"__purge_fragments__"`) para operar/limpiar desde una sesión MCP cuya lista de tools se cacheó antes de existir los tools nuevos.

**Limpieza de datos.** `toolPurgeFragments` (con dry-run) movió ~954 fragmentos heredados de la migración (párrafos/títulos sueltos sin cuerpo ni hijos) a la Papelera — vault 6.500→5.546 nodos. Reversible. Protege documentos, contextos, conversaciones, tareas, eventos, PDFs y la estructura del calendario.

**Papelera = lápida (24 ago 2026).** Hasta esta fecha, borrar solo reparentaba a `🗑 Papelera`
y el nodo seguía "vivo" (`deletedAt` nulo, `status`/`due` intactos): cada lista de la app tenía
que recorrer ancestros (`isInPapelera` / `IOSTrashScope` / `idsInTrash`) para descartarlo, y
bastaba que una se olvidara para enseñar borrados — le pasó a la agenda del iPhone, que mostraba
tareas de la papelera como pendientes. Motivo del cambio (Alberto): "¿cómo debería funcionar
esto en una app de notas y tareas? hazlo más duro para que NADA en papelera se filtre en ningún
lugar".

Ahora **borrar escribe `deletedAt`** además de reparentar (web `trashNode`, servidor
`nodeActions.moveToTrash`, MCP `toolDeleteNode`/`toolPurgeFragments`), así que el filtro
`deletedAt == null` que ya existe en todas partes basta por sí solo. `restoreNode` quita la
lápida; `emptyTrash` marca `_purgedAt` (purga lógica: deja de listarse y de poder restaurarse,
el registro se conserva en la base por si hace falta un rescate desde backup). La Papelera
(`V2Trash`, `trashItems()`) es ahora una vista sobre nodos con lápida, no una ubicación especial.

Red de seguridad: `sweepTrashTombstones()` (`server/src/lib/trash.ts`), cron horario que le
pone lápida a cualquier nodo que siga vivo bajo una raíz de papelera real (cliente viejo, fallo
futuro) y emite las ops. Los recorridos por ancestros (`isInPapelera`, `IOSTrashScope`,
`idsInTrash`) se mantienen para datos escritos antes de esta fecha, pero dejan de ser la única
defensa. Purgado inicial: 6.365 nodos con lápida (incluidas 227 tareas fantasma) en la papelera
de producción de Alberto; 17 tareas pendientes reales quedaron en el sistema.

**Fromly 2.0 (web).**
- Conversaciones fuera de Elementos/Buscador (viven en Historial). `isInPapelera` sigue existiendo para datos antiguos, pero desde el 24 ago 2026 `trashNode` **SÍ pone `deletedAt`** al reparentar — ver "Papelera = lápida" más abajo.
- Adjuntar PDF: sube a R2, nodo-recurso, toast + aviso en el chat, miniatura de la 1ª página en Contexto (usa `resourceKey` porque R2 es privado), línea en Historial. Subir sin conversación NO crea chat (importa a Fromly). Arrastrar a la columna de contextos = "Importar a Fromly" (placeholder) vs "Importar a la conversación".
- Markdown en el chat (`renderInline`); visor PDF real en el detalle (`PdfContainer`) con selección/subrayado; subrayados guardados = tipo `highlight` (listados en Elementos).
- Tab contexto muestra TODOS los elementos (incl. PDF de conversaciones-miembro); nota diaria = editor documento + quick-add tarea/evento (sin bullets); contexto asignado visible y editable en el detalle (coordinado con Historial).
- **Columna Hoy compacta**: tareas de una línea (texto truncado + fecha + chip de contexto al lado); "Para hacer" plano, sin cabeceras de contexto.

---

## 🗓️ Sesión 2026-07-06 — Calendario FUERA del lienzo + cada día = su propio lienzo

**Cambio de modelo del calendario.** El calendario deja de vivir en el lienzo infinito de contextos.
Motivo: mezclar el zoom CONTINUO del lienzo con la rejilla DISCRETA del calendario hacía que un texto
escrito con zoom alejado abarcase varios días y que las celdas creciesen con el contenido.

Fue una sesión iterativa (v9.6.705→716); el DISEÑO FINAL (v9.6.716) es:

- **Dos superficies separadas.** (1) **Lienzo de contextos** = plano infinito único de contextos/
  ideas (ruta `/`), sin calendario. (2) **Días** = cada día es su propio lienzo.
- **Cada día = su propio lienzo.** `NodeView.viewKind`: una nota diaria abre como **pizarra** por
  defecto (`viewBlock` vacío → pizarra para `isDiaryEntry`; `viewBlock==='lista'` explícito fuerza
  lista). `PizarraView.readSavedCam`: para diarias, **escala SIEMPRE 1** al entrar (conserva pan,
  nunca la escala) → tamaños consistentes entre días.
- **Barra superior con 3 botones de superficie** (`WFTopBar`, siempre visibles): 🌍 **Lienzo**
  (`navigate('/')`, `active` en el lienzo de contextos) · 📆 **Hoy** (`from:set-day` → lienzo del
  día de hoy) · 📅 **Calendario** (toggle `from:toggle-yearcal`).
- **Calendario ANUAL en la columna derecha** (`YearCalendarPanel`, `rightPanel:'yearcal'`): 12
  mini-meses en grid 3×4, días pequeños, puntos en días con contenido, navegación de año (‹ ›).
  Clic en un día → `from:set-day` → viaja a ese día (vuelve la columna del día + el lienzo).
- **Página mensual ELIMINADA.** `TemporalCanvasView` ya no se usa: abrir la raíz 📅 Agenda o un
  nodo Año/Mes REDIRIGE al lienzo de hoy (useEffect en `NodeView`, antes del early-return para no
  romper el orden de hooks). Se quitó el «dive» zoom-out diaria→agenda de `PizarraView`.
- **Limpieza.** Fuera de `nestedCanvasLayout.ts`: `computeAgendaGrid`, constantes `DAY_*`/
  `REGION_GAP`, campos `dayCells/dayContentIds/todayId`. Fuera de `PizarraView`: estado `region` y
  el render de celdas de día. Eliminado `DayTimeline` (fase intermedia). Quedan HUÉRFANOS (sin uso,
  no borrados): `TemporalCanvasView.tsx`, `MiniCalendar.tsx`.
- **Breadcrumb del lienzo vacío** (sin «Hoy·fecha»); en la Agenda se ocultan las acciones de nota
  (favorito/contexto/publicar/···) y el header (`isAgendaRoot||temporalCalendar` en `.node-title-row`).
- +11 claves i18n `dayNav.*` ×12 idiomas. Verificado en Chrome (prod, datos reales). Web v9.6.704 →
  **v9.6.716**. Detalle: `logs/2026-07-06-calendario-fuera-lienzo-dia-lienzo.md`.

---

## 🏛️ Sesión 2026-06-07 — HITO: Sync por operaciones (op-log estilo WorkFlowy)

**Cambio de arquitectura mayor.** Fromly migra de sync-por-estado (el servidor comparaba el árbol
entero y deducía borrados → causa del incidente 5-6 jun) a **sync por operaciones**: el op-log
append-only es la fuente de verdad y el servidor **nunca infiere un borrado**.

- **Servidor:** motor `lib/ops.ts` (HLC, applyOp/replay, LWW por campo, tombstones, no-ciclos); `lib/opsLog.ts` (`emitOpsForNodes`, materialización, compactación). Endpoints `GET /ops/bootstrap` (carga inicial, misma forma que /sync, solo lectura), `POST /ops/push`, `GET /ops/pull`, `GET /ops/state`, `GET /ops/config`. `POST /sync` neutralizado → alias read-only. `OPS_LIVE_ALL=true` (global). `POST /admin/ops-compact` race-safe.
- **Clientes (web/Mac/iOS):** `bootstrapLoad()` desde `/ops/bootstrap`, escritura por `/ops/push`, deltas en tiempo real por `/ops/pull`. Motor copiado byte-a-byte (web `opsClient.ts`, iOS `Ops.swift`). Fix del "parpadeo" aplicando deltas en vez de reconstruir el árbol. Test headless `bootstrapLoad.test.ts` (4/4).
- **MCP + agentes** propagan al op-log vía `emitOpsForNodes` → cambios en tiempo real.
- Detalle completo del hito y la lección (2 intentos nocturnos fallidos → uno diurno con test): `logs/2026-06-07-hito-sync-operaciones.md`.

---

## Sesión 2026-05-25 sesión 7 — Sistema de Recursos + tags + fixes (v7.32→v7.48)

### Sistema de Recursos (feature mayor)
- Servidor: `GET /unfurl?url=` — Open Graph + YouTube oEmbed (`server/src/routes/unfurl.ts`)
- Cliente: `api/unfurl.ts`, `panels/ResourcePanel.tsx`, `views/ResourcesView.tsx`
- Store: `allResources()`, `linkedTasks(nodeId)`
- Auto-detect URL en título de NodeView y texto de OutlinerNode → marca recurso + unfurl
- Tipos: url, youtube, book, podcast, document
- Estados: pending / consuming / done / archived
- Tareas asociadas: hijas del nodo recurso (parentId = node.id)
- Indicador visual: checkbox cian (`task-sq--resource` `#06b6d4`) en outliner inline y título de NodeView
- TaskPropsPopover extraído a componente compartido
- ResourcesView: layout 2 columnas (centro + sidebar 440px con filtros)
- Bloque "Recursos" en DiaryRightPanel agenda

### Sistema de tags
- `handleTitleInput` (NodeView) y `handleInput` (OutlinerNode): auto-extracción de #tags → types[]
- `allUsedTags()`: escanea también títulos para retrocompatibilidad
- `InlineRenderer`: `getTagColor()` → `store.tagColor()` con inline style
- Reactividad: cambiar color de tag actualiza todos los chips en tiempo real
- DiaryRightPanel: `renderInline()` para tareas y seguimiento — chips coloreados

### Eventos inline
- Task badge condition: `&& !node.isEvent` para evitar doble badge
- Eventos creados con `status: null` (no 'pending')
- `useEffect` detecta transición a isEvent → auto-open popup de fecha

### Atajos IA
- Espacio al inicio de bullet vacío → IA inline
- ⌘K → chat IA global (no ⌘J/⌘Space como decía antes)
- Onboarding, KeyboardShortcutsModal y placeholders corregidos

### Fix crítico de versioning
- `sed -i ''` fallaba silenciosamente desde sesión 5
- Versión real estaba en v7.32 aunque el código avanzaba
- Cada bump ahora usa `Edit` directo en StatusBar.tsx
- index.html con meta no-cache para mitigar caché CDN

---

## Sesión 2026-05-25 sesión 5 — Google Calendar + Tags + UI (v7.31→v7.32)

### Google Calendar OAuth fix
- `404.html`: `var fullSub = sub + window.location.search` — incluye query params OAuth en el redirect
- `App.tsx`: ruta callback `/app/google-callback` → `/google-callback` (BrowserRouter basename ya descuenta `/app`)
- Tras conectar: `window.location.replace('/app/')` para hard reload y refetch de eventos

### Google Calendar en CalendarView
- Servidor: `GET /google/calendar/events/range?start=YYYY-MM-DD&end=YYYY-MM-DD`
- Cliente: `getCalendarEventsRange(start, end)` en `api/googleCalendar.ts`
- `WeekView`: prop `googleEvents`, filtra por día, renderiza en azul (`.calendar-event-block--gcal`)
- Sidebar: indicador Google con punto verde/rojo, navega a Ajustes

### Eventos — UX
- `NewEventModal`: hora opcional, todo el día por defecto
- Creación correcta: `isEvent:true` (no `isTask:true`)
- Shortcuts (`-e`, slash `event`, command palette): añaden `due` = hoy si sin fecha
- `NodeRightPanel` evento: `hasLocalTime()` controla visibilidad de hora y fin

### NodeView — icono en título
- Tarea: checkbox cuadrado (amarillo/naranja/verde/azul según estado) — reemplaza circulo
- Tag de definición: `#` en color del tag
- Lógica unificada en un IIFE en el render del título

### Agenda diaria
- `formatDue`: medianoche → "Hoy"
- `AgendaTaskRow`: prop `parentNote` — nota contenedora junto al título
- `getParentNote()`: omite si padre es nota diaria o raíz

### Sistema de tags
- Clic en tag → nodo de definición (`_tagDefinition` en extraData) o crea uno
- `TagNodesPanel`: panel derecho para nodos de definición — filtros + orden + color picker
- Menú contextual (clic derecho): renombrar, color, eliminar
- Store: `getTagDefNode`, `deleteTag`, `renameTag`, `setTagColor`, `tagColor` con custom color
- Regex: `#([\wÀ-ɏ/\-]+)` — soporta guión y barra en nombres de tag

---

## Sesión 2026-05-25 — Eventos, drag & drop, hora opcional (v7.13 → v7.29)

### Eventos con Google Calendar (CRUD completo)
- **Servidor** (`server/src/routes/google.ts`): añadidos endpoints `PUT /google/calendar/events/:id` y `DELETE /google/calendar/events/:id`
- **Cliente API** (`api/googleCalendar.ts`): `updateCalendarEvent`, `deleteCalendarEvent`, `fromRecToRRule` (convierte `weekly:2` → `RRULE:FREQ=WEEKLY;INTERVAL=2`)
- **NodeRightPanel**: panel de evento con auto-sync silencioso al cambiar cualquier campo (debounce 1.2s)
- **OutlinerNode**: badge interactivo con popup completo + auto-sync (debounce 900ms)
- **DiaryRightPanel**: eventos GCal en Agenda con editor inline + Timeline con click-to-edit
- **Storage**: `gcalEventId` y `location` en `extraData` del nodo

### Repetición flexible
- Modelo: misma string format que tareas (`daily:N`, `weekly:N`, etc.)
- UI: fila `[–] [n input] [días] [sem.] [meses] [años]`
- Aplicada en tareas (popup quick-props + panel) y eventos (popup + panel)
- Conversión a RRULE para Google Calendar al sincronizar

### Drag & drop en Agenda
- Variable módulo `_agendaDragId` para state durante el drag
- `AgendaTaskRow`: `draggable={true}` + handlers `onDragStart/Over/Drop`
- Función `dropAsChild(draggedId, parentId)` mueve el nodo como último hijo
- Filtros `hasTaskParent()` + `hasSeguimientoAncestor()` excluyen tareas hijo de listas planas
- Render con `React.Fragment` para mostrar hijos indentados bajo cada tarea

### Timezone fix (`utils/dates.ts`)
- `isoToLocalDate(iso)` y `isoToLocalTime(iso)`: usan `getFullYear/getHours` del objeto Date → hora local del navegador
- `hasLocalTime(iso)`: true si hora local ≠ 00:00
- `makeDueISO(date, time)`: si time vacío, usa medianoche local (= "solo fecha")
- Aplicado en todos los inputs date/time de NodeRightPanel, OutlinerNode, NodeView, DiaryRightPanel

### Hora opcional
- Por defecto las tareas y eventos se crean sin hora (solo fecha)
- Time input muestra vacío cuando `hasLocalTime` es false
- Botón `✕h` para quitar la hora manteniendo la fecha

### Otras mejoras importantes
- **Eliminar nota**: borra recursivamente todos los descendientes + navega a hoy con `replace:true` (evita React error #300)
- **Mover nota**: opción "Hoy" como primera, eliminada opción "Raíz"
- **Atajos**: eliminados ⌘N/T/E/R/Q (conflicto con Chrome); se mantiene ⌘K
- **CSS opaco**: `var(--bg-card)` (no definido) → reemplazado por `var(--bg-secondary)` en todos los popups
- **Layout**: panel derecho con `flex: 1` + `align-self: stretch` → ocupa toda la altura
- **Tag picker en el título**: detección de `#query` en `handleTitleInput` con portal de picker

---

---

## Política de desarrollo multiplataforma (a partir de 2026-05-20)

**A partir de esta fecha, todos los desarrollos deben hacerse para Mac Y Web simultáneamente, y para iOS si aplica.**

### Plataformas activas

| Plataforma | Repo | Stack | URL/Distribución |
|---|---|---|---|
| **Mac** | `from-app` | SwiftUI + SQLite + Sparkle | fromly.app (descarga DMG) |
| **Web** | `getfrom-app` | React 18 + Vite + TypeScript | fromly.app/app |
| **iOS** | `from-app` | SwiftUI + SQLite + App Store | App Store (pendiente) |
| **Server** | `from-server` | Hono + Bun + PostgreSQL | Railway (from-server-production) |

### Reglas de paridad

1. Cualquier feature nueva en Mac debe evaluarse para Web (y viceversa)
2. Los features de IA (inline, agentes, grabación) deben estar en ambas plataformas
3. La documentación (MANUAL.md, DOCUMENTACION.md) refleja todas las plataformas
4. La landing page (fromly.app) tiene accesos e información a las tres plataformas

### Accesos a plataformas en landing
- fromly.app → Mac (descarga DMG)
- fromly.app/app → Web
- fromly.app/claude → Extensión MCP para Claude
- fromly.app/pricing → Precios (único para todas las plataformas)

---

## Changelog

### Web 1.0 — 2026-05-20

**Plataforma: Web** (fromly.app/app)

**Nuevo:**
- Sidebar con 4 tabs: Tags, Fijados, Paneles, Ajustes
- Panel derecho en diario: Pendiente + Timeline del día
- Panel contextual en notas: subtareas, áreas relacionadas, backlinks
- Colores en tags inline (#palabras con 8 colores deterministas)
- Filtros en Tareas: prioridad, estado, ordenación (persistidos en localStorage)
- Diario navegable: botones ← → para ver días anteriores
- Recurrencia en tareas: diaria, semanal, mensual, anual
- Onboarding: 4 pasos para usuarios nuevos
- Indicador de sync animado en esquina inferior derecha
- Grabación de voz → nota (Web Speech API, Chrome/Edge)
- ⌘T nueva tarea · ⌘E nuevo evento · ⌘R grabar voz · Escape → hoy
- Publicar nota con URL pública real (fromly.app/p/SLUG)

**Arreglado:**
- Paneles del sidebar pre-rellenan la búsqueda correctamente
- Panel contextual de notas aparece a la derecha
- Layout del diario con altura correcta en todos los navegadores
- Botón Share publica en servidor y devuelve URL pública real

---

### v3.12 / Web 1.0 — 2026-05-20

**Plataformas: Mac + Web + iOS**

**Mac 3.12**
- Login con email/contraseña + Google Sign-In (además de Apple ID)
- Precios actualizados: Free, Pro €7/mes, Anual €49/año, Lifetime €149
- Checkout sin cuenta: guests van directo a LemonSqueezy, webhook crea cuenta automáticamente

**Fromly Web** (nuevo — fromly.app/app)
- Editor outliner completo: jerarquía, Tab/indent, collapse, tipos de bloque
- Markdown inline: bold, italic, code, strike, links
- Slash menu (/), Cmd+K command palette, Cmd+N nueva nota
- Vista Tareas (secciones por fecha), Calendario semana, Kanban
- Panel propiedades: estado, prioridad, fecha, tipo
- AI inline (Cmd+Space): streaming Claude Haiku en el editor
- Adjuntar archivos (R2), compartir nota (copy link)
- Sidebar 4 tabs: Tags, Fijados, Paneles, Ajustes
- Panel derecho en diary: Pendiente + Timeline
- Modales Cmd+T (tarea), Cmd+E (evento), Escape→home
- Grabación de voz (Web Speech API, Chrome/Edge)
- Exportar/backup datos (JSON + Markdown)
- Light/dark mode con toggle en ajustes
- Agentes (placeholder), Exportar datos

**iOS 1.2**
- Tab Tareas: secciones Vencidas/Hoy/Semana/Sin fecha
- AI inline en editor: botón ✨ con streaming
- ShareLink en menú de nodo
- Pantalla de carga animada al iniciar
- Google Sign-In + indicador de plan en ajustes

### v3.10.1 — 2026-05-18

**Audio / IA**
- Si la IA falla al procesar una grabación (sin suscripción, sesión expirada, error de red), la transcripción se guarda automáticamente como bullet en el diario de hoy. La grabación ya no se pierde.
- Mensajes de error de servidor diferenciados: "sesión expirada" vs "sin suscripción" vs error genérico.
- Tras login con Apple, el estado de suscripción se hidrata inmediatamente vía `fetchMe()` si el endpoint de auth no lo devolvió.

### v3.10.0 — 2026-05-18

**Editor**
- IA inline lee el contenido de la nota como contexto. Pedir "agrupa estos ejercicios" sobre una lista funciona sin tener que repetir la lista.
- Click en cualquier zona vacía de una línea coloca el cursor al final del texto (estilo Notion). Click bajo la última línea con contenido crea una nueva línea o enfoca la línea vacía existente.

**UI / navegación**
- Selector de vista (Bullets/Tabla/Kanban/Calendario) movido a la barra de acciones superior derecha (iconos sin texto). La cabecera de la nota queda limpia.
- Botón de colapso/expansión de la columna derecha, espejo del izquierdo.
- Pestañas de Ajustes correctamente indentadas como hijas de "Ajustes" y resaltadas en azul solo si están abiertas.
- Eliminado el árbol "Calendario" del sidebar (duplicaba el dashboard y los breadcrumbs).
- Botones "···" del hover ya no se ocultan al acercar el ratón.

**Chat IA lateral retirado**
- El panel chat lateral (⌘J) eliminado por completo (~1800 líneas). Toda la interacción con IA es ahora inline.

**Rendimiento**
- Regex de markdown cacheadas como `static let`. Antes se recompilaban en cada render del NSTextView.
- `loadAllNodes()` movido a Task de prioridad `userInitiated`; el main actor queda libre para montar UI mientras SQLite carga.
- Timer global de 1 s eliminado; queda solo dentro de la barra de estado inferior con cadencia 5 s.
- Arranque por fases: críticas en `userInitiated`, no críticas en `utility`/`background` con delays de 3–6 s.
- Ruta ligera de guardado por keystroke con debounce 200 ms (no bumpea `nodesVersion`).
- Skip de coloreado de hashtags cuando el texto no contiene `#` o `@`.

**Audio / grabación**
- Errores del motor de transcripción (mic sin permiso, idioma, audio engine) ya no se silencian: se muestran en directo durante la grabación.

**Crítico — fix de pérdida de datos**
- `getOrCreateDailyNote` ahora espera a que la memoria esté cargada antes de crear con ID canónico. Sin esta protección, un `INSERT OR REPLACE` sobre el ID canónico borraba (vía `ON DELETE CASCADE`) todo el contenido del diario existente. Doble salvaguarda: si la memoria no tiene el diario, se consulta SQLite antes de insertar.

## Estado actual — Mayo 2026

Esta sección describe el estado completo de la aplicación Fromly tal como está implementada a fecha de mayo de 2026. No es un changelog de versiones sino una descripción exhaustiva del sistema.

---

### Editor y nodos

**Outliner jerárquico:**
- Editor de bullets tipo outliner con árbol de nodos anidados. Cada nodo tiene `parentId`, texto de una línea, body Markdown libre y propiedades opcionales en `extraData`.
- Drag & drop para reordenar nodos dentro del árbol (mismo nivel o reparenting).
- Colapso y expansión de ramas. Zoom in/out: navegar dentro de cualquier nodo como si fuera la raíz del árbol.
- Fractal indexing (`siblingOrder`) para ordenación manual sin colisiones.

**Tipos de nodo y transformaciones:**
- Slash palette (`/`) al inicio de un bullet para transformarlo: Tarea, Evento, Bucle Abierto, Título (h1/h2/h3), Agente, Prompt, Enlace, Archivo.
- Headings inline: `/h1`, `/h2`, `/h3` con renderizado tipográfico diferenciado.
- Cada nodo puede tener múltiples tipos simultáneos (`types: ["tarea", "proyecto"]`).

**Supertags (#):**
- Palette inline al escribir `#` en cualquier posición del texto.
- Tipos predefinidos: tarea, proyecto, evento, agente, prompt. Tipos de usuario creados al momento sin confirmación.
- El chip `#tipo` se elimina como unidad con Backspace y salta con ← →.
- Coloreado dinámico por tipo. `TypeColorService` asigna color aleatorio persistido en la primera aparición.
- Clic derecho en chip del sidebar → cambiar color (presets + ColorPicker nativo).

**Propiedades del nodo (`extraData`):**
- Campos tipados: `text`, `number`, `date`, `select`, `bool`, `url`, `email`, `phone`.
- Área (`extraData["area"]`), contexto IA de área (`_areaCtx=1`), clave R2 de archivo adjunto (`r2Key`).
- Frontmatter YAML accesible y editable por nota.
- Body Markdown por nodo con soporte completo de formato.

**Menciones y referencias:**
- `@menciones` para referenciar otras notas/nodos desde el body. Navegación directa al nodo referenciado.

**Atajos inline personalizables:**
- Expansión de texto configurable en Ajustes. El usuario define alias y su expansión (ej. `-t` → convierte en tarea, `-d:hoy` → fecha de hoy, `-p:alta` → prioridad alta).

---

### Tareas

- **Estados:** `pending`, `done`, `future`, `cancelled`.
- **Prioridad:** alta, media, baja.
- **Fecha de vencimiento** con lenguaje natural (hoy, mañana, próximo lunes, en 3 días…).
- **`dueEnd`**: fecha de fin para tareas con duración.
- **Recurrencia:** daily, weekly, monthly, yearly. La tarea se regenera automáticamente al completarse.
- **Bucles abiertos (open loops):** tareas sin fecha fija, tipo recordatorio persistente. Visibles en sección dedicada del sidebar.
- **Tareas atómicas:** nodos marcados como acción mínima indivisible.
- **Tareas rápidas (⌘T):** captura directa sin abrir la app principal. Se insertan en el nodo raíz activo.
- **Quick tasks** con `QuickCaptureSheet` vía FAB en iOS o teclado en macOS.

---

### Eventos y calendario

- **Sync bidireccional con Apple Calendar y Apple Reminders** via EventKit. Los eventos creados en Fromly aparecen en Calendario de macOS/iOS y viceversa.
- **Creación de eventos con ⌘E** y lenguaje natural (fecha, hora, duración parseados automáticamente).
- **`EventEditSheet`** para editar título, fecha/hora de inicio y fin, notas, calendario destino.
- **Timeline** en columna derecha del diario: vista Día (24h), Semana, Mes, Año. Los eventos de Apple Calendar se renderizan en todos los grids.
- Nodos diarios (`isDiaryEntry: true`) con `diaryDate` para alinear con el grid del calendario.

---

### Organización

- **Tags `#`** con tipos predefinidos (tarea, proyecto, evento, agente, prompt) y tipos de usuario ilimitados.
- **Áreas de conocimiento:** área como tag en `extraData["area"]`. Picker en el panel de propiedades para asignar o crear áreas. Cada área tiene un nodo de contexto IA (`_areaCtx=1`) cuyo body se incluye automáticamente en el system prompt del chat.
- **Jerarquía temporal automática:** al primer uso se crea árbol año→mes→semana→diario. El onboarding abre el diario del día actual.
- **Breadcrumb temporal:** Año > Mes > Semana > Día > [ancestros del nodo] > título.
- **Collections y grupos:** organización interna dentro de un espacio para agrupar nodos relacionados.
- **Workspaces:** entidad legacy reducida a shim mínimo. El modelo es plano (`allNodes`); el área reemplaza al workspace como contenedor semántico.

---

### Vistas

- **Lista:** árbol de bullets estándar con indentación y colapso.
- **Kanban:** columnas por estado (pendiente, hecho, cancelado, etc.).
- **Tabla:** grid de nodos con columnas de propiedades.
- **Galería:** cards visuales con body preview.
- **Calendario Día / Semana / Mes / Año:** nodos con fecha renderizados en el grid. Clicable para navegar al nodo.
- **Canvas infinito (whiteboard):** nodos posicionados libremente en un plano 2D con conexiones visuales entre ellos.
- **Filtros:** por estado, prioridad, área, tipo, fecha, colección. Combinables.
- **Ordenación:** por fecha de creación, modificación, vencimiento, prioridad, orden manual.
- **Agrupación:** por estado, tipo, área, prioridad, fecha.
- **Vistas guardadas (paneles):** búsquedas con filtros guardados como panel de acceso rápido en el sidebar.

---

### Búsqueda

- **⌘K — CommandBar universal:** crear nodos, buscar, navegar, parsear fechas naturales. Flags `-t` (tarea), `-e` (evento), `-b` (bucle abierto). La barra interpreta lenguaje natural para fechas y tipos.
- **⌘F — Búsqueda inline:** `InlineFilterBar` con `FilterResultsPanel` superpuesto sobre el editor. Muestra resultados en tiempo real con contexto.
- **Comandos de búsqueda:** `estado:pendiente`, `fecha:hoy`, `tipo:proyecto`, `prioridad:alta`, `col:nombre`, `area:nombre`, texto libre.
- **Spotlight de macOS:** los nodos están indexados y son accesibles desde la búsqueda del sistema.
- **Magic Search:** búsqueda semántica con IA. La consulta en lenguaje natural busca en el vault completo y sintetiza una respuesta con referencias a los nodos relevantes.

---

### Inteligencia artificial

**Chat por nota:**
- Botón ✦ o ⌘J abre el chat IA con contexto del nodo actual (título + body + hijos + contexto de área).
- Historial específico por nota. Al cambiar de nota el historial se limpia (salvo que el chat haya creado esa nota).
- Las respuestas incluyen tarjetas de acción con icono coloreado para aplicar cambios directamente al nodo.

**Editor IA y borradores:**
- Sidebar de borradores IA para componer o reescribir contenido. El borrador se puede insertar en el body del nodo o reemplazarlo.

**Sugerencias inline (ghost text):**
- El modelo sugiere continuaciones del texto mientras se escribe. Se acepta con Tab o flecha derecha.

**Grabación de voz:**
- Captura de audio del micrófono, audio del sistema (Soundflower/BlackHole), o mezcla de ambos.
- Transcripción automática → post-procesado con IA → bullets estructurados insertados en el nodo activo o en uno nuevo.
- Barra de grabación persistente en la ventana principal. Accesible también desde QuickCaptureSheet.

**Agentes autónomos:**
- Los agentes son nodos con `types: ["agente"]`.
- Cada agente tiene: instrucción fija, fuentes de contexto (nodos referenciados), schedule (al abrir, diario, semanal, manual).
- Herramientas disponibles: `leer nodo`, `actualizar nodo`, `crear nodo`, `fetch_url` (hasta 4.000 chars), `buscar web` (Brave Search API).
- Se ejecutan automáticamente según schedule o bajo demanda. Memoria persistida en `node.body`.
- `AgentService` gestiona la cola y el presupuesto de tokens por ejecución.

**Magic Search:**
- Búsqueda semántica sobre el vault completo combinando FTS5 + embeddings. La IA sintetiza una respuesta citando los nodos relevantes.

**Multi-proveedor:**
- Principal: Anthropic Claude Haiku 4.5 (balance coste/calidad).
- Fallback: Google Gemini Flash.
- En modo licencia: el usuario aporta su propia API key (Anthropic, OpenAI o Gemini).

**Gestión de tokens:**
- Plan suscripción: 2 millones de tokens/mes incluidos.
- Recarga disponible: paquetes de 5 millones de tokens adicionales (LemonSqueezy variant `1553900`).
- Panel de tokens en Ajustes con uso actual y fecha de renovación.

---

### Integraciones

- **Apple Calendar + Reminders:** sync bidireccional via EventKit. Creación, edición y eliminación de eventos desde Fromly se refleja en el sistema y viceversa.
- **Google Docs:** sincronización nota ↔ documento Google via OAuth2. Cambios en el body del nodo se propagan al doc y viceversa.
- **Publicación de notas:** cada nota puede tener una URL pública por slug. Se puede actualizar el contenido publicado o despublicar desde el panel de propiedades.
- **Spotlight macOS:** nodos indexados en el índice del sistema operativo.
- **Brave Search API:** usada por los agentes para búsquedas web con fallback automático para URLs en IA inline.
- **Cloudflare R2:** almacenamiento de archivos binarios adjuntos a nodos (presigned URLs, nunca pasan por Railway).
- **Claude (MCP):** servidor MCP propio en `/mcp` con 15 herramientas. Se conecta como **conector personalizado** (pegando la URL en Claude → Ajustes → Conectores, con OAuth propio, sin copiar tokens) o instalando la extensión de escritorio `fromly.mcpb`. **Fromly NO está en el directorio de conectores de Claude** — buscarlo ahí no lo encuentra; el directorio de servidores remotos exige organización Team/Enterprise. La extensión de escritorio se envió a revisión el 5 ago 2026.
  - El comportamiento (qué guarda y cuándo) lo entrega el servidor en el handshake (campo `instructions` del `initialize`), no el usuario pegando un bloque en su perfil de Claude. Es discreto por diseño: guarda de fondo y avisa en una línea al final del mensaje.
  - Archivos: `from_create_upload_url` + `from_finalize_upload` suben PDFs e imágenes directamente a R2 con URL prefirmada, sin que los bytes pasen por la conversación (un PDF de 1 MB en base64 son ~350k tokens). `from_upload_file` sigue disponible para archivos pequeños.

---

### Sync y cuenta

- **Servidor propio en Railway:** `https://from-server-production.up.railway.app` (TypeScript + Bun + Hono + Drizzle + PostgreSQL).
- **Sync delta en tiempo real:** Mac ↔ iPhone ↔ servidor. Protocolo "último en escribir gana" por `updated_at`. Ciclo cada 5 minutos o por push.
- **Planes:**
  - Gratis: sin cuenta, bullets ilimitados, sin sync ni IA.
  - Suscripción €7/mes: sync + 2M tokens IA/mes (Anthropic/Gemini gestionados).
  - Licencia perpetua €149: sync + IA con 3M tokens de IA incluidos (o API key propia del usuario).
- **LemonSqueezy** para pagos. Variants: suscripción (`1553200`), licencia (`1553210`), topup 5M tokens (`1553900`).
**Backups unificados Mac+web+iOS (servidor):**
- Tabla `node_snapshots(id, user_id, created_at, node_count, source, payload)` en PostgreSQL.
- `payload` es un JSON con todos los nodos del usuario al momento del snapshot.
- Retención: últimos **50** snapshots por usuario (`MAX_SNAPSHOTS_PER_USER`, `server/src/routes/backups.ts`) —
  corregido el 29 ago 2026: esta sección decía 12, desactualizado (auditoría de producto lo detectó
  comprobando en vivo).
- Cron interno en `server/src/index.ts`: setInterval 30min que crea snapshot por cada usuario activo si último >1h55min **y** hubo cambios en `sync_nodes.server_updated_at` desde el último snapshot. `source="auto"`.
- Endpoints `/backups` (Hono): `GET /` (lista), `POST /` (crear con source web/mac/manual), `GET /:id` (payload), `POST /:id/restore` (con snapshot pre-restore automático), `DELETE /:id`.
- Restore es transaccional: borra `sync_nodes` del usuario y reinserta los del snapshot por lotes de 500.
- Mac (Tauri) y web comparten exactamente la misma lista vía API — botón en Ajustes → Datos → Backups
  en ambos. **`NodeBackupService`/`triggerCloudSnapshot(source: "mac")` no existen** (no había ningún
  target Swift nativo que los implementara desde que se eliminó el 28 ago 2026, ver "target Mac Swift
  nativo" más abajo) — corregido el 29 ago 2026, esta sección describía un mecanismo que nunca llegó
  a estar cableado.
- Mac ya **no** guarda backups locales en disco — el sistema legacy (`~/Documents/From Backup/`, Markdown + SQLite) se eliminó en build 53 para evitar dos fuentes de verdad.
- **Backup adicional a iCloud Drive (Mac, `landing/web/src/utils/icloudBackup.ts` +
  `from-mac/src-tauri/src/lib.rs`)**: export JSON completo a
  `~/Library/Mobile Documents/com~apple~CloudDocs/From Backups/`, activado por defecto, throttle de
  2h, conserva los últimos 30 archivos. Ajustable en Ajustes → Accesorios. Corregido el 29 ago 2026:
  el comando Rust y el ajuste llevaban meses listos, pero nada llamaba nunca a `maybeICloudBackup()`
  — el toggle no hacía nada. Enganchado al mismo evento `from:sync` que ya dispara cada 15s + al
  recuperar el foco de la ventana (la propia función se auto-limita a una vez cada 2h).

---

### Captura rápida

- **⌘K:** CommandBar universal. Crear nodo, buscar, navegar, parsear fecha y tipo con lenguaje natural.
- **⌘T:** captura de tarea rápida directamente en el inbox o nodo raíz activo.
- **⌘E:** captura de evento con fecha/hora parseados con lenguaje natural.
- **Barra de grabación persistente:** accesible desde cualquier vista para iniciar transcripción de voz.
- **QuickCaptureSheet:** sheet modal con texto libre + flags inline (`-t`, `-d:hoy`, `-p:alta`, `-b`).

---

### Ajustes

- **Apariencia:** tema claro/oscuro/sistema. Selector de idioma con 7 idiomas disponibles.
- **Atajos de teclado personalizables:** lista completa de shortcuts editables por el usuario.
- **Atajos inline (expansión de texto):** alias configurables que se expanden al escribir.
- **Proveedores de IA:** configuración de API keys propias (Anthropic, OpenAI, Gemini). Panel de tokens con uso actual.
- **Calendario:** configuración de calendarios de Apple Calendar y Reminders a sincronizar.
- **Backup:** estado del servicio de backup local, última exportación, abrir carpeta.
- **Agentes:** lista de agentes activos, schedule, historial de ejecuciones.
- **Tipos y estados:** personalización del sistema de taxonomía (tipos predefinidos y de usuario, estados, colores).
- **Import/Export:** exportar vault completo como Markdown o JSON. Importar desde otras apps.
- **Cuenta:** login/logout, estado de suscripción o licencia, gestión de tokens.

---

### v3.7.0 (2026-05-11) — Supertags estilo Tana + refactor profundo

**Supertags (#objetos):**
- Nuevo palette inline al escribir `#` en cualquier posición. Tipos predefinidos (tarea, proyecto, evento, agente, prompt) y tipos de usuario.
- Tipos predefinidos disponibles sin configuración. Los nuevos se crean al momento, sin confirmación.
- `#` se borra como unidad (Backspace) y salta con ← →.
- Coloreado dinámico (~78% del tamaño base) con color por tipo, visible en bullets, título de nota y árbol.

**Sistema de colores por tipo:**
- `TypeColorService`: paleta de 12 colores curados, asignación aleatoria persistida en primera aparición.
- Clic derecho en el chip del sidebar → cambiar color (preset + ColorPicker nativo).
- Animación flash al aplicar `#tipo` (spring + fade).

**Columna derecha rediseñada:**
- Tabs limpios: **Propiedades** / **Chat**.
- Sección de tipos siempre visible con campos editables (text/number/date/select/bool/url/email/phone).
- `ObjectPickerButton` para asignar/cambiar objeto desde el sidebar.
- Cabecera "Tareas & Eventos" con botones separados para crear cada tipo.
- Eventos hijos visibles junto a tareas.

**Chat IA:**
- Historial específico por nota — al abrir otra nota se limpia (salvo si el chat creó esa nota).
- Headers limpios sin ALLCAPS. Tarjetas de acción con icono coloreado.

**Breadcrumb:**
- Año > Mes > Semana > **Día** > [padres] > título.
- El día se calcula desde `node.createdAt` independientemente del nodo diario.
- Soporta zoom dentro de diarios.

**Layout:**
- Panel izquierdo simplificado a un solo tab (Árbol). Día y 24h eliminados.
- 24h timeline reubicado a columna derecha en nodos diarios (estilo NotePlan3 dashboard).

**Refactor estructural (deuda técnica):**
- **Schema version** en BD para migraciones de datos: ahora se ejecutan una sola vez en la vida de cada BD (antes corrían en cada arranque, con riesgo de destruir features nuevas como ocurrió con el nodo Búsquedas).
- **God-views troceadas:** `NodesView.swift` -18%, `NodeBodyPanel.swift` -25%.
- Nuevos archivos: `NodeRightSidebar.swift`, `NoteBreadcrumb.swift`, `NodeTitleHeader.swift`.
- Eliminado código muerto: `DayPickerView`, `PropValuesPanel`, `PropertySection*` (legacy), `nodeTitleWithActions`, `zoomedNodeHeader`, comentarios-tumba.
- Sistema de foco unificado: una sola fuente de verdad (`focusedId` → `focusedBulletId` → sidebar).

### v3.6.8 (2026-05-08)
- **Área picker**: picker en el panel de propiedades para asignar o crear áreas. Muestra áreas existentes y permite escribir nuevas
- **Contexto IA de área**: banner visual cuando se edita el nodo de contexto de área, con indicador claro de su propósito
- **Workspace eliminado**: `Workspace` reducido a shim mínimo, `Node.workspaceId` computed (no almacenado), `nodesByWorkspace` derivado de `allNodes`
- **Limpieza total**: `AreaChipsFlow`, filtros de workspace, y otras referencias eliminadas

### v3.6.7 (2026-05-08)
- **Arquitectura**: workspace eliminado como entidad estructural — modelo plano de nodos (`allNodes`), área como tag en `extraData["area"]`
- **Onboarding**: primer uso crea automáticamente la jerarquía temporal (año→mes→semana→diario) y abre el diario de hoy
- **Área como contexto IA**: nodo especial por área (`_areaCtx=1`) cuyo body se incluye automáticamente en el system prompt del chat
- **Chat**: botón de tag de área para editar/crear el nodo de contexto desde cualquier nota

### v3.6.6 (2026-05-08)
- **Breadcrumb**: jerarquía temporal correcta — sin "Fromly", cada nivel muestra solo sus ancestros. Año: sin prefijo; Mes: solo año; Semana: año+mes; Diario: año+mes+semana
- **Calendarios temporales**: el calendario de nodos año/mes/semana abre en la fecha correcta del nodo (ya no en la fecha actual)
- **Notas diarias en calendarios**: las notas diarias aparecen en el grid de semana/mes usando `diaryDate`

### v3.5.4 (2026-05-07)
- **Rendimiento**: TemporalNavigator pre-buckea nodos por día — lookup O(1) por celda en vez de iterar todos los nodos con Calendar operations
- **Rendimiento**: Dashboards (Proyectos, Tareas, Semana, Mes, Elementos) con debounce + cache — no recomputan en cada cambio de nodo
- **Rendimiento**: NodesView body ya no depende de `nodesByWorkspace` — elimina re-renders innecesarios
- **Rendimiento**: Apple Calendar sync con lookups directos por ID en vez de escanear 3.000+ eventos
- **Swift 6**: Propiedades de `Node` (`isAtomicTask`, `isOverdue`, `isDone`...) marcadas `nonisolated` — compatibles con `-default-isolation=MainActor`
- **Limpieza**: Eliminados 12 ficheros de código muerto (~5.500 líneas): BulletTreeView, NodeDashboardView, NodeWorkspaceDashboard y 9 panel views del sistema antiguo

### v3.5.2 (2026-05-06)
- Fix crash `Dictionary(uniqueKeysWithValues:)` en Apple Calendar sync con eventos recurrentes duplicados
- Añadidos `NodeMode.enlace` y `NodeMode.archivo` como tipos first-class
- GlobalDashboardView rediseñado con 6 pestañas fijas (Proyectos/Tareas/Agenda/Mes/Elementos/Chat IA)

---

## Qué es Fromly

**Fromly** es una aplicación nativa para macOS e iOS que funciona como un segundo cerebro personal. Organiza toda la información en un árbol de bullets sincronizado en tiempo real entre dispositivos, con agentes autónomos de IA y gestión de archivos integrada.

**Tagline:** Tu segundo cerebro. En todos tus dispositivos.

**Propuesta de valor:**
- **Árbol de bullets universal:** Todo — notas, tareas, proyectos, diario, archivos — vive en un árbol de nodos flexible organizado en workspaces con colores.
- **Sync real en tiempo real:** Los cambios se sincronizan entre Mac, iPhone y la nube automáticamente. Sin iCloud Drive, sin ficheros .md que gestionar.
- **IA integrada:** Asistente conversacional con contexto completo de los nodos. Agentes autónomos que ejecutan tareas periódicas.
- **Nativo macOS + iOS:** Construido en Swift y SwiftUI. Rendimiento nativo.

**Público objetivo:**
- Knowledge workers (proyectos, tareas, notas interconectadas)
- Personas que quieren todo en un único sistema sin fricciones
- Usuarios de Mac + iPhone que necesitan continuidad real entre dispositivos
- Entusiastas de IA que quieren un asistente con contexto real de su vida

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| App macOS | Swift 5.10 + SwiftUI |
| App iOS | Swift 5.10 + SwiftUI |
| Plataforma macOS | macOS 14+ (Sonoma) |
| Plataforma iOS | iOS 17+ |
| Almacenamiento local | SQLite (NodeDB, FTS5) |
| Sync en la nube | TypeScript + Bun + Hono + Drizzle + PostgreSQL (Railway) |
| Archivos en la nube | Cloudflare R2 (S3-compatible) via presigned URLs |
| Búsqueda | SQLite FTS5 local + NodeSearchParser |
| Calendario | EventKit (Apple Calendar + Reminders) |
| IA | Multi-proveedor: Anthropic Claude, OpenAI, Google Gemini |
| Pagos | LemonSqueezy |
| Updates | Sparkle (macOS) |
| Landing | HTML estático (fromly.app) |

---

## Arquitectura de datos

### Modelo de nodos

El dato fundamental es el **Node** — un bullet con texto, body markdown opcional, propiedades y hijos. Los nodos se organizan en **Workspaces** (espacios de trabajo con nombre y color).

```
Workspace "Trabajo"
├── Proyecto X
│   ├── Fase 1
│   │   ├── Tarea pendiente   [status: pending, due: 2026-05-10]
│   │   └── Tarea hecha       [status: done]
│   └── Recursos
│       └── Documento de referencia  [body: "contenido markdown..."]
└── Reuniones
    └── 20260506  [isDiaryEntry: true]

Workspace "Personal"
├── ...
```

Un Node tiene:
- `text`: el título/bullet (una línea)
- `body`: markdown libre (la nota al abrir)
- `types`: etiquetas globales (`["tarea", "proyecto", "cliente"...]`)
- `status`: estado operativo (`pending | done | cancelled | ...`)
- `due`: fecha de vencimiento
- `priority`: alta | media | baja
- `isFavorite`, `isDiaryEntry`, `isChat`, `isEvent`, `isActive`
- `collections`: organización interna del workspace
- `siblingOrder`: fractional indexing para ordenación manual
- `parentId`: jerarquía padre-hijo

### Capa de almacenamiento

```
Dispositivo (Mac / iPhone)
  └── nodes.db (SQLite)
        ├── workspaces
        ├── nodes          (FTS5 full-text search)
        ├── node_types     (tipos de nodo)
        └── node_fields    (campos personalizados)

NodeService (in-memory)
  └── nodesByWorkspace: [UUID: [UUID: Node]]  (árbol completo en RAM)
```

### Sincronización

```
Mac  ←──── delta sync cada 5min ────→  Railway PostgreSQL  ←──── delta sync ────→  iPhone
            (POST /sync)                sync_workspaces                              (POST /sync)
                                        sync_nodes
```

**Protocolo delta:** El cliente envía todos los nodos modificados desde `lastSyncAt`. El servidor aplica "ganador más reciente" (`updated_at`) y devuelve los cambios del servidor que el cliente no tiene.

**Archivos:** Los archivos nunca pasan por Railway. Flujo: App → `POST /files/presign-upload` (obtiene URL R2) → App sube directamente a R2 → `extraData["r2Key"]` guardado en el nodo.

### Backups de nodos

Sistema unificado server-side — ver sección "Backups unificados Mac+web (servidor)" más arriba en el documento.

---

## Primer uso — Onboarding

### macOS
1. **Pantalla de bienvenida:** Permisos básicos (Calendar, Notifications)
2. **Elegir espacio:** El usuario selecciona o crea una carpeta local que Fromly usará como base (para agentes y archivos locales). El vault .md ya no existe.
3. **Login (opcional):** Para activar sync entre dispositivos, el usuario hace login con su cuenta Fromly.

### iOS
1. **Onboarding:** Pantalla de bienvenida
2. **Configurar espacio** (si se necesita uno local para archivos)
3. Los nodos se cargan automáticamente desde el servidor si hay sesión activa

---

## Funcionalidades principales (macOS)

### Árbol de bullets (NodesView)
- Vista principal de la app
- Bullet expandible/colapsable con dot, checkbox, indentación
- Zoom in/out: navegar dentro de cualquier nodo como si fuera la raíz
- Búsqueda inline con comandos: `estado:pendiente`, `fecha:hoy`, `tipo:proyecto`, `prioridad:alta`, `col:Marketing`, etc.
- Drag & drop para reorganizar el árbol
- Crear bullets con Enter, Tab para indentar, Backspace para des-indentar
- Atajos inline: `-t` (tarea), `-p:alta` (prioridad), `-d:hoy` (fecha)

### Panel de detalle del nodo (NodeEditorView)
- Breadcrumb de ancestros
- Título editable
- Body en Markdown
- Panel de propiedades lateral (estado, fecha, tipos, colecciones, prioridad, favorito)
- Árbol de hijos inline

### Dashboard global (GlobalDashboardView)
- Vista de hoy: tareas vencidas, vencen hoy, próximas
- Panel de diario diario (DailyNotePanelView)
- Timeline: Día / Semana / Mes / Año
- Kanban por estado

### Búsqueda global (Cmd+O)
- Nodos, archivos y agentes
- Instantáneo, sin servidor

### Agentes IA (AgentService)
- Los agentes son nodos con `types: ["agente"]`
- Instrucción fija + fuentes de contexto + schedule
- Herramientas: `leer nodo`, `actualizar nodo`, `crear nodo`, `fetch_url`, `buscar web`
- Se ejecutan automáticamente según schedule o manualmente
- Memoria en `node.body`

### Archivos (ArchivosView + FileService)
- Importar archivos desde Finder (drag & drop o menú)
- Subida a Cloudflare R2 via presigned URL
- Vista de archivos con thumbnails, búsqueda, agrupación por tipo/workspace

### Ajustes (SettingsView)
- Cuenta: login, tokens IA, suscripción
- Espacio: configuración del directorio local
- Tipos y Estados: personalización del sistema de taxonomía
- Calendario: sincronización con Apple Calendar
- Backup: estado de backups de nodos
- IA: Agentes, Prompts, Asistente, Taller
- Atajos de teclado: configurables

---

## Funcionalidades principales (iOS)

### Árbol de bullets (IOSNodesView)
- Pantalla principal con selector de workspace
- Buscador con comandos idénticos a macOS
- Chips de filtros activos
- Zoom in/out mediante tap en el dot
- Swipe para marcar hecho / eliminar
- Long press para menú contextual

### Detalle de nodo (IOSNodeDetailView)
- Propiedades en scroll horizontal en la parte superior (estado, fecha, prioridad, tipos)
- Título y body editables
- Árbol de hijos
- Botón añadir bullet hijo

### Captura rápida (FAB + IOSQuickCaptureSheet)
- Texto libre con comandos inline: `-t`, `-d:hoy`, `-p:alta`, `-f`
- Botones rápidos de comandos
- Selector de workspace

---

## Servidor Railway

URL: `https://from-server-production.up.railway.app`

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servidor |
| POST | `/auth/login` | Login, devuelve JWT |
| POST | `/sync` | Delta sync de nodos (requiere JWT) |
| GET | `/files/status` | Estado de R2 |
| POST | `/files/presign-upload` | URL presignada para subir archivo |
| POST | `/files/presign-download` | URL presignada para descargar archivo |
| POST | `/admin/bootstrap` | Crear/verificar usuario admin |

### Autenticación

JWT HS256 con `JWT_SECRET` de Railway. Expiración: 15 min (access) + 30 días (refresh).

---

## Modos de uso y monetización

### AppMode — estado de la cuenta

`FromServerService.appMode` es la fuente única de verdad para el gating de features:

| Modo | Condición | Qué funciona |
|------|-----------|-------------|
| `.free` | Sin cuenta | Bullets + Workspaces + Archivos. Sin sync ni IA |
| `.subscription` | Login + `subscriptionStatus: active` | Todo — sync + IA automática (tokens) |
| `.license` | Login + `licenseStatus: active` | Sync + IA con 3M tokens incluidos (o API key propia) |
| `.expired` | Login + suscripción/licencia caducada | Solo bullets + archivos |

**Flags de conveniencia:** `canSync` (≠ free), `canUseAI` (== subscription)

### Monetización

- **Modo gratuito:** Sin cuenta, sin límite de tiempo. Bullets y archivos ilimitados.
- **Modo Lifetime (licencia €149):** sync Railway + 3M tokens de IA incluidos (o API key propia del usuario)
- **Modo automático (suscripción €7/mes):** Tokens prepago + sync Railway
  - Variantes LemonSqueezy: suscripción (`1553200`), licencia (`1553210`), topup 5M (`1553900`)

---

## Proceso de publicación de versión (macOS)

⚠️ **Proceso actualizado desde v9.4.4. El proceso anterior con Sparkle `sign_update` está OBSOLETO.**

El updater es `tauri-plugin-updater`. Cada release requiere un `latest.json` firmado con la clave Tauri.

```bash
# 1. Bump versión en from-mac/src-tauri/tauri.conf.json
# 2. Build notarizado
export APPLE_ID="albertolezaun@me.com" APPLE_PASSWORD="ulbw-glkh-jztf-hsin"
export APPLE_TEAM_ID="5YNQRA7NUE"
export TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/from-mac.key
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
make notarize   # desde from-mac/

# 3. Firmar DMG con clave Tauri
cargo tauri signer sign --password "" -f ~/.tauri/from-mac.key /tmp/From.dmg

# 4. Crear latest.json y publicar en ambos repos
gh release create vX.X.X /tmp/From.dmg /tmp/latest.json -R getfrom-app/getfrom-app
```

**Clave de firma:** `~/.tauri/from-mac.key` (sin contraseña) — no perder nunca.

### Versión actual publicada
- **macOS**: v9.4.4 — publicada 2026-06-01, con actualizador automático integrado
- **iOS**: v2.2 build 108 — en revisión App Store

---

## Estructura del repositorio

```
from/
├── app/                    # App macOS + iOS (Swift/SwiftUI)
│   ├── Fromly/               # Target macOS
│   │   ├── Services/       # Lógica de negocio (NodeService, AgentService, etc.)
│   │   ├── Models/         # Modelos de datos (Node, Workspace, VaultFile, etc.)
│   │   └── Views/          # Vistas SwiftUI
│   └── FromiOS/            # Target iOS
│       └── Views/          # Vistas iOS
├── server/                 # Servidor Railway (TypeScript + Bun + Hono)
│   └── src/
│       ├── routes/         # Endpoints (sync, files, auth, admin)
│       ├── db/             # Schema Drizzle + PostgreSQL
│       └── lib/            # JWT, R2 wrapper
├── landing/                # Web estática (fromly.app)
├── docs/                   # Documentación técnica y procesos
└── logs/                   # Logs de sesiones de desarrollo
```

---

## Variables de entorno (Railway)

```
JWT_SECRET                      # Firma JWT (access tokens)
JWT_REFRESH_SECRET              # Firma JWT (refresh tokens)
ADMIN_SECRET                    # Bootstrap admin
ADMIN_EMAIL                     # Email del admin
LS_STORE_ID                     # LemonSqueezy store
LS_VARIANT_SUBSCRIPTION         # Variant suscripción mensual
LS_VARIANT_LICENSE              # Variant licencia perpetua
LS_VARIANT_TOPUP_5M             # Variant topup 5M tokens
R2_ACCOUNT_ID                   # Cloudflare R2 account
R2_ACCESS_KEY_ID                # R2 S3 access key
R2_SECRET_ACCESS_KEY            # R2 S3 secret
R2_BUCKET                       # Nombre del bucket (from-vault)
DATABASE_URL                    # PostgreSQL Railway (interna)
```

---

## Decisiones de arquitectura clave

### Por qué nodos en lugar de .md

El sistema de archivos .md era frágil: dependía de iCloud Drive para sync (lento, conflictos frecuentes), la estructura se codificaba en frontmatter YAML manual, y añadir nuevas propiedades requería parsear texto. Con NodeDB (SQLite) + Railway sync:
- Sync instantáneo y fiable entre dispositivos
- Propiedades first-class en la base de datos
- FTS5 para búsqueda de texto completo nativa
- Sin dependencia de iCloud Drive

### Por qué Railway en lugar de iCloud/CloudKit

CloudKit tiene límites de escritura, latencia variable y no funciona bien en plataformas no-Apple. Railway + PostgreSQL da control total del esquema, queries SQL directas y se puede escalar.

### Por qué R2 para archivos

Los archivos binarios no deben pasar por Railway (coste de transferencia). R2 con presigned URLs permite subir/descargar directamente desde el cliente, con el servidor solo gestionando autorización.
