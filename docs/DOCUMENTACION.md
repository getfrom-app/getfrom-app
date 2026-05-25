# From — Documentación completa

> Documento vivo. Actualizado en cada sesión de desarrollo.
> Última actualización: 2026-05-25 (Web v7.48)

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
| **Mac** | `from-app` | SwiftUI + SQLite + Sparkle | getfrom.app (descarga DMG) |
| **Web** | `getfrom-app` | React 18 + Vite + TypeScript | getfrom.app/app |
| **iOS** | `from-app` | SwiftUI + SQLite + App Store | App Store (pendiente) |
| **Server** | `from-server` | Hono + Bun + PostgreSQL | Railway (from-server-production) |

### Reglas de paridad

1. Cualquier feature nueva en Mac debe evaluarse para Web (y viceversa)
2. Los features de IA (inline, agentes, grabación) deben estar en ambas plataformas
3. La documentación (MANUAL.md, DOCUMENTACION.md) refleja todas las plataformas
4. La landing page (getfrom.app) tiene accesos e información a las tres plataformas

### Accesos a plataformas en landing
- getfrom.app → Mac (descarga DMG)
- getfrom.app/app → Web
- getfrom.app/claude → Extensión MCP para Claude
- getfrom.app/pricing → Precios (único para todas las plataformas)

---

## Changelog

### Web 1.0 — 2026-05-20

**Plataforma: Web** (getfrom.app/app)

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
- Publicar nota con URL pública real (getfrom.app/p/SLUG)

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

**From Web** (nuevo — getfrom.app/app)
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

Esta sección describe el estado completo de la aplicación From tal como está implementada a fecha de mayo de 2026. No es un changelog de versiones sino una descripción exhaustiva del sistema.

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

- **Sync bidireccional con Apple Calendar y Apple Reminders** via EventKit. Los eventos creados en From aparecen en Calendario de macOS/iOS y viceversa.
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

- **Apple Calendar + Reminders:** sync bidireccional via EventKit. Creación, edición y eliminación de eventos desde From se refleja en el sistema y viceversa.
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
- **Backup local automático:** `NodeBackupService` exporta todos los nodos a Markdown cada 2 horas en `~/Library/Application Support/From/Backups/`.

**Backup local por workspace:**
- Snapshots timestampados cada 2h: `~/Documents/From Backup/{Workspace}/{yyyy-MM-dd_HH-mm}/`
- Cada snapshot: copia SQLite (nodes.db) + Markdown de todos los nodos
- Historial: 6 snapshots por workspace (12h)
- Restauración desde Settings sin reinicio
- Clave lastBackupDate por workspace: `from.nodeBackup.lastDate.{wsId}`
- Separado por workspace: Personal y Demo tienen historial independiente

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
- **Breadcrumb**: jerarquía temporal correcta — sin "From", cada nivel muestra solo sus ancestros. Año: sin prefijo; Mes: solo año; Semana: año+mes; Diario: año+mes+semana
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

## Qué es From

**From** es una aplicación nativa para macOS e iOS que funciona como un segundo cerebro personal. Organiza toda la información en un árbol de bullets sincronizado en tiempo real entre dispositivos, con agentes autónomos de IA y gestión de archivos integrada.

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
| Landing | HTML estático (getfrom.app) |

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

### Backup local de nodos

`NodeBackupService` exporta todos los nodos a Markdown cada 2 horas en:
`~/Library/Application Support/From/Backups/`

---

## Primer uso — Onboarding

### macOS
1. **Pantalla de bienvenida:** Permisos básicos (Calendar, Notifications)
2. **Elegir espacio:** El usuario selecciona o crea una carpeta local que From usará como base (para agentes y archivos locales). El vault .md ya no existe.
3. **Login (opcional):** Para activar sync entre dispositivos, el usuario hace login con su cuenta From.

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

1. Bump `MARKETING_VERSION` y `CURRENT_PROJECT_VERSION` (entero incremental) en Xcode
2. `xcodebuild archive` (Release, Developer ID, Hardened Runtime)
3. `xcodebuild -exportArchive` → `.app`
4. `hdiutil create` → `.dmg`
5. `xcrun notarytool submit --keychain-profile "notarytool" --wait`
6. `xcrun stapler staple` + `validate`
7. `/tmp/sparkle-bin/bin/sign_update From.dmg` → obtener `edSignature` y `length`
8. `gh release create vX.X /tmp/From.dmg` en repo `getfrom-app/getfrom-app`
9. Añadir `<item>` en `landing/appcast.xml` con edSignature, length y sparkle:version
10. `git push` en landing → GitHub Pages publica en ~1 min → Sparkle detecta automáticamente

**Credenciales notarización:** guardadas en Keychain como `"notarytool"` (`--keychain-profile "notarytool"`)

Referencia completa: `docs/publicar-version.md`

### Versión actual publicada
- **macOS**: v3.0 (build 18) — publicada 2026-05-06
- **iOS**: pendiente App Store (roadmap)

---

## Estructura del repositorio

```
from/
├── app/                    # App macOS + iOS (Swift/SwiftUI)
│   ├── From/               # Target macOS
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
├── landing/                # Web estática (getfrom.app)
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
