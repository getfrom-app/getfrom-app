# Fromly — Documentación completa

> Documento vivo. Actualizado en cada sesión de desarrollo.
> Última actualización: 2026-07-13 (Web v9.6.804)

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

**Fromly 2.0 (web).**
- Conversaciones fuera de Elementos/Buscador (viven en Historial). Fix: `trashNode` reparenta a Papelera SIN poner `deletedAt` → hay que filtrar `isInPapelera` en las listas sobre `allActive()`.
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

---

### Sync y cuenta

- **Servidor propio en Railway:** `https://from-server-production.up.railway.app` (TypeScript + Bun + Hono + Drizzle + PostgreSQL).
- **Sync delta en tiempo real:** Mac ↔ iPhone ↔ servidor. Protocolo "último en escribir gana" por `updated_at`. Ciclo cada 5 minutos o por push.
- **Planes:**
  - Gratis: sin cuenta, bullets ilimitados, sin sync ni IA.
  - Suscripción €7/mes: sync + 2M tokens IA/mes (Anthropic/Gemini gestionados).
  - Licencia perpetua €59: sync + IA con API key propia del usuario.
- **LemonSqueezy** para pagos. Variants: suscripción (`1553200`), licencia (`1553210`), topup 5M tokens (`1553900`).
**Backups unificados Mac+web (servidor):**
- Tabla `node_snapshots(id, user_id, created_at, node_count, source, payload)` en PostgreSQL.
- `payload` es un JSON con todos los nodos del usuario al momento del snapshot.
- Retención: últimos 12 snapshots por usuario (DELETE NOT IN top-12 por created_at).
- Cron interno en `server/src/index.ts`: setInterval 30min que crea snapshot por cada usuario activo si último >1h55min **y** hubo cambios en `sync_nodes.server_updated_at` desde el último snapshot. `source="auto"`.
- Endpoints `/backups` (Hono): `GET /` (lista), `POST /` (crear con source web/mac/manual), `GET /:id` (payload), `POST /:id/restore` (con snapshot pre-restore automático), `DELETE /:id`.
- Restore es transaccional: borra `sync_nodes` del usuario y reinserta los del snapshot por lotes de 500.
- Mac (`NodeBackupService`) y web comparten exactamente la misma lista vía API. Mac dispara snapshot cada 2h cuando está abierta, vía `triggerCloudSnapshot(source: "mac")`. Web: botón en Ajustes → Datos → Backups.
- Mac ya **no** guarda backups locales en disco — el sistema legacy (`~/Documents/From Backup/`, Markdown + SQLite) se eliminó en build 53 para evitar dos fuentes de verdad.

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
| `.license` | Login + `licenseStatus: active` | Sync + IA con API key propia |
| `.expired` | Login + suscripción/licencia caducada | Solo bullets + archivos |

**Flags de conveniencia:** `canSync` (≠ free), `canUseAI` (== subscription)

### Monetización

- **Modo gratuito:** Sin cuenta, sin límite de tiempo. Bullets y archivos ilimitados.
- **Modo manual (licencia €59):** API key propia del usuario + sync Railway
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
