# Changelog — From

Historial de versiones. Plataformas: Web · Mac · iPhone.

---

## Web v9.6.204 / Mac v9.5.41 — 8 junio 2026 · Contexto IA enfocado + presupuesto en el footer

- **Menos tokens, más foco**: Magic ya no inyecta los 8 contextos más usados en cada mensaje. Ahora inyecta **solo tu Perfil + el contexto del nodo en el que trabajas** (y el que hereda de sus nodos padre). Respuestas más relevantes y más baratas.
- **Presupuesto de contexto en la barra inferior**: «🧠 contexto IA: ~1.2k tokens» — ves de un vistazo cuánto contexto se inyecta para la nota actual.

---

## Web v9.6.203 / Mac v9.5.40 — 8 junio 2026 · La nota del agente es lo que ejecuta

- Ahora **lo que escribes en la nota de un agente es exactamente lo que ejecuta** (antes corría una copia interna congelada, y los agentes que creabas tú salían vacíos). Al ejecutar o programar, From toma el texto de la nota como instrucción — también para las ejecuciones automáticas del servidor.

---

## Web v9.6.202 / Mac v9.5.39 — 8 junio 2026 · Indicador de agentes en la barra inferior + Magic más limpio

- La barra inferior muestra ahora **cuántos agentes activos tienes programados y cuándo corre el próximo** (p. ej. «🤖 2 agentes activos · próxima en 2 h»). Si no hay ninguno programado, muestra «Ningún agente activo».
- **Magic más limpio**: se quitaron los botones de sugerencia (Analizar, Resumir, etc.) del estado inicial. Ahora aparece solo la lista de tus prompts.

---

## Web v9.6.199 / Mac v9.5.38 — 8 junio 2026 · Agentes: controles solo en el panel derecho

- Los controles del agente (**Activo/Pausado**, **Ejecutar**, **programación**, última y próxima ejecución) viven ahora **solo en la columna derecha**. Se quitó la barra duplicada del centro.
- La **nota central de un agente es solo el prompt del usuario** (lo que debe hacer). Se eliminó la línea «⏰ Se ejecuta…» y el prefijo «📨 ».
- Arreglado: el selector de programación del panel derecho no reflejaba horarios como «Diario 08:00» (mostraba «Sin programar»). Ahora muestra el horario real y lo sincroniza con el servidor.

---

## Web v9.6.198 / Mac v9.5.37 — 8 junio 2026 · Prompts en Magic + Ajustes en el panel derecho

- **Prompts en Magic**: al abrir Magic, los prompts aparecen como **lista clicable** (igual que la columna de filtros). Pulsas uno y se activa. Se ha **eliminado el `/`** (ya no hace falta el comando slash para activarlos).
- **Ajustes integrados en From**: la pantalla de Ajustes ahora vive dentro del layout de tres columnas: la **lista de pestañas** (Cuenta, Apariencia, IA, Productividad, Integraciones, Datos) está en la **columna derecha** y el **contenido de cada pestaña en el centro**. Coherente con cómo se muestran agentes, prompts y contextos.

---

## Web v9.6.197 / Mac v9.5.36 — 8 junio 2026 · Exportar HTML + un único menú de nodo

- **Exportar ▸ HTML**: descarga la nota como página HTML autónoma. Y el **PDF** ahora se genera limpio (ventana solo con la nota).
- **Un solo menú de nota**: eliminado el menú duplicado que ya no se usaba; todas las acciones (copiar, exportar, mover, duplicar, publicar, papelera…) viven en un único menú (···).

---

## Web v9.6.196 / Mac v9.5.35 — 7 junio 2026 · Copiar y Exportar en el menú del nodo

- En el menú ··· de una nota: **Copiar ▸ Markdown / Texto rico** y **Exportar ▸ Markdown / PDF**, con **todo el contenido** de la nota (antes "Copiar" solo copiaba el título).
- **PDF limpio**: al exportar/imprimir, el PDF muestra solo la nota (sin barras ni paneles de la app).

---

## Web v9.6.195 / Mac v9.5.34 — 7 junio 2026 · Notas públicas con contenido completo

**Las notas públicas ahora muestran TODO el contenido** (antes solo el título): al publicar se incluye la jerarquía completa de la nota. Al volver a pulsar el botón de publicar en una nota ya pública, se **actualiza** su contenido manteniendo el mismo enlace.

---

## Web v9.6.194 / Mac v9.5.33 — 7 junio 2026 · Buscador en papelera + exportar/copiar completo

- **Buscador en la papelera**: al abrir 🗑 Papelera aparece un buscador para encontrar lo que tiraste.
- **Copiar/Exportar mejorado**: copiar Markdown, copiar texto y exportar Markdown ahora incluyen **toda la jerarquía** de la nota (antes solo el primer nivel). (Exportar PDF, copiar y exportar siguen en el menú ··· de las notas.)

---

## Web v9.6.193 / Mac v9.5.32 — 7 junio 2026 · Notas públicas + restaurar de papelera

- **Notas públicas arregladas**: los enlaces `getfrom.app/p/…` ya abren la nota (antes redirigían a la portada). Funciona también con los enlaces ya compartidos.
- **Restaurar desde la papelera**: el nodo vuelve a su sitio original; si esa ubicación ya no existe, se restaura en 📅 Agenda para que SIEMPRE lo encuentres, y la app te lleva directamente a él.

---

## Web v9.6.192 / Mac v9.5.31 — 7 junio 2026 · Pulidos varios

- **Al enviar a la papelera una nota abierta**, ahora sales automáticamente a su nota padre (antes te quedabas en una página ya borrada).
- **Quitar recurrencia** desde su chip: pasa el ratón y pulsa la ×, o clic derecho.
- **Barra de desplazamiento visible** en las notas (antes era invisible en tema claro).
- **Notas de día/mes/año más limpias**: se quitan los botones de publicar, bucle y el menú ··· (no aplican). En la **nota diaria** queda un botón **📋 Plantillas** para aplicar una plantilla con un clic.

---

## Web v9.6.191 / Mac v9.5.30 — 7 junio 2026 · Las raíces de sistema no se pueden eliminar

**Protección de estructura.** Los nodos de sistema (📅 Agenda, 🧠 Contexto, ⚡ Prompts, 🤖 Agentes, 📋 Plantillas, 🗑 Papelera, 🧠 Perfil de IA, 🏠 From) ya **no se pueden eliminar** — son la estructura de From. Al intentarlo, aparece un aviso y no pasa nada. Así nunca te quedas sin sitio donde crear una plantilla, un agente, etc. (Los duplicados sueltos sí se pueden limpiar normalmente.)

---

## Web v9.6.190 / Mac v9.5.29 — 7 junio 2026 · Limpieza de menús + Perfil IA + Sin clasificar

- **Menú ··· más limpio**: Agentes y Plantillas se abren desde su nodo en el árbol; quedan fuera del menú. Añadido acceso directo a **🧠 Perfil de IA**.
- **Perfil de IA fuera de Contextos**: nunca fue un contexto. Ahora es independiente (no aparece en la lista de contextos ni en el árbol) y se abre desde el menú.
- **Columna derecha como inspector**: quitados los accesos a Contextos/Prompts/Agentes (se navegan por el árbol). Queda filtro, Magic y grabadora, más las propiedades del nodo abierto.
- **"Sin clasificar" en Filtros**: el filtro de notas sin contexto vive ahora junto al resto de filtros, en la columna de la derecha.
- **Contexto solo en la Agenda**: From solo propone contexto a lo que escribes en tu día a día (no a contextos, plantillas, agentes…). Lo que cuelga de un nodo hereda su contexto.
- **Limpieza de chips heredados**: los contextos ya no muestran un chip de sí mismos (etiquetas de contexto antiguas eliminadas automáticamente).

---

## Web v9.6.188 / Mac v9.5.28 — 7 junio 2026 · Fix navegación al limpiar filtro

**Arreglado**: al entrar en una raíz (Contextos, Prompts, Agentes) desde dentro de uno de sus elementos, la app te devolvía a la pantalla principal. Ahora navegas correctamente a la lista. (Limpiar un filtro ya no te saca del nodo en el que estás.)

---

## Web v9.6.187 / Mac v9.5.27 — 7 junio 2026 · El árbol abre colapsado

**Empiezas con la vista limpia.** Al abrir From, el árbol arranca **colapsado**: ves solo los nodos de primer nivel y vas desplegando lo que necesites. Lo que expandas se mantiene mientras usas la app; la próxima vez que abras, vuelve a estar recogido. (Es solo tu vista del momento: no se sincroniza ni cambia nada entre dispositivos.)

---

## Web v9.6.185 / Mac v9.5.26 / iPhone v2.4 — 7 junio 2026 · Una sola raíz: 🏠 From

**Tu segundo cerebro, todo en un mismo árbol.** La pantalla principal ahora muestra, al mismo nivel, **📅 Agenda, 🧠 Contexto, ⚡ Prompts, 🤖 Agentes y 📋 Plantillas**. Antes Agentes, Prompts, Plantillas y Contextos estaban escondidos en menús; ahora son parte del árbol: los despliegas, eliges uno y lo editas ahí mismo.

- **La columna derecha es ahora un inspector.** Al abrir un agente, un prompt o un contexto, sus propiedades aparecen a la derecha automáticamente. Por defecto queda el filtro; el ciclo de paneles es filtro → Magic → grabadora.
- **La nota de hoy, a un toque.** El botón **Hoy** sigue llevándote directo al día. La Agenda es la primera raíz.
- **La Papelera** ya no ocupa sitio en el árbol: vive solo en el menú. Las búsquedas y filtros la excluyen siempre.
- **Mismo comportamiento en web, Mac e iPhone.** La estructura converge entre dispositivos sin duplicar nada (ids deterministas + sincronización por operaciones).
- **Limpieza interna.** Retirado el antiguo concepto de "Paneles": los filtros guardados viven solo en la columna de filtros (y se pueden guardar desde ⌘K). Eliminado código muerto de la barra lateral.
- **Favoritos unificados.** Una sola noción de "favorito" (la estrella del nodo, que sincroniza entre dispositivos). Retirado el sistema duplicado de atajos en almacenamiento local; los favoritos antiguos se migran automáticamente sin perder nada.

---

## Web v9.6.181 / Mac v9.5.23 — 7 junio 2026 · Rendimiento del árbol + robustez

**Listas enormes sin ralentizaciones.** El árbol ahora dibuja solo lo que cabe en pantalla (virtualización): abrir una nota con cientos o miles de elementos es instantáneo y el desplazamiento va fluido. Se activa automáticamente solo en listas grandes; en las pequeñas todo funciona igual que siempre.

- **Más sólido bajo el capó.** El motor de sincronización por operaciones queda idéntico byte a byte en web, Mac e iPhone (se corrigió una diferencia que, en casos raros, podía descodificar mal una etiqueta).
- **Pagos a prueba de fallos.** Si un webhook de pago falla puntualmente, ahora se reintenta de forma segura sin duplicar nada — ninguna compra se queda sin registrar.
- **Limpieza interna.** Retirado el antiguo código de sincronización por estado (ya no se usaba) y añadida integración continua que ejecuta los tests en cada cambio.

---

## Web v9.6.179 / Mac v9.5.22 / iPhone v2.3 — 7 junio 2026 · Migración a op-log completada

From ya funciona **100% sobre el registro de operaciones**, en todos los dispositivos. La carga inicial viene del op-log (`/ops/bootstrap`) y los cambios se propagan como operaciones en tiempo real. El antiguo mecanismo de sincronización por estado — que comparaba el árbol entero y podía inferir borrados — **queda retirado**: el servidor ya nunca infiere un borrado. Es la culminación de la migración estilo WorkFlowy, blindada con tests automatizados del arranque.

- **Tiempo real también desde Claude y agentes.** Lo que creas con los conectores de Claude (MCP) o tus agentes del servidor (p. ej. el informe de mercado) ahora aparece al instante en tus dispositivos, no solo al recargar.
- **iPhone v2.3** con el mismo motor (subida a la App Store en curso).

---

## Web v9.6.173 / Mac v9.5.21 / iPhone — 7 junio 2026 · Sincronización por operaciones (op-log)

**Nuevo motor de sincronización.** From deja atrás la sincronización por estado (que comparaba el árbol entero y podía inferir borrados) y pasa a un **registro de operaciones** estilo WorkFlowy: cada cambio (crear, editar, mover, borrar) es una operación inmutable que se añade a un log. El servidor **nunca infiere un borrado** — solo aplica lo que tú haces. Esto elimina de raíz toda la clase de bugs de duplicación y pérdida de nodos.

- **Tiempo real entre dispositivos.** Los cambios en un dispositivo aparecen en los demás aplicando solo las operaciones nuevas (deltas), sin reconstruir el árbol. Sin parpadeos.
- **Funciona en web, Mac e iPhone** con el mismo motor (relojes lógicos híbridos, resolución por campo, marcas de borrado).
- **Bajo el capó:** log append-only, idempotente, con compactación periódica. Backup automático antes de cualquier operación masiva.

---

## Web v9.6.155–162 / Mac v9.5.18 — 6 junio 2026 · Prompts para Magic + robustez de datos

**Nuevo: Prompts para Magic.** Crea modos de conversación (⚡ Prompts) que cambian cómo te responde Magic. Variables (`{{fecha}}`, `{{nombre}}`…), activación con `/`, automática por contexto, o sugerida. De ejemplo: "Diario del día" y "Brainstorming".

**Paneles unificados.** Contextos, Prompts y Agentes ahora funcionan igual: clic abre el contenido en el centro y sus propiedades a la derecha.

**Agentes de verdad.** Nuevos agentes que producen entregables y navegan la web: 📈 Informe de mercado, 📰 Resumen de prensa, 🔎 Investigar un tema, 🧾 Resumen de un enlace, 🗓 Revisión semanal. Con horario y resultado en tu nota diaria.

**Robustez e integridad de datos (bajo el capó).** IDs deterministas para los nodos únicos (Agenda, Perfil, diario…) → la duplicación de estructura es imposible. Jerarquía temporal unificada entre web, Mac y iPhone. Cortacircuitos que hace un backup automático antes de cualquier borrado masivo. Más historia de backups (50) + copia redundante. **Backup automático a iCloud Drive en Mac** (Ajustes → Accesorios). El contador de backups ahora muestra tus nodos reales (activos).

---

## Web v9.6.152 — 5 junio 2026 · From disponible en el directorio oficial de conectores de Claude

From ya está en el directorio oficial de conectores de Anthropic. Ahora puedes conectar Claude con tu vault desde cualquier dispositivo sin instalar nada ni copiar tokens.

- **Directorio de Claude**: busca "From" en Claude → Ajustes → Conectores, pulsa Conectar e inicia sesión con tu cuenta. Funciona en claude.ai, Claude Desktop, iPhone y Android.
- **OAuth 2.0**: la autenticación es automática — Claude te redirige a From para que inicies sesión, sin tokens manuales.
- **Streamable HTTP**: el servidor MCP de From ahora soporta el transporte Streamable HTTP/SSE requerido por el directorio de Anthropic.
- **UI actualizada**: eliminado el flujo antiguo (.dxt, token manual, URL personalizada) en web, iPhone y documentación. Solo se mantiene como opción avanzada para Claude Code (CLI).

---

## Web v9.6.151 — 5 junio 2026 · OAuth 2.0 para Claude + página de consentimiento

- Implementado flujo OAuth 2.0 completo para el conector de Claude: endpoints `/auth/claude/authorize`, `/auth/claude/token` (PKCE S256) y discovery `/.well-known/oauth-authorization-server`.
- Nueva página `/app/claude-connect` — pantalla de consentimiento "Conectar From con Claude".
- Servidor MCP: herramientas actualizadas con `title` y anotaciones `readOnlyHint`/`destructiveHint` en todas las tools.

---

## Web v9.6.149 — 5 junio 2026 · Planificador: eliminar evento sincroniza con Google Calendar

- Nuevo botón **"Eliminar evento"** en el menú contextual del planificador: elimina la tarea de From Y borra el evento en Google Calendar. Antes "Quitar del planificador" solo quitaba la hora sin borrar nada; ahora coexisten las dos opciones según lo que quieras hacer.
- Fix: eventos GCal creados por From ya no aparecen duplicados en el planificador (se filtra por `gcalEventId`).
- Fix: "Eliminar bloque" renombrado a "Eliminar evento" para eventos nativos de GCal; ahora llama correctamente a la API de Google Calendar para borrarlos.

---

## Web v9.6.147 — 5 junio 2026 · Política de privacidad y Google OAuth

- Eliminado el scope `drive.file` de la integración Google (no se usaba).
- Política de privacidad (ES + EN) actualizada: sección Google Calendar más precisa, añadido el texto de cumplimiento "Limited Use" exigido por Google.

---

## Web v9.6.145 — 5 junio 2026 · Blog, distribución y emails

### Blog
- 22 artículos nuevos (ES+EN): Magic, Accesorios, Núcleo, Avanzado, Confianza/Comparativas. Todos con capturas reales de la app y CTA a registro.
- Artículo fundador "Por qué hice From" (~2500 palabras, ES+EN): historia personal de los 6 problemas con apps de notas que llevaron a construir From.

### Distribución
- Artículo fundador publicado en LinkedIn (ES+EN, artículos nativos con imagen de portada real).
- Enviado a Hacker News con comentario del fundador.

### Capturas reales
- 15 screenshots nuevas de la app v9.6.145 integradas en el blog y la landing.
- Hero carousel actualizado con capturas que muestran badges de contexto, clasificación automática, subnodos.

### Emails (52 templates ES+EN)
- Todos los emails actualizados a la nueva realidad: detección automática de tipo/fecha/contexto, sin sintaxis manual.
- Serie fundador nueva: 10 emails en FREE + 3 en PRO (historia personal, objeciones, CTA a conversación directa).
- Cadencia mensual evergreen: 6 emails que se enolan automáticamente al terminar la secuencia principal.
- +22 tips en Telegram (total 62), cada uno vinculado a un artículo del blog.

### Fixes
- Hint "Espacio · crea o busca" ocultado cuando la agenda tiene contenido (solo aparece en cuentas nuevas vacías).
- Iconos de vista (tabla/kanban/calendario) eliminados de nodos de Agenda (día, mes, año).
- Vista forzada a lista en notas diarias — no se puede activar calendario en el propio día.

---

## Web v9.6.141 · Mac v9.5.13 — 5 junio 2026 · Accesorios: captura en From desde cualquier sitio

From sale de su ventana. Ahora puedes mandar lo que tengas a tu nota de hoy desde el sistema, desde Raycast o desde el navegador — y From lo entiende y lo coloca en su sitio.

### Barra de menús (Mac)
- From vive en la barra de menús con su icono. Clic → ventana de **captura rápida** (estilo Spotlight) para crear nota, tarea o evento al vuelo. From detecta el tipo, la fecha y los @contextos del texto.
- Se puede **ocultar** el icono: en Ajustes → Accesorios, o con clic derecho en el icono → "Ocultar este icono".

### Atajo de Apple (tecla global)
- **Atajo listo para instalar** en un clic (enlace iCloud): te pide el texto y lo guarda en tu nota de hoy, desde cualquier app.
- Asígnale la tecla global que quieras desde la app Atajos. Por debajo usa el enlace `from://capture?text=…&silent=1`.

### Raycast
- Extensión de From para Raycast: **Crear**, **Buscar** y **Abrir la nota de hoy**. Al crear, From decide nota/tarea/evento con su inteligencia.

### Chrome
- Extensión de From para Chrome: clic en el icono → guarda la URL de la pestaña en tu nota de hoy; selecciona texto + clic derecho → lo manda como nodo.

### Dónde está todo
- Nueva página **Accesorios** en la web (enlazada desde el menú) y nueva pestaña **Accesorios** en Ajustes de From. Todos usan el mismo **token de API** (Ajustes → Accesorios), el mismo que la integración con Claude.

### Bajo el capó / fixes
- Deep links nuevos: `from://capture` (captura) y `from://node/<id>` (abrir una nota).
- **Icono oficial de From** (árbol azul) unificado en app, barra de menús y extensiones.
- Fix: error "failed to unpack" del actualizador (el `.tar.gz` ahora se genera sin archivos AppleDouble).
- Fix: borde fino alrededor de la ventana principal (desactivado el macOS private API) y ventana de captura sin marco.

---

## Web v9.6.136 · Mac v9.5.8 — 4 junio 2026 · Captura rápida desde cualquier sitio

From sale de su ventana. Ahora puedes capturar al vuelo sin cambiar de app, y abrir o buscar tus notas desde las herramientas que ya usas.

### Icono en la barra de menús (Mac)

- From vive en la barra de menús con el icono **⚡**. Un clic abre una **ventana flotante de captura** (estilo Spotlight) para crear una nota, tarea o evento al instante — con la misma inteligencia que dentro de From (detecta tipo, fecha y contexto).
- Buscar cualquier nota desde esa ventana y abrirla en la app.
- Cerrar la ventana principal ya no cierra From: sigue disponible en la barra de menús.

### Atajo de Apple — tu tecla global

- Nuevo esquema de enlace `from://capture?text=…&silent=1`: añade texto directamente a tu nota de hoy, sin abrir nada.
- Crea un Atajo de macOS con «Abrir URL» y asígnale la tecla global que quieras. Así tienes captura global con la tecla que tú elijas — sin chocar con los atajos de From ni de otras apps.
- Guía paso a paso en **Ajustes → Captura rápida**.

### Integración con Raycast

- Extensión de From para Raycast: **Crear en From**, **Buscar en From** y **Abrir nota de hoy**, sin salir de Raycast.
- Se conecta con tu token de API (el mismo que usa la extensión de Claude). Genera y copia el token en **Ajustes → Captura rápida → Raycast**.

### Enlaces profundos

- `from://node/<id>` abre cualquier nota directamente en la app del Mac (lo usa Raycast y se puede usar desde Atajos).

---

## Web v9.6.135 · Mac v9.5.7 — 4 junio 2026 · La capa de inteligencia de From

Esta es la versión en la que From deja de ser "un outliner con IA" y pasa a ser un sistema que **te entiende, sabe lo que quieres y elimina la fricción**. No hablamos de IA genérica: hablamos de que escribes como piensas y From se encarga del resto, en segundo plano y sin que tengas que mantener nada.

### Contextos automáticos con jerarquía

- From clasifica cada nota en el contexto al que pertenece (trabajo, familia, un proyecto concreto) mientras escribes, **entendiendo la jerarquía** de contextos y subcontextos.
- Si una nota necesita un contexto que aún no existe, From puede **crear el subcontexto** automáticamente en el lugar correcto del árbol.
- El clasificador es consciente de la jerarquía: una nota de "La Isla" va dentro de "Trabajo › La Isla", no en una etiqueta plana.
- El badge de contexto aparece junto a cada nodo con la sugerencia de From; un clic la confirma o la cambia. Los contextos y los nodos estructurales (Año/Mes/Agenda) nunca muestran badge — no se preguntan a sí mismos en qué contexto están.
- Clasificación en bloque: "Clasificar todos" procesa de una vez todos los nodos antiguos sin contexto, con barra de progreso y cancelación.

### "Lo que From sabe" — conocimiento por contexto

- Cada contexto acumula su propio conocimiento vivo: **Palabras clave**, **Personas** y **Temas frecuentes**.
- From lo extrae solo a partir de las notas que clasificas en ese contexto y lo **mantiene al día**: cuando añades algo nuevo, fusiona la información nueva con la que ya había (sin duplicar) en lugar de reescribirlo todo.
- La actualización es proactiva: al clasificar nodos en un contexto, From programa una actualización del conocimiento de ese contexto (con deduplicación y cooldown para no recalcular de más).
- Si sigues editando un nodo ya clasificado durante horas o días, From vuelve a aprender del nuevo contenido (re-disparo con debounce de 30 min).
- El servidor solo extrae **información nueva** que no estuviera ya en el contexto: si no hay nada que añadir, no toca nada.

### Tu perfil — From te recuerda

- From construye un perfil tuyo a partir de lo que escribes: tus proyectos, las personas estables de tu vida, tus objetivos y activos a largo plazo.
- Filtra el ruido: **solo retiene lo que perdura**, no las tareas del día ni los problemas temporales. Y sintetiza en vez de copiar literal ("Me voy a casar" → "Tiene planes de matrimonio con su pareja").
- El aprendizaje se guarda aunque salgas del nodo, navegues a otra página o el nodo lo cree un agente (extracción en el desmonte, sin perder nada).
- "Mi perfil" abre el nodo de tu perfil en el área central, no como un filtro.

### Enseñar a Magic

- Clic derecho en cualquier nodo → **Enseñar a Magic**. Le corriges: "esto no es una tarea", "va en este contexto". From aprende de la corrección y la aplica desde ese momento en toda clasificación posterior.
- Los aprendizajes y los ejemplos del clasificador se **guardan como nodos** dentro de tu árbol (respaldados, migrados desde el almacenamiento local), así viajan con tu cuenta y sobreviven entre dispositivos.

### Búsqueda y navegación sin fricción

- **Resaltado de coincidencias**: al buscar texto libre, From subraya en amarillo las palabras que coinciden dentro de cada nodo, para que las encuentres de un vistazo aunque haya mucho texto.
- **Al eliminar una nota, From navega a la nota padre** en vez de dejarte mirando una nota que ya no existe.
- Buscador de la columna Filtrar: cualquier palabra filtra al instante por el texto de cualquier nodo de la Agenda.
- Filtros y captura rápida acotados a la Agenda (no rebuscan en contextos, papelera ni sistema).
- Favoritos: clic para navegar a la nota, con editar y eliminar al pasar el ratón.

### Estabilidad

- Corregido a fondo el bucle de renders (React #310) al abrir páginas `/node/…`: claves estables de tipos, updaters que no crean objetos nuevos si nada cambió, y cooldowns fuera de `extraData`.
- Corregido el doble-clic (seleccionar palabra) y el reposicionado del cursor dentro de un nodo, sin tocar la colocación del cursor (regla sagrada v9.4.57).

---

## Web v9.6.70 — 4 junio 2026 · Filtros como raíces flotantes (Workflowy-style)

### Mejora: todos los filtros muestran resultados como raíces flotantes con breadcrumb

Al activar cualquier filtro en From (contexto, tipo, búsqueda de texto o "Sin clasificar"), los nodos resultado ahora se muestran como **raíces flotantes independientes** con un breadcrumb de texto indicando su posición en el árbol.

**Comportamiento anterior:**
- El filtro por contexto expandía el árbol completo usando `ancestorIds`, montando miles de OutlinerNode simultáneamente → lentitud y freeze potencial.

**Comportamiento nuevo:**
- Cada nodo resultado aparece como raíz independiente en la vista filtrada.
- Encima de cada resultado, un breadcrumb gris muestra el camino desde la raíz hasta el nodo (`Agenda › Trabajo › La Isla`).
- Los ancestros son texto plano — sin coste de renderizado.
- El nodo resultado y sus hijos son OutlinerNode normales, expandibles/colapsables.
- Paginación automática (40 elementos por página) con botón "Cargar más".

Esto afecta a **todos** los filtros:
- Filtro por contexto (`@La Isla`, `@Personal`, etc.)
- Filtro "Sin clasificar"
- Búsqueda de texto (vista lista)
- Cualquier filtro futuro

---

## Web v9.6.63 — 4 junio 2026 · Fix filtro "Sin clasificar"

### Fix: el contador "Sin clasificar" ya no incluye párrafos sueltos

El filtro **"Sin clasificar"** del panel de contextos ahora solo muestra nodos que realmente tienen sentido clasificar:

- **Nodos contenedor** (con hijos) — por ejemplo, una nota de proyecto con bullets dentro
- **Tareas** (con checkbox) — pendientes o completadas

Los párrafos sueltos (bullets simples sin hijos y sin checkbox) quedan excluidos automáticamente. No tiene sentido asignarles un contexto ya que son contenido dentro de otros nodos, no entidades independientes.

**Impacto:** el contador puede pasar de cientos/miles de nodos a un número mucho más manejable y representativo.

---

## Web v9.6.62 — 4 junio 2026 · Clasificación batch de nodos históricos

### Nueva feature: "Clasificar todos" en el panel de contextos

Ahora puedes clasificar de un solo clic todos los nodos que ya existían antes y no tienen contexto asignado.

**Cómo funciona:**

- En el panel de contextos (columna derecha), bajo el filtro **"Sin clasificar"**, aparece el botón **"✦ Clasificar todos"**.
- Al pulsarlo, From analiza en background todos los nodos sin contexto usando IA (Claude Haiku).
- Se procesan en lotes de 5, con una **barra de progreso** que muestra "Clasificando… X/Y nodos".
- Puedes **cancelar** en cualquier momento con el botón ✕.
- Al terminar, muestra "X nodos clasificados" durante unos segundos.
- Los nodos con confianza ≥ 30% reciben el contexto sugerido automáticamente (umbral más permisivo que el badge en tiempo real).
- A diferencia del badge, estos nodos NO quedan marcados como "asignados manualmente" — si la IA se equivoca, el usuario puede corregir sin restricciones.

---

## Web v9.6.61 — 4 junio 2026 · Auto-clasificación de contextos con IA

### Nueva feature: Auto-clasificación inteligente de contextos

From ahora sugiere automáticamente el contexto más apropiado para cada nota o tarea que creas.

**Cómo funciona:**

- **Badge automático**: aproximadamente 1 segundo después de crear o editar un nodo (sin contexto asignado), aparece un badge pequeño `✦ NombreContexto` junto al texto.
- **Alta confianza** (≥ 60%): el badge muestra el nombre del contexto en su color.
- **Baja confianza** (< 60%): el badge aparece en gris con `?`.
- **Asignación manual**: haz clic en el badge → se despliega la lista de contextos → selecciona el correcto. From aprende de tu corrección para mejorar futuras sugerencias.
- **Opción "Sin contexto"**: si el nodo no pertenece a ningún contexto, puedes indicarlo desde el mismo dropdown.

**Vista "Sin clasificar":**

En el panel de contextos (columna derecha) aparece un filtro especial **"Sin clasificar"** con el número de nodos que no tienen contexto asignado. Al hacer clic, el árbol se filtra mostrando solo esos nodos para que puedas revisarlos y organizarlos.

**Privacidad y coste:**

La clasificación usa Claude Haiku (modelo rápido y económico), con el mismo presupuesto gratuito de micro-operaciones del sistema. No consume tokens de tu plan.

---

## iOS v2.2 / Web v9.6.60 — 4 junio 2026 · App iPhone renovada, favoritos y polish

### iPhone — Tab "Explorar" rediseñado

La pestaña Explorar del iPhone ahora muestra filtros reales, idénticos a los de la web:

- **Tipo**: Nota, Tarea, Evento, Archivo, Enlace
- **Fecha**: Hoy, Esta semana, Este mes, Pasado, Futuro
- **Estado**: Pendiente, Hecho, Sin fecha, **Bucle** (notas con tareas pendientes en su interior)
- **Contextos** (chips morados): filtra todos los nodos con ese contexto asignado — los mismos contextos que aparecen en la web
- **Filtros guardados** (chips azules con 🔖): acceso directo a tus paneles personalizados

Los chips son multiselect y combinan con AND. Al activar un filtro guardado, reemplaza la selección actual. Los resultados aparecen debajo con el count y la lista de nodos.

### iPhone — Tab "Buscar" mejorado

El teclado se abre automáticamente al entrar en Buscar. En el estado vacío (antes de escribir) se muestran los nodos marcados como **Favorito** para acceso rápido. La lista de resultados cierra el teclado al hacer scroll.

### iPhone — Toolbar simplificado

El panel de detalle de nodo (IOSNodeDetailView) solo muestra el botón `...` (más opciones) en la toolbar. El micrófono y el botón de IA estaban causando confusión y se han eliminado.

### iPhone — Sin banner de "Plan caducado"

Eliminado el banner que aparecía incorrectamente a usuarios Pro durante el arranque en frío mientras se cargaba la suscripción. La app nunca mostrará ese banner salvo que la suscripción esté realmente caducada.

### Web — Favoritos en la búsqueda

La columna de búsqueda/filtros ahora muestra una sección **Favoritos** al final de los paneles guardados. Los nodos marcados con ⭐ aparecen ahí para acceso de un clic. También puedes filtrar por `favorito` en el campo de filtros.

El atajo `⌘⇧F` marca/desmarca cualquier nodo como favorito sin abrir menús.

### Web — Limpieza de interfaz

- **Botón pin eliminado** de la vista de nodo (NodeView). Ya no hay "Añadir a atajos" — los favoritos son el mecanismo estándar.
- **"Añadir a atajos" eliminado** del slash menu.
- **Emails con @** en el texto del nodo ya no se detectan incorrectamente como @contextos (fix del renderizador inline).
- **Fix**: nodos con hora detectada automáticamente (reuniones, llamadas) se crean correctamente como eventos, no como tareas.

### App Store — localización España y multiidioma

From iOS ahora tiene localización en **6 idiomas**, con **Español (España) como idioma primario**. Esto corrige un bug que impedía que la app apareciera correctamente en búsquedas del App Store en España y otros países hispanohablantes.

Idiomas disponibles: Español (España) · Inglés · Alemán · Francés · Italiano · Portugués (Brasil).

---

## Web v9.6.55 — 3 junio 2026 · Nodos de enlace, PDFs, Pizarras

### Nodos de enlace / URL

Pegar una URL en un nodo vacío lo convierte automáticamente en un **nodo de enlace**: el sistema hace unfurl de la página (obtiene título, favicon y tipo), y el nodo queda con el título real de la web y un icono de cadena (🔗) que sustituye al punto del bullet. En la vista de nodo, el icono de enlace aparece junto al título en lugar del checkbox.

- El botón **↗** aparece inline al lado del texto para abrir la URL externa.
- Al hacer clic en el bullet (icono de cadena) se navega a la nota, igual que cualquier otro bullet.
- Al editar el texto del nodo, la URL se preserva en `extraData` y no se pierde.
- Al pegar una URL sobre texto seleccionado, se aplica como `[texto](url)`.

**Fix de encoding**: los títulos con tildes, ñ y otros caracteres especiales se decodifican correctamente. El bug anterior era que `TextDecoder` se creaba una vez por chunk; al estar un carácter multi-byte (como `ñ` = 0xC3 0xB1) partido entre dos chunks, se perdía. Ahora el decoder usa `stream: true` y se reutiliza entre chunks. También se decodifican entidades HTML del título (`&ntilde;` → `ñ`).

**Fix de paste**: al copiar un enlace desde Chrome, el portapapeles a veces incluía atributos HTML en `text/plain` (ej: `https://url" target="_blank" rel=...`). Ahora el handler detecta ese patrón y extrae la URL limpia desde `text/html`.

### PDFs arrastrables

Arrastra un archivo PDF desde Finder a cualquier nodo para subirlo a la nube. Se crea un nodo hijo con badge **PDF** (rojo) que muestra el visor de PDF al abrirlo. Puedes anotar el PDF con:

- **Lápiz** — trazo libre con selección de color y grosor
- **Subrayado** — pincel semitransparente amarillo
- **Texto** — clic para insertar texto flotante
- **Borrador** — eliminar anotaciones

Las anotaciones se guardan en From y se incrustan permanentemente en el PDF cuando sales.

### Pizarras digitales

Escribe `/Pizarra` en cualquier nodo para convertirlo en una pizarra digital SVG. También se activa si escribes `pizarra` o `whiteboard` en cualquier parte del texto (aparece ghost text de confirmación). Las pizarras usan las mismas herramientas que el visor de PDF.

---

## Web v9.6.20 / Mac v9.5.2 — 2 junio 2026 · Planificador rediseñado y filtros en tiempo real

### Planificador — nuevo modelo de datos

El planificador ha sido rediseñado de raíz. Antes, arrastrar una tarea al planificador creaba un nodo duplicado ("time block") y podía mover el nodo original fuera de su lugar en el árbol. Ahora **el nodo nunca se mueve**: el drag simplemente asigna una hora al nodo original, y el planificador lo muestra en el hueco de tiempo correspondiente.

**Franja "Todo el día"**: nueva zona encima del timeline en cada columna del día. Muestra las tareas con fecha asignada pero sin hora, y los eventos de todo el día de Google Calendar. Puedes arrastrar cualquier elemento de esa franja al timeline para asignarle una hora concreta, o desde el árbol directamente a la franja para asignar solo fecha.

**Sincronización con Google Calendar al planificar**: si tienes Google Calendar conectado, asignar una hora a una tarea en el planificador crea automáticamente un evento en Google Calendar. Si mueves o redimensionas el bloque, el evento se actualiza. Si quitas la hora, el evento se elimina.

**Context menu mejorado**: clic derecho sobre cualquier bloque permite "Quitar hora (→ todo el día)", "Quitar del planificador", "Ir al nodo" y cambiar el color.

### Filtros en tiempo real

Los filtros ahora se recalculan al instante cuando cambia cualquier propiedad de un nodo: si mueves una tarea a mañana mediante el botón "→ mañana", desaparece del filtro de hoy sin necesidad de recargar. Antes era necesario refrescar la página para que el filtro se actualizara.

Cuando un nodo deja de cumplir el filtro activo, sale con una animación: desliza hacia la derecha con fade-out antes de desaparecer, en vez de desaparecer bruscamente.

### Fixes — Enter crea hermano en todos los casos

Al escribir un texto y convertirlo en tarea (`-t` + Enter), evento (`-e` + Enter), o al aceptar la predicción automática de tarea+fecha (Enter en el ghost text), ahora siempre se crea un nodo hermano vacío debajo con el cursor listo. Antes el cursor se quedaba en el mismo nodo.

---

## Web v9.5.56 / Mac v9.5.1 — 2 junio 2026 · Captura unificada y polish UX

### Captura unificada — un solo modal para todo
Pulsar **Espacio** o el botón **+** abre ahora un único modal que hace todo: crea notas y busca nodos a la vez. Ya no hay un modal de "captura rápida" separado y una paleta de comandos separada — es uno solo.

Sin texto muestra los accesos rápidos: Hoy, Mañana, Filtros y Contextos. En cuanto escribes, aparecen resultados de búsqueda con la opción de crear al final. El ghost text de predicción (fechas, tareas, contextos) sigue funcionando igual que antes.

**Espacio inteligente:** si el input activo está vacío (un nodo en blanco, el filtro sin texto, Magic sin texto), Espacio abre el modal en vez de insertar un espacio. Cuando hay texto, Espacio funciona con normalidad.

### Columna derecha: título y alineación
Cada columna (Filtro, Magic, Contextos, Grabación) tiene ahora un título al inicio con la misma tipografía que el título de la nota: **26px, negrita**. El título y el primer elemento de la columna quedan a la misma altura que el título de nota y el primer nodo del árbol respectivamente.

### Columna de filtros abierta por defecto
Al abrir From, la columna de filtros ya aparece visible por defecto. La preferencia se guarda: si la cierras, la próxima sesión empieza sin ella.

### Headings markdown desde agentes externos
Los nodos creados por Claude u otros agentes con prefijos markdown (`### Título`, `## Título`, `# Título`) se detectan y renderizan automáticamente como headings. En segundo plano, el nodo se normaliza (quita el prefijo del texto y guarda el tipo en los metadatos).

### Breadcrumb sin truncar
El breadcrumb del topbar usa ahora todo el espacio disponible entre los botones de navegación y los iconos de la derecha. El nodo actual ya no se trunca.

### Botón ⌘K eliminado
El botón rayo del topbar desaparece. Todo el acceso a búsqueda y creación está en Espacio y el botón +.

---

## Web v9.5.46 — 2 junio 2026 · ⌘K rediseñado, contextos, filtros

### ⌘K más limpio y potente
La paleta de comandos tiene ahora una vista por defecto ordenada: **Hoy**, **Mañana**, **Filtros →** y **Contextos →**. Sin ruido. Al hacer clic en Filtros o Contextos se abre una subvista dedicada donde puedes navegar con ↑↓ y seleccionar con Enter. Escape vuelve siempre al menú principal.

Para buscar un contexto específico escribe su nombre directamente — From lo detecta y lo abre. Al escribir "contextos" aparece la lista completa.

### Filtros guardados: renombrar y eliminar
En la columna de filtros puedes pasar el ratón sobre un filtro guardado y aparecen dos botones: un lápiz ✏ para renombrar (edición inline, Enter confirma) y una × para eliminar (se pone roja en hover).

### Confirmación al crear notas
Al guardar algo con la captura rápida (o desde ⌘K) aparece una tarjeta de confirmación en la esquina inferior derecha: "✓ Nota creada", "✓ Tarea creada" o "✓ Evento creado".

### Filtro de contexto mejorado
Al hacer clic en un contexto en la columna derecha, el filtro busca ahora dentro del árbol de Agenda (no en la propia rama de Contextos). Encuentra nodos que tienen el @contexto en su campo de tipos o que lo mencionan con @ en el texto. Mucho más rápido y sin bloqueos.

---

## Web v9.5.17 — 2 junio 2026 · Rediseño UX completo

### Agenda como vista principal
La vista de inicio muestra directamente los años (2026, 2027...) sin mostrar el nodo "Agenda" como intermediario. El árbol empieza donde importa. El breadcrumb va `🏠 › 2026 › Junio › ...` directamente.

### Sistema de Contextos en el sidebar
El sidebar izquierdo tiene ahora una sección **CONTEXTOS** debajo de PANELES con todos tus contextos listados. Funciona así:
- **Clic en un contexto**: filtra el árbol central mostrando todos los nodos con ese contexto + abre el contexto en el panel derecho como outliner editable
- **Botón +**: crea un nuevo contexto directamente desde el sidebar sin navegar a ningún nodo
- **Chevron ›**: despliega sub-contextos que tienen contenido
- **Escape**: deselecciona el contexto activo y cierra el panel

### Paneles reorganizables con drag & drop
Arrastra los paneles del sidebar para reordenarlos. Desaparece el botón "abrir como nodo" — los paneles son paneles, no nodos.

### Nodos sistema accesibles desde el menú ···
Agentes, Plantillas y Papelera ya no aparecen en el árbol principal. Se accede a ellos desde el menú `···` (arriba a la derecha). También disponibles desde ⌘K.

### IA inline eliminada del outliner
Se elimina el chat IA inline (Cmd+Space dentro de un nodo). El panel Magic cubre completamente este caso con más contexto, historial y mejor UX.

### Planificador mejorado
- **Resize sin zoom**: arrastrar el divisor del planificador ya no cambia el zoom del contenido
- **Calendario año responsive**: se adapta al ancho del panel
- **Clic en día del año**: navega directamente al nodo de ese día en la Agenda

### QuickCapture mejorado
- Enter acepta la sugerencia de contexto (primer Enter) y luego crea el nodo (segundo Enter)
- La fila del ghost text siempre reserva espacio — el modal no salta al aparecer una sugerencia

### Escape inteligente
- Escape con contexto activo → deselecciona y cierra el panel
- Escape con filtro de panel activo → limpia el filtro y vuelve a la agenda

---

## Web v9.4.60 — 1 junio 2026 · Fix empty state en nodos vacíos

### "Nota vacía" ya no aparece al abrir un nodo sin contenido
Al abrir un nodo vacío ya no aparece el mensaje "Nota vacía / Haz clic aquí...". Se muestra directamente el bullet vacío listo para escribir.

---

## Web v9.4.59 — 1 junio 2026 · Bugs críticos outliner + UX

### Cursor donde haces clic (CRÍTICO)
El cursor del ratón ahora se coloca exactamente donde haces clic dentro de un nodo, en lugar de ir siempre al final. También se resuelve el problema de pérdida de foco al hacer clic. Incluye soporte correcto para clics en los badges de fecha/recurrencia.

### Menú contextual siempre visible
El menú de botón derecho ya no se corta por la parte inferior de la pantalla, independientemente de cuántas opciones tenga abiertas.

### Triple clic selecciona todo el texto
Haz triple clic en cualquier nodo para seleccionar todo su contenido.

### Espejos eliminados al borrar el original
Al eliminar un nodo (incluso con Backspace en un nodo vacío), los espejos que lo referencian se eliminan automáticamente.

### Drag & drop mejorado — soporte de indentación
Al arrastrar un nodo, suéltalo en el lado derecho de otro nodo para convertirlo en hijo (indentar). Suéltalo en el lado izquierdo para reordenar como hermano.

### Badge de fecha en tareas y eventos
Las tareas y eventos con fecha de vencimiento muestran un badge con la fecha ("hoy", "mañana", "lun 8 jun"). Las fechas pasadas aparecen en rojo.

### Recurrencia "cada 2 lunes", "cada 3 martes"...
El sistema de recurrencia ahora reconoce patrones como "cada 2 lunes" o "cada 3 martes" (semanal con intervalo en un día concreto).

---

## Mac v9.4.16 · Web v9.4.46 — Junio 2026 · Actualizador automático verificado

### Actualizador automático — confirmado funcionando (Mac)
- El actualizador automático se ha verificado en entorno real: detecta la nueva versión, descarga, instala y relanza la app con un solo clic sin intervención manual
- Versión Mac visible en la barra inferior: `v9.4.XX · Mac 9.4.XX`
- Menú nativo macOS: **From → Buscar actualizaciones...** para forzar la comprobación al instante

### Proceso de instalación y release Mac (interno)
- Corrección del proceso de publicación: el artefacto del updater es `From.app.tar.gz` (no el DMG)
- Para instalar From Mac correctamente: arrastrar desde el DMG a Aplicaciones en Finder
- El DMG notarizado garantiza que la app se ejecuta directamente desde `/Applications/` sin restricciones del sistema

---

## Mac v9.4.6 · Web v9.4.41 — Junio 2026 · Pagos y suscripciones corregidos

### Flujos de pago y suscripción completamente revisados (Web · Mac · Servidor)

Revisión completa de todos los flujos de alta, suscripción, cancelación y renovación. Se han corregido seis errores que podían impedir que la cuenta se actualizase correctamente tras completar un pago.

- **Upgrade funciona desde todos los puntos**: el botón de suscripción en la app, el banner superior y el modal de límite ya generan un checkout correctamente vinculado a tu cuenta
- **La cuenta se actualiza sola al volver del pago**: al completar el checkout y volver a la app, el estado Pro aparece automáticamente en segundos sin necesidad de recargar
- **Cupones del 100% funcionan correctamente**: suscripciones o licencias activadas con cupón de descuento total ya actualizan el plan sin necesidad de pagar
- **Cancelación disponible durante el periodo de prueba**: ahora puedes cancelar desde Ajustes tanto si estás en suscripción activa como en periodo de prueba
- **Topup de tokens corregido**: el botón "Comprar más tokens" ya lleva al producto correcto (tokens adicionales), no a una segunda suscripción
- **Indicador de pago pendiente**: si un pago falla, la app muestra el estado "Pago pendiente" claramente en Ajustes

### Descarga directa desde getfrom.app (Web)
- El botón "Descargar para Mac" en la cabecera descarga el archivo directamente sin redirigir a la sección de descarga

### Integración con Claude — MCP (Servidor)
- Nuevo tool `from_create_tree`: crea un nodo con toda su estructura de hijos en una sola llamada. Ideal para que Claude guarde resúmenes estructurados
- Nuevo tool `from_update_session`: actualiza una sesión existente añadiendo nuevos nodos hijos
- Corrección: la nota del diario de hoy se identifica por fecha real, no por flag interno (eliminaba race condition de zona horaria)
- Todo el contenido creado por Claude va en nodos hijos — nunca en campos internos del sistema

---

## Mac v9.4.4 / v9.4.5 — Junio 2026 · Actualizador automático

### Actualización automática desde la app (Mac)
- **Primera versión con actualización automática**: a partir de ahora, cuando haya una nueva versión disponible, aparecerá `✦ Nueva versión X.X.X — Actualizar` en la barra inferior de From
- Un clic descarga e instala la actualización sin salir de la app ni reiniciar manualmente
- El sistema comprueba si hay novedades 5 segundos después de abrir From, y luego cada hora
- Esta es la **última vez que hace falta descargar manualmente** desde la web

### Sincronización mejorada (Mac)
- El sync con el servidor ahora se ejecuta desde Rust cada 15 segundos, independientemente de si la ventana está en primer plano o en background
- Sync inmediato al recuperar el foco de la ventana

### Fix (Web · Mac)
- Escape en ⌘K cierra la paleta sin subir un nivel en el árbol

---

## iOS v2.2 — Junio 2026 · Internacionalización iOS

### iPhone — Internacionalización completa (iOS)
- Interfaz completamente traducida al inglés para usuarios no-españoles
- Detección automática de idioma según la configuración del dispositivo
- Fechas, horas y formatos regionales adaptados al idioma del usuario (Locale.current en todas partes)
- Ajustes, sincronización, cuenta, IA y todos los menús disponibles en inglés

### Soporte para trial en iPhone (iOS)
- Badge y etiqueta de plan correctos durante el periodo de prueba gratuita
- `trialing` reconocido como acceso Pro completo en todas las pantallas

---

## v9.4.24 — Mayo 2026 · Internacionalización completa ES/EN

### App web en inglés (Web)
- 50+ componentes y 710 claves de traducción — toda la interfaz disponible en inglés
- Detección automática de idioma por configuración del navegador
- Selector manual en **Ajustes → Idioma** (icono 🌐) con aplicación inmediata
- Cualquier idioma no-español detectado por el navegador → interfaz en inglés

### Landing y Blog en inglés (Web)
- Landing getfrom.app disponible en inglés en `/en/`
- Blog en inglés en `/blog/en/` con 13 artículos traducidos
- SEO bilingüe — URLs canónicas y hreflang correctamente configurados

### Magic AI bilingüe (Web · Servidor)
- Magic responde en el idioma del usuario (español o inglés) de forma automática
- Los filtros del árbol son bilingüe: `today/task/pending/done/week` equivalen a sus versiones en español
- Los chips de sugerencia del filtro cambian de idioma según la configuración

### Email marketing bilingüe (Servidor)
- Las secuencias de nurturing se envían en inglés a usuarios con locale no-español
- Detección de idioma en el momento del registro, persistida en el perfil

---

## v9.4.20 — Mayo 2026 · Email marketing, Trial 7 días y Telegram

### Trial de 7 días con tarjeta (Web · LemonSqueezy)
- Cualquier usuario puede activar una prueba gratuita de 7 días con todas las funcionalidades Pro
- Se requiere tarjeta de crédito; si no se cancela, pasa automáticamente al plan Pro mensual
- Badge "Prueba gratuita · X días restantes" visible en la barra superior durante el trial
- Acceso completo a IA, nodos ilimitados y todas las integraciones durante el periodo de prueba

### Sistema de email nurturing (Servidor)
- Secuencias automáticas para cada tipo de usuario: free, pro, lifetime y trial
- Emails de bienvenida, activación de features, recordatorios y retención
- BCC de control en todos los emails salientes para supervisión
- Gestión completa vía Railway + LemonSqueezy webhooks

### Canal de Telegram @FromMagicBot (Telegram)
- Canal oficial con tips semanales sobre cómo sacar el máximo partido a From
- Automatización completa: los tips se envían sin intervención manual
- Suscríbete desde getfrom.app o directamente en Telegram buscando @FromMagicBot

---

## v9.4 — Mayo 2026 · Onboarding, paneles rediseñados, drag-to-select, Magic más inteligente

### Onboarding interactivo (Web)
- 6 pasos guiados desde el primer nodo hasta crear contenido con IA
- Detección automática de cada acción del usuario — no hay botones "siguiente"
- Al terminar: pantalla de bienvenida, cierre limpio y vuelta a raíz

### Paneles Magic y Buscar — mismo diseño (Web)
- Ambos paneles tienen el input al mismo nivel (32px del top, alineado con el primer nodo)
- Placeholder en cursiva: "¿Qué necesitas?" y "Buscar…"
- Clic en espacio vacío del panel → foco automático en el input
- Buscar: al cerrar o navegar, limpia el filtro automáticamente

### Drag-to-select en el outliner (Web)
- Arrastra el ratón sobre varios nodos para seleccionarlos (como Notion)
- Funciona desde cualquier punto: texto, margen, espacio en blanco
- Backspace / Delete borra los seleccionados · Escape anula · ⌘A selecciona todos

### Magic más inteligente (Web · Servidor)
- **Fecha correcta**: Magic ya conoce la fecha actual — "mañana" es realmente mañana
- **Destino inteligente**: un recordatorio genérico va al diario; si estás en una nota de proyecto y pides añadir algo, va a esa nota
- **navigate_to**: cuando pides "ver las tareas de mañana", Magic navega directamente — no responde con texto
- **Muévelo**: botón junto a Deshacer para mover un nodo creado a la nota actual o al diario con un clic

### Corrección de cursor (Web)
- Clic en cualquier nodo coloca el cursor exactamente donde se hizo clic, incluso la primera vez

---

## v9.3.17 · iOS 2.1 — Mayo 2026 · Undo/redo, slugs, YouTube IA, iOS paridad

### Undo/Redo corregido (Web · Mac)
- `Cmd+Z` restaura el estado correcto — bug crítico donde saltaba estados resuelto
- Escribir no crea un snapshot por letra: undo agrupa 1.5s de escritura en un paso
- Operaciones complejas (mover nodo, crear espejos) = un único paso de undo
- `Cmd+Y` / `Cmd+Shift+Z` para rehacer

### URLs cortas para nodos (Web · Mac)
- Menú contextual → "Establecer URL corta"
- Comparte `/node/mi-proyecto` en lugar de `/node/uuid`
- El slug se sincroniza con todos los dispositivos

### YouTube en la IA inline (Web · Mac · servidor)
- La IA ya puede analizar vídeos de YouTube en todos los usuarios
- Antes requería tier de pago de Gemini; ahora usa transcript scraping
- Funciona con vídeos en español e inglés

### Filtro persistente (Web · Mac)
- El filtro activo sobrevive la navegación entre nodos y recargas de página
- Se aplica tanto en la vista raíz como al entrar en un nodo concreto

### Magic — eventos y fechas (Web · Mac)
- Cuando dices una hora específica ("a las 12:00"), Magic crea un evento, no una tarea
- Las tareas/eventos creados con fecha futura se colocan directamente bajo ese día en el árbol
- Eliminados duplicados al mover nodos con fecha

### iOS 2.1 — Paridad completa con Web
- **Filtro lenguaje natural**: escribe "tareas pendientes de hoy" → filtro aplicado automáticamente
- **Magic → filtro**: "muéstrame mis eventos de esta semana" aplica el filtro directamente
- **Sistema de espejos**: mover un nodo a otro día crea el contexto completo en ambos sitios
- **Mirror display**: espejos muted con badge "→ lunes 1 jun" al final del texto
- **Planificador GCal**: arrastra eventos de Google Calendar a otra hora o día
- Resize de duración en eventos GCal

---

## v9.3.14 — Mayo 2026 · GCal drag/resize en el planificador

### Planificador — arrastrar y redimensionar eventos GCal
- Arrastra un evento de Google Calendar a otra hora o día directamente desde el planificador
- Redimensiona la duración de un evento GCal tirando del borde inferior
- Optimistic update: el evento se mueve visualmente al instante sin esperar al servidor
- Sync en background con Google Calendar; revert automático si la operación falla
- Enter en los inputs de hora y fecha del editor guarda el cambio sin necesidad de hacer clic

---

## v9.3.13 — Mayo 2026 · Sistema de espejos mejorado

### Mover un nodo a otro día
- Al mover un nodo a otro día: el nodo se traslada físicamente al destino
- Se crea un espejo del padre en el destino junto con espejos de todos los hermanos
- En el origen queda un espejo del nodo movido con referencia al día destino
- Los espejos muestran el mismo icono que el original (checkbox, evento…) con opacidad reducida en lugar del icono genérico ⬡
- El badge "→ destino" aparece después del texto del nodo, no antes

---

## v9.3.12 — Mayo 2026 · Tecla P para el planificador

### Atajo de teclado
- `P` (sin ningún input activo) abre y cierra el planificador lateral al instante
- El atajo aparece en **Ajustes → Atajos** como configurable

---

## v9.3.10 — Mayo 2026 · Magic Chat — navegación directa

### Navegación sin pasar por IA
- Frases como "ir al diario", "nota de hoy", "abre hoy"... navegan al nodo del día sin invocar al modelo de IA
- La respuesta es instantánea: cero latencia, sin tokens consumidos

---

## v9.3.7 — Mayo 2026 · Filtro IA en lenguaje natural

### Filtro con lenguaje natural (⌘F)
- La caja de filtro ahora acepta lenguaje natural: "tareas de hoy y pasadas", "recursos sin fecha", "todo lo de esta semana"…
- From traduce la consulta a la query técnica equivalente usando Haiku (gratuito, sin coste para el usuario)
- Nuevos operadores disponibles: `pasado`, `futuro`, `mes`, `sin-fecha`, `favorito`, `diario`, `recurso`
- Soporte para `y` (AND) y `o` (OR) combinando condiciones
- Magic Chat detecta cuando quieres filtrar y aplica el filtro directamente sin abrir el campo manualmente
- El placeholder de la caja de búsqueda ahora dice "¿Qué quieres ver? (⌘F)" para invitar al lenguaje natural

---

## v9.1.2 — Mayo 2026 · Propiedades de agentes + IA gratuita

### Propiedades de agentes
- Selector de programación en cada nodo agente: Sin programar · Diario · Semanal
- El horario elegido se guarda en el nodo y se mostrará en la barra de controles
- La ejecución automática según horario se implementará en próxima iteración

### IA gratuita para micro-operaciones
- Todos los usuarios (gratis y Pro) tienen acceso a Haiku para micro-ops
- Auto-renombrado de conversaciones de Magic Chat: ya no consume tokens del usuario
- Presupuesto de sistema separado: 50 llamadas/hora, 200 tokens máx por llamada
- Sin coste adicional para el usuario, sin afectar al plan contratado

### iOS v2.0
- Subido a App Store Connect (Delivery UUID: bf0f72a0-968f-4c6c-b5b3-28209a9bf687)
- Pendiente revisión de Apple (normalmente 24-48h)

---

## v9.1.1 — Mayo 2026 · Fixes atajos y nodos especiales

### Fixes
- Paneles: al hacer clic ahora aplican correctamente el filtro al árbol (race condition resuelto)
- Nodos especiales simplificados: solo Agente individual, Atajo, Contexto y Papelera tienen controles especiales
- Los nodos raíz de Agentes y Plantillas se gestionan como nodos normales (Enter para crear nuevo)
- Atajo de filtro navega a raíz antes de disparar el filtro para evitar conflictos de montado

---

## v9.1 — Mayo 2026 · Magic, nodos especiales y árbol completo

### Magic Chat — asistente de voz integrado
- **Mantén R** desde cualquier lugar → abre Magic Chat y graba al instante
- **Espacio** → abre Magic Chat para escribir
- Waveform animado durante la grabación
- La conversación crea un nodo `✦ Título` en el diario de hoy, con transcripción colapsada
- Los nodos creados por Magic van bajo ese nodo (jerarquía limpia)
- Reanudar conversación añade al mismo nodo sin perder historial

### Sistema de aprendizaje — Enseñar a Magic
- **Botón derecho → Enseñar a Magic** en cualquier nodo
- Corrige interpretaciones: "esto no es una tarea", "este contexto no es correcto"…
- Magic aprende y aplica las correcciones en todas las conversaciones siguientes
- **Ajustes → Magic** muestra todo lo aprendido cronológicamente (editar, borrar)

### Grabadora de audio larga
- Graba reuniones, clases, notas largas desde el sidebar
- Al parar: Magic analiza y crea nodos en el diario (resumen + transcripción + tareas)
- Permisos de micrófono correctamente declarados en Mac

### Nodos especiales con controles integrados
- Al abrir un nodo especial, aparece barra de controles entre el título y los hijos
- **🤖 Agentes** → toggle activo/pausado, botón Ejecutar, última ejecución
- **📌 Atajos** → contador de atajos
- **📋 Plantillas** → + Nueva plantilla
- **🧠 Contexto** → estado del perfil IA
- **🗑 Papelera** → contador + Vaciar papelera

### Árbol completo — todos los nodos visibles
- 🤖 Agentes ahora visible en el árbol (antes era vista separada)
- 📊 Paneles visible en el árbol
- Los 11 agentes predefinidos están como nodos editables
- Crear nuevos agentes directamente en el árbol

### 🗑 Papelera como nodo del árbol
- Eliminar un nodo lo mueve a 🗑 Papelera (no elimina permanentemente)
- **Jerarquía preservada**: si borras A y luego B (padre de A), Papelera muestra B→A
- Botón derecho → Restaurar / Eliminar permanentemente
- Vaciar papelera elimina todo de forma permanente

### Google Calendar como nodos normales
- Los eventos GCal aparecen como nodos hijos en la nota diaria
- Orden cronológico, borde izquierdo con el color del calendario
- Al mover un evento a otra nota diaria → se actualiza la fecha en Google Calendar
- Sincronización bidireccional automática

### Perfil de IA — siempre en nodos
- El Perfil de IA vive en 🧠 Contexto como nodos editables normales
- Eliminado el editor de body redundante en Ajustes
- Magic lee tanto el perfil como todos sus nodos hijos

### Limpieza de vistas obsoletas
- Eliminadas: AgentsView, ChatView, KanbanView (global), TasksView (global), InboxView, TagView, FilesView, TrashView
- SearchView se mantiene (necesaria para filtros y atajos)
- Las rutas obsoletas redirigen a inicio

### Fixes
- Traffic bar Mac (semáforos) tiene su propia fila — no interfiere con la cabecera
- Footer reorganizado: Conectado · Último backup · Nodos · Sync — versión
- Drag-to-select mejorado: funciona entre niveles anidados, global y consistente
- Todo el contenido IA se crea como nodos (nunca como editor de body)
- Web ahora se despliega correctamente con cada cambio

---

## v9.0 — Mayo 2026 · Nueva arquitectura

Esta versión es una reescritura completa del producto. Nuevo modelo de datos, nueva interfaz, nueva experiencia.

### Outliner WF
- Árbol de nodos colapsable con drag & drop y selección multinodo
- Slash menu `/` — tarea, evento, espejo, mover, fecha, contexto
- ⌘F — filtro inline integrado en barra superior
- Tab/Shift+Tab para indentar, ⌘↑↓ para mover

### Sistema de contextos @
- @ en cualquier nodo abre picker de contextos
- Chips morados en nodos con contexto asignado
- Filtrar por @contexto muestra todos los nodos relacionados
- Contextos definidos en nodo raíz 🧠 Contexto

### Nodos raíz del sistema
- 📅 Agenda — jerarquía Año → Mes → Día. Diario integrado
- 🧠 Contexto — define y gestiona tus contextos de trabajo
- 📋 Plantillas — reutilizables con /plantilla
- 📊 Paneles — vistas dinámicas sincronizadas entre dispositivos
- ⚙️ Ajustes — cuenta, IA, predicciones

### Filtros inteligentes
- hoy, mañana, semana, pendiente, hecho, vencido, evento
- @contexto, #tag, [[wikilink]], node:id
- Vistas: lista · tabla · kanban · calendario

### Mirrors ⬡
- /espejo crea referencia sincronizada a otro nodo
- Mover tarea a otro día genera espejo automático en origen

### Predicciones ghost text
- Detecta verbos → sugiere tarea
- Detecta fechas naturales en español → sugiere vencimiento
- Palabras personalizadas en ⚙️ Ajustes

### IA integrada
- Chat IA con acceso a tus notas, tareas y perfil
- IA Inline: espacio + ✨ en cualquier nodo
- Agentes autónomos para tareas recurrentes

### Mac v9.0 — Tauri v2
- App nueva: 3.9 MB, arranque instantáneo
- Login Apple, Google y email/contraseña
- DMG notarizado, sin advertencias Gatekeeper
- Auto-updater integrado

### Backup y privacidad
- Backup local automático cada 2 horas
- Exportación JSON y Markdown
- Tus datos nunca dependen solo de la nube

---

## Versiones anteriores (v1–v8)

Archivadas. Arquitectura diferente, no compatible con v9.0.
Soporte: [getfrom.app/support](https://getfrom.app/support)

### set_filter — Magic filtra el árbol sin texto (Web · Servidor)
- Magic reconoce peticiones de filtrado: "tareas de hoy", "archivos", "pendientes"...
- Aplica el filtro visual en el árbol en lugar de responder con texto
- Navega a raíz automáticamente para que el resultado sea visible
- Queries: tarea/nota/evento/archivo/enlace + pendiente/hecho + hoy/semana/mes/pasado/futuro

