# Changelog — From

Historial de versiones de From para Mac, iPhone y Web.

---

## Web 1.3 — 21 mayo 2026 (sesión 2)

**Plataforma: Web** (getfrom.app/app) · Mejoras de UX, editor y panel derecho

### Editor y outliner
- **Tipo lista `- `** — Elemento de lista clásico: dot decorativo (no navegable), indentado +8px, Enter continúa lista, Enter en vacío sale de la lista
- **Slash `/` en cualquier posición** — Abre el menú de conversión desde cualquier punto del texto, preserva el texto existente al aplicar el bloque
- **Slash en el título** — El menú `/` también funciona desde el h1 del título de la nota
- **`#tag` siempre al final** — Al seleccionar un tag con `#`, se coloca al final del texto (no inline donde se escribió) y se añade a `node.types`
- **Tags renderizados en título y nodos** — `#cafe-ole` aparece como pill coloreado (pequeño + bold) tanto en el título como en los bullets
- **Emoji por defecto `📄`** — Notas sin emoji muestran el icono `📄`; clic abre el picker para cambiarlo. Título correctamente alineado siempre
- **Bug cursor en título** — Al escribir en el h1, el cursor ya no salta al principio. Contenido gestionado via `useEffect`, no como hijo React
- **IA inline: input de prompt** — `Espacio` en nodo vacío muestra `✦ Pide a la IA...`; el usuario escribe su prompt y pulsa Enter para lanzar. Igual que Mac
- **Selección múltiple por arrastre** — Arrastra el ratón sobre nodos (fuera del texto) para seleccionarlos en rango. Backspace borra todos, Cmd+C los copia como texto plano
- **Selección de texto en nodo** — La selección de texto dentro de un nodo funciona con normalidad (contentEditable sin interferencia)
- **Propagación de `selectedId` en árbol** — `isSelected` ahora se propaga correctamente a nodos hijos; navegación ArrowUp/Down funciona a cualquier profundidad
- **Enter en bullet vacío** — Borra el nodo y navega al anterior (incluso si está indentado)
- **Hover del nodo hasta el borde** — Eliminado `max-width: 800px` del outliner que recortaba el fondo del hover
- **Badge de tiempo eliminado** — El "2h" en hover ya no aparece

### Panel derecho
- **Columna derecha unificada** — Una sola columna siempre visible con: "Ver área completa", toggles (Favorito, Seguimiento, Bucle, Evento, Bloquear), Estado, Prioridad, Fecha, Repetición, Color, Área, Tags
- **Sin ruido** — Eliminadas secciones Bullets, Hermanas, Historial, Backlinks, Relacionadas del panel derecho
- **Panel colapsable** — Handler `‹/›` (círculo Mac-style) en el borde izquierdo del panel. Aplica a notas normales y diario
- **Ancho 440px** — Panel derecho el doble de ancho (220px → 440px) en todas las notas
- **Timestamp en breadcrumb** — "Ahora mismo / Hace Xh" desplazado al extremo derecho de la fila del breadcrumb, encima de los iconos
- **Tags chip bajo título eliminados** — Los tags redundantes bajo el título ya no aparecen

---

## Web 1.2 — 21 mayo 2026

**Plataforma: Web** (getfrom.app/app) · Gran actualización de paridad Mac→Web

### Nuevas vistas
- **ChatView** — Chat IA global con historial de conversación, streaming y 4 sugerencias rápidas
- **FilesView** — Notas recientes con archivos adjuntos
- **InboxView** — Bandeja de entrada: notas sin procesar (últimos 30 días) con acciones ★/📓/✓/✕
- **TrashView** — Papelera con restore y "vaciar papelera"
- **TagView** — Vista filtrada por tag con estadísticas, filtros de tipo y ordenación

### Outliner y editor de bullets
- **IA Inline fase 2** — Tab acepta texto fantasma, Esc descarta; el texto sugerido aparece en gris mientras se genera
- **Zoom en nodo** — Botón ⟶ visible en hover para navegar dentro de cualquier nodo con hijos
- **Badge de hijos** — Contador de hijos visibles sobre el bullet colapsado
- **Alt+Click** — Colapsa/expande todo el subárbol de golpe
- **⌘⇧C** — Copia enlace directo al nodo al portapapeles
- **⌘/** — Cicla entre H1 → H2 → H3 → texto normal
- **Wiki-links `[[nombre]]`** — Click navega directamente al nodo referenciado
- **Indicador de body** — Punto visual en el bullet cuando el nodo tiene body
- **Timestamp en hover** — Fecha de modificación relativa al pasar el ratón
- **Text expansion hints** — Clase visual cuando el texto termina en un atajo expandible
- **Color de nodo** — Borde izquierdo coloreado desde `extraData.color`
- **Icono de nodo** — Emoji mostrado inline antes del texto (desde `extraData.icon`)
- **Orden visual** — Modos: ninguno / alfabético / por fecha / por prioridad / por estado
- **Multi-selección** — Shift+Click selecciona varios nodos; barra de acciones en masa (completar, favorito, eliminar)
- **Filtro local ⌘F** — Barra de búsqueda dentro del outliner sin salir de la vista

### Vista de nota (NodeView)
- **Chat por nota ⌘J** — Panel lateral de chat IA con contexto de la nota actual, historial de sesión
- **Emoji picker** — Selector de emoji como icono de la nota (7 categorías, botón "Quitar")
- **Banda de color** — Cabecera de la nota coloreada según `extraData.color`
- **Badge de área** — Muestra el área asignada a la nota
- **Bloqueo de nota** — Toggle en propiedades + indicador "🔒 Nota bloqueada" cuando está en solo lectura
- **Temporizador Pomodoro** — 25 min con notificación al terminar, integrado en la vista de nota
- **Meta de palabras en modo foco** — Barra de progreso personalizable en focus mode
- **Exportar markdown** — Descarga la nota como .md
- **Seguimiento** — Toggle para marcar notas en seguimiento activo (aparecen en FollowupView)
- **Imprimir** — Abre ventana de impresión con HTML limpio (sin sidebar ni toolbar)
- **Menú compartir** — Copiar enlace, abrir en pestaña, publicar con URL pública
- **Barra de acciones rápidas** — copyLink, mover al diario, duplicar, imprimir, exportar, seguimiento, chat, pomodoro
- **Toolbar del body** — Botones H1, H2, línea divisoria `---`, checkbox `[ ]`, bloque de código
- **Renderizado avanzado del body** — Checkboxes clicables, listas agrupadas ul/ol, bloques de código con \`\`\`, tablas markdown `| |`
- **Importar markdown** — Importa texto markdown al body de la nota
- **Auto-foco en título** — Al crear una nota nueva el cursor va directo al título

### Panel de propiedades
- **Botones de fecha rápida** — Hoy / Mañana / Próx. lunes / +Semana / ✕ con un solo clic
- **Picker de área** — Datalist con todas las áreas existentes
- **Notas enlazadas** — Detecta @menciones en el body y las muestra como referencias
- **Recurrencia como chips** — Chips visuales en lugar de `<select>` para diaria/semanal/mensual/anual
- **Selector de color** — 8 colores en `extraData.color` con preview visual
- **Toggle bloqueo** — Activa `extraData.locked` desde propiedades
- **Toggle seguimiento** — `isSeguimiento` directamente desde propiedades

### CommandPalette (⌘K)
- **Flags NLP** — `-t` (tarea), `-e` (evento), `-b` (bucle), `-f` (favorito)
- **Fechas en lenguaje natural** — hoy, mañana, lunes, martes…domingo, HH:MM, dd/mm
- **Crea sin navegar** — Al crear con flags, la nota se crea y aparece un toast, sin redirigir
- **`# prefix`** — Filtra por tag directamente
- **`/template` o `/plantilla`** — Muestra todas las plantillas disponibles
- **Subnombre de padre** — Muestra el nombre del nodo padre bajo cada resultado
- **Secciones** — "Acciones rápidas" y "Recientes" cuando no hay query

### Diario
- **URL sync** — `?offset=N` en la URL permite deep-link a días anteriores
- **Picker de fecha** — Input date para navegar a cualquier día directamente
- **Navegación ±7 días** — Botones de semana anterior/siguiente
- **Historial reciente** — Últimas 7 entradas de diario en panel lateral
- **Agenda de 14 días** — Eventos futuros en un rango más amplio
- **Quick capture mejorado** — Soporta flags `-t`, `-e`, `@hoy`, `@mañana`
- **Panel de estadísticas** — Gráfico semanal en SVG, contadores, grid de hábito 28 días, top tags
- **Milestone** — Badge "¡Excelente día!" al alcanzar ≥10 bullets en el día
- **Streak coloreado** — Ámbar si ≥7 días seguidos, rojo si ≥30 días

### Búsqueda
- **DSL completo** — `status:`, `date:`, `priority:`, `kind:`, `tag:`, `has:`, `area:`, `fecha:mañana`, `fecha:esta-semana`, `fecha:sin-fecha`, `tipo:nota`, `tipo:diario`, `tiene:cuerpo`, `tiene:fecha`
- **14+ patrones NLP** — "notas del diario", "proyectos", "reuniones", "ideas", "urgente", etc.
- **8 chips rápidos** — Accesos rápidos con iconos a búsquedas frecuentes
- **Orden por relevancia** — Ranking en 3 niveles (título exacto > título parcial > body)
- **Vistas agrupada/plana** — Toggle ⊟/≡ para ver resultados en grupos o lista plana
- **Extracto de body** — Muestra fragmento del body cuando la coincidencia está en el cuerpo
- **Tooltip de ayuda DSL** — Botón `?` con sintaxis completa del DSL

### Calendario
- **EventPopup** — Popup al hacer clic en un evento con título, detalles y acciones
- **QuickEventCreate** — Crear evento directamente haciendo clic en una celda de hora
- **Auto-scroll** — Desplaza automáticamente a la hora actual en la vista semana
- **Puntos de diario** — En vista mes: 📓 con número de hijos; clic navega al diario del día
- **Colores por prioridad/estado** — Eventos=ámbar, hecho=gris, alta=rojo, media=naranja, baja=verde
- **Leyenda de colores** — En el footer de la vista semana

### Tareas
- **Quick add inline** — Botón `+` en cada sección para crear tarea directamente allí
- **Fechas rápidas en hover** — Hoy / +1 / +7 / ✕ al pasar el ratón sobre una tarea
- **Chip "completadas hoy"** — Contador verde en la cabecera cuando hay tareas terminadas hoy
- **Badge 🔁** — Indicador visual inline de recurrencia

### Bucles / Seguimiento
- **Búsqueda en FollowupView** — Input de filtro en tiempo real
- **Filtros de prioridad** — Botones Alta/Media/Baja/Todas
- **Sección Seguimiento** — Nodos marcados con `isSeguimiento` en sección dedicada "👁 En seguimiento"
- **Quick add a bucle** — Botón para añadir tarea hija a un bucle directamente

### Kanban
- **Agrupación flexible** — Selector: por estado / por prioridad / por tag
- **Columnas de prioridad** — Alta / Media / Baja / Sin prioridad
- **Columnas por tag** — Una columna por tag único + "Sin tag"

### Agentes
- **13 herramientas** incluyendo "Revisión Semanal" con datos en vivo del vault
- **Copiar resultado** — Botón para copiar la respuesta del agente
- **Insertar al diario** — Botón para insertar la respuesta en el diario de hoy
- **Medidor de coste visual** — Barra ▓/░ con estimación de tokens

### Sidebar
- **Secciones colapsables** — Tags/Fijados/Notas con estado persistido en localStorage
- **Sección Áreas** — Con badges de conteo por área
- **Tab Paneles** — Búsquedas guardadas con panel "Tareas de hoy" por defecto
- **Proyectos activos** — Top 5 proyectos en curso en el sidebar
- **Recientes** — Tiempo relativo + botón "Ver todos →"
- **Grid de estadísticas** — 4 métricas en la pestaña Ajustes
- **Pickers densidad + acento** — Directamente en el sidebar
- **Botón "💻 Auto"** — Activa el tema del sistema
- **Links a /files, /inbox, /trash, /chat** — Accesos directos en sidebar

### Captura rápida y notificaciones
- **QuickCapturePanel** — Panel flotante (portal), ⌘Q, ⌘Enter guardar, ⌘⇧Enter guardar+abrir
- **Toggle tarea/favorito** — En el panel de captura rápida
- **Multi-línea** — Primera línea = título, resto = body
- **Toast notifications** — Auto-dismiss 2.5s, tipos success/error/info, animaciones slide-in/out
- **Notificaciones de tareas** — Persistencia en localStorage, agrupación cuando >5 vencidas, ventana de 9:00 AM

### UX y rendimiento
- **Sin FOUC** — Tema/densidad/acento aplicados en `main.tsx` antes de montar React
- **StatusBar contextual** — Palabras y tiempo de lectura en /node/:id; stats en /tasks
- **TopBar** — Muestra título del nodo actual en /node/:id
- **Move modal mejorado** — Navegación ↑↓Enter, breadcrumb de ancestro, recientes sin query
- **Lazy loading** — 12 vistas cargadas con React.lazy() + Suspense
- **Bundle -16%** — 390KB vs 467KB original (gzip)
- **Undo/redo global** — ⌘Z / ⌘⇧Z con historial de 50 estados
- **Modal de nueva nota** — 10 plantillas + plantillas de usuario; detección de duplicados

---

## Web 1.0 — 20 mayo 2026

**Plataforma: Web** (getfrom.app/app)

**Nuevo:**
- Sidebar con 4 tabs: Tags, Fijados, Paneles, Ajustes
- Panel derecho en diario: Pendiente + Timeline del día
- Panel contextual en notas: subtareas, áreas relacionadas, backlinks
- Colores en tags inline (#palabras con 8 colores deterministas)
- Filtros en Tareas: prioridad, estado, ordenación (persistidos en localStorage)
- Diario navegable: botones ← → para ver días anteriores
- Recurrencia en tareas: diaria, semanal, mensual, anual
- Onboarding: 4 pasos para usuarios nuevos (localStorage)
- Indicador de sync animado en esquina inferior derecha
- Grabación de voz → nota (Web Speech API, Chrome/Edge)
- ⌘T nueva tarea · ⌘E nuevo evento · ⌘R grabar voz · Escape → hoy
- Publicar nota con URL pública real (getfrom.app/p/SLUG)

**Arreglado:**
- Paneles del sidebar pre-rellenan la búsqueda correctamente (?q= URL param)
- Panel contextual de notas aparece a la derecha (fix CSS flex-direction)
- Layout del diario con altura correcta (flex: 1; min-height: 0)
- Botón Share publica en servidor y devuelve URL pública real

---

## v3.12 — 20 mayo 2026 — Mac + iOS + Web

### Nuevo
- **From Web** lanzado: editor completo en getfrom.app/app — outliner, diario, tareas, búsqueda, IA, sync en tiempo real
- Login con email/contraseña en Mac e iOS (antes solo Apple ID)
- Login con Google (Google Sign-In) en Mac, iOS y Web
- **iOS**: tab dedicado de Tareas con secciones Vencidas / Hoy / Esta semana / Más tarde / Sin fecha
- **iOS**: botón IA en editor de notas con streaming en tiempo real
- **iOS**: ShareLink en menú de nodo — comparte enlace de cualquier nota
- **iOS**: pantalla de carga animada al iniciar la app
- **Web**: sidebar con 4 tabs (Tags, Fijados, Paneles, Ajustes)
- **Web**: panel derecho en diario (Pendiente + Timeline del día)
- **Web**: atajos Cmd+T (nueva tarea), Cmd+E (nuevo evento), Cmd+R (grabar voz), Escape (ir a hoy)
- **Web**: grabación de voz con Web Speech API → nota (Chrome/Edge)
- **Web**: vista Kanban, vista Calendario semana
- **Web**: exportar datos (JSON + Markdown)

### Mejorado
- Precios actualizados: Free · Pro €7/mes · Anual €49/año · Lifetime €149
- Checkout directo sin cuenta (LemonSqueezy crea la cuenta automáticamente y envía credenciales por mail)
- Manual actualizado con sección de novedades por versión

---

## v3.11 — 13 mayo 2026 — Mac + iOS

### Nuevo
- Extensión MCP para Claude Desktop y Claude Code — instalar en getfrom.app/claude
- Tags unificados con áreas: gestión de contextos por área de trabajo
- Token de API para integraciones (válido 1 año, generado desde Ajustes)
- **iOS**: indicador de plan en Ajustes (Free / Pro / Lifetime / Caducado)
- **iOS**: Google Sign-In

### Mejorado
- Sync más rápido al arrancar: delay reducido de 2s a 0.5s en Mac e iOS
- Indicador de modo offline (wifi.slash, amarillo) en Mac e iOS
- Arquitectura confirmada como local-first: SQLite como fuente de verdad, servidor solo relay

---

## v3.10.1 — 18 mayo 2026 — Mac

### Arreglado
- Si la IA falla al procesar una grabación, la transcripción se guarda automáticamente como bullet — ya no se pierde nada
- Mensajes de error diferenciados: sesión expirada vs sin suscripción vs error genérico

---

## v3.10 — 18 mayo 2026 — Mac

### Nuevo
- IA inline lee el contenido de la nota como contexto ("agrupa estos ejercicios" funciona sin repetir la lista)
- Click en zona vacía de línea coloca cursor al final (estilo Notion)

### Mejorado
- Selector de vista movido a barra superior derecha (iconos compactos, sin texto)
- Panel chat lateral retirado — toda la IA es ahora inline en el editor
- Rendimiento: regex cacheadas, carga en prioridades, debounce 200ms por keystroke, arranque por fases

### Arreglado
- Fix crítico: `getOrCreateDailyNote` ya no borraba el diario existente en arranque concurrente
- Transcripción de voz se guarda automáticamente si falla la IA, sin perder nada
- Mensajes de error de IA diferenciados: sesión expirada vs sin suscripción vs error de red

## Web 1.1 — 20 mayo 2026

**Plataforma: Web** (getfrom.app/app)

**Nuevo:**
- Sidebar hamburger en móvil — sidebar abre/cierra con overlay (fix UX crítico mobile)
- Undo/Redo global (⌘Z / ⌘Shift+Z) en todo el editor — history de 50 estados
- PWA manifest — From Web instalable como app desde Chrome/Edge/Safari
- Vista Agentes real — historial de runs + crear agente manual con system prompt
- 3 agentes predefinidos: Resumir diario, Generar tareas, Análisis semanal
- ✨ Búsqueda IA (Magic Search) — síntesis IA sobre resultados de búsqueda del vault

---
