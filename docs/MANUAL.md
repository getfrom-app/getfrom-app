# From — Manual de usuario

> Versión 3.12 / Web 1.2 · macOS 14+ · iOS 17+ · getfrom.app/app

---

## Novedades en Web 1.2 (21 mayo 2026)

La versión 1.2 de From Web es una actualización masiva de paridad con la app Mac. Aquí los cambios más importantes:

**Nuevas vistas**
- **Chat** (⌘⇧C desde sidebar) — Chat IA global con historial de conversación y sugerencias
- **Bandeja de entrada** — Notas sin procesar de los últimos 30 días con acciones rápidas
- **Papelera** — Recupera notas eliminadas o vacía la papelera
- **Vista por tag** — Haz clic en cualquier tag del sidebar para ver todos los nodos de ese tag

**Editor mejorado**
- **IA Inline fase 2** — Tab acepta la sugerencia, Esc la descarta
- **Zoom en nodo** — Botón ⟶ en hover para entrar en un nodo como si fuera la raíz
- **⌘/** — Cicla H1 → H2 → H3 → texto desde cualquier bullet
- **Multi-selección** — Shift+Click para seleccionar varios bullets y aplicar acciones en masa
- **Color e icono por nodo** — Asigna un emoji y un color a cada nota desde el panel de propiedades
- **Wiki-links `[[nombre]]`** — Haz clic en `[[nombre]]` para navegar directamente a esa nota

**Nota individual mejorada**
- **Chat por nota (⌘J)** — Chat IA con el contexto específico de la nota abierta
- **Pomodoro** — Temporizador de 25 minutos con notificación
- **Exportar / Importar markdown** — Descarga la nota como .md o importa markdown al body
- **Imprimir** — Vista de impresión limpia sin sidebar ni toolbar
- **Bloquear nota** — Evita ediciones accidentales con un toggle en propiedades

**Diario**
- **Estadísticas** — Panel con gráfico semanal, grid de hábito (28 días) y top tags
- **Navegación por fecha** — Selector de fecha y botones de ±7 días
- **Quick capture con flags** — `-t` para tarea, `-e` para evento, `@hoy`, `@mañana`
- **Milestone** — Badge especial cuando escribes ≥10 bullets en un día

**Búsqueda**
- **DSL potente** — `fecha:esta-semana`, `area:trabajo`, `tiene:cuerpo`, `tipo:diario`...
- **Ayuda DSL** — Pulsa `?` en la búsqueda para ver toda la sintaxis
- **Ordenación** — Por relevancia, fecha de modificación, vencimiento o prioridad

**Otros**
- Captura rápida flotante con **⌘Q** — Guarda con ⌘Enter, abre la nota con ⌘⇧Enter
- Notificaciones toast — Feedback inmediato en acciones (crear, mover, eliminar...)
- StatusBar — Palabras y tiempo de lectura en notas, estadísticas de tareas en /tasks

---

## Novedades en 3.12 / Web 1.0 (20 mayo 2026)

**Mac 3.12**
- Inicio de sesión con email/contraseña — ya no hace falta Apple ID o Google para entrar
- Login con Google (Google Sign-In) — opción adicional junto a Apple ID
- Precios actualizados: Free, Pro Mensual (€7/mes), Pro Anual (€49/año), Lifetime (€149 + 3M tokens IA)
- Botón "Crear cuenta gratis" en Mac → registra directamente desde la app

**iOS 1.2**
- Tab **Tareas** — vista dedicada de tareas agrupadas por: Vencidas, Hoy, Esta semana, Más tarde, Sin fecha
- Botón **✨ IA** en el editor de notas — genera o continúa el texto con streaming
- Login con Google — nueva opción de autenticación
- Indicador de plan: Free / Pro / Lifetime en Ajustes

**From Web 1.0** (getfrom.app/app)
- Editor completo con outliner, markdown, slash menu, ⌘K, drag & drop
- Vista calendario semana · Vista kanban por estado
- Exportar datos (JSON/Markdown) · Compartir enlace de nota
- Modo claro/oscuro · Checkout directo sin cuenta
- AI inline (Cmd+Space) · Grabación de voz (Chrome/Edge)
- Publicar nota con URL pública real (getfrom.app/p/SLUG)

---

## 1. ¿Qué es From?

From es una app nativa para Mac e iPhone que actúa como tu segundo cerebro. Toda tu información —notas, tareas, proyectos, diario, archivos— vive en un árbol de bullets sincronizado en tiempo real entre dispositivos. No hay carpetas que ordenar ni archivos .md que gestionar: todo está en un único sistema, siempre accesible y con IA integrada.

---

## 2. El diario de hoy

Al abrir From por primera vez, aterrizas en el **diario del día actual**. Es tu punto de partida diario.

**Las tres secciones del día:**

| Sección | Qué contiene |
|---|---|
| Tareas | Tareas vencidas, que vencen hoy y próximas |
| Eventos | Eventos del día sincronizados con Apple Calendar |
| Timeline 24h | Vista visual hora por hora de eventos y bloques del día |

**Cómo usarlo:**
- Escribe directamente en el diario: cualquier línea se convierte en un bullet.
- Usa `-t` al final de una línea para marcarla como tarea, o pulsa ⌘T desde cualquier bullet.
- El diario de hoy siempre está accesible desde la barra lateral izquierda.
- Cada día crea su propia entrada. Puedes navegar a días anteriores desde el árbol temporal (Año → Mes → Semana → Día).

---

## 3. El editor de bloques

En From, cada nota se compone de **bloques**. Cada bloque es un nodo independiente con su propio tipo (párrafo, heading, tarea, página hija, divisor, cita, código…). El editor funciona como Notion: escribes y los bloques se crean sobre la marcha.

**Crear bloques:**
- `Enter` al final de un bloque → nuevo bloque debajo del mismo tipo (excepto headings, que pasan a texto normal)
- `/` abre el menú de comandos para insertar cualquier tipo de bloque
- Clic en cualquier zona vacía debajo del contenido → cursor en un nuevo bloque

**Indentación:**
- `Tab` → indenta el bloque (hasta 6 niveles)
- `Shift+Tab` → desindenta
- `Backspace` al inicio de bloque indentado → primero desindenta, luego fusiona con el anterior

**Atajos markdown (al inicio del bloque):**
| Escribes | Se convierte en |
|---|---|
| `# ` | Título 1 |
| `## ` | Título 2 |
| `### ` | Título 3 |
| `> ` | Cita |
| `[] ` | Tarea |
| `---` | Divisor |

**Atajos de tipos sistema (al inicio del bloque):**
| Escribes | Se convierte en |
|---|---|
| `-t ` | Tarea |
| `-e ` | Evento |
| `-b ` | Bucle (open loop) |
| `-a ` | Agente IA |
| `-p ` | Prompt |

**Mover y duplicar bloques:**
- `Cmd+D` → duplicar el bloque actual
- `Cmd+Shift+↑/↓` → mover bloque arriba/abajo
- Arrastrar el handle `···` (visible al pasar el ratón) para reordenar

**Páginas hijas (notas anidadas):**
- `/Nueva página` crea una nota hija dentro del bloque
- Aparece con un punto azul (●) → marca de identidad de From
- Clic en el punto navega a esa nota hija
- Las páginas pueden anidarse sin límite

**Formato inline:**
- `Cmd+B` → **negrita**, `Cmd+I` → _cursiva_, `Cmd+E` → `código`
- También puedes escribir `**bold**`, `*italic*`, `` `code` `` directamente

**Tipos de bloque disponibles (vía `/`):**

| Grupo | Bloques |
|---|---|
| **Texto** | Texto, Título 1/2/3, Lista numerada, Cita, Destacado (emoji editable), Código, Divisor, Desplegable, Imagen, Tabla de contenidos |
| **Página** | Nueva página, Enlace, Archivo, Mover a… |
| **Base de datos** | Lista, Tabla, Kanban, Calendario |
| **Objetos** | Tarea, Evento, Bucle, Agente, Prompt |

**Bloques especiales:**
- **Desplegable (Toggle):** clic en la flecha para plegar/desplegar bloques hijos (los que estén indentados debajo)
- **Destacado (Callout):** clic en el emoji para cambiarlo (16 emojis comunes + acceso al selector completo del sistema)
- **Imagen:** clic para elegir archivo o arrastra una imagen sobre el bloque vacío
- **Divisor:** línea horizontal limpia, escríbelo con `---`

**Decoraciones del editor:**
- Los checkboxes de tarea tienen estilo cuadrado (Notion-style) y están centrados verticalmente con el texto en cualquier nivel de indentación.

---

## 4. Selección y eliminación

**Selección múltiple con arrastre (rubber-band):**
- Arrastra el ratón desde cualquier zona vacía sobre los bloques
- Aparece un rectángulo azul translúcido
- Los bloques que intersectan se marcan en azul
- `Backspace` los elimina todos de golpe
- `Escape` o clic en cualquier sitio limpia la selección

**Cmd+A (estilo Notion):**
- Primer Cmd+A → selecciona todo el texto del bloque actual
- Segundo Cmd+A → selecciona todos los bloques del documento

---

## 5. Atajos de teclado esenciales

| Atajo | Acción |
|---|---|
| `⌘N` | Nueva nota en el diario de hoy |
| `⌘K` | Búsqueda rápida global |
| `⌘F` | Filtro global por tags/áreas |
| `⌘T` | Marcar/desmarcar tarea |
| `⌘E` | Panel derecho IA |
| `/` | Menú de comandos slash |
| `@` | Mención a otra nota |
| `#` | Tag (autocompleta tags existentes) |
| Espacio en bloque vacío | Abre chat IA en columna derecha |
| `Tab` / `Shift+Tab` | Indentar / desindentar bloque |
| `Cmd+D` | Duplicar bloque |
| `Cmd+Shift+↑/↓` | Mover bloque arriba/abajo |
| `Cmd+B / I / E` | Negrita / cursiva / código inline |
| `Cmd+K` (con selección) | Convertir selección en enlace |
| `Cmd+Z / Cmd+Shift+Z` | Deshacer / rehacer cambios estructurales del documento |
| `Cmd+F` | Filtro global — resalta coincidencias en amarillo en la nota actual |

---

## 6. Tags (`#`)

Los tags en From son **100% libres**. No hay tags predefinidos del sistema — el usuario crea los suyos vía `#` desde cualquier bloque.

**Crear y usar tags:**
- Escribe `#` y empieza a teclear → autocomplete con tags existentes
- Si el tag no existe, aparece "+ Crear «nombre»" para crearlo al instante
- Cada tag recibe un color automático (cambiable haciendo clic derecho en el sidebar)
- El tag aparece como pill colorido en el texto y como entrada en el sidebar izquierdo

**Tags jerárquicos:**
- Escribe `#personal/amigos` → crea `amigos` como hijo de `personal`
- Buscar por `#personal` incluye todas las notas con cualquier hijo (`#personal/amigos`, `#personal/familia`, etc.)
- Buscar por `#personal/amigos` filtra solo ese hijo específico

**Eliminar un tag:**
- Clic derecho en el tag del sidebar → "Eliminar tag"
- Se elimina de `node.types`, del texto inline (`#tagname`) y del nodo de definición
- Todas las notas que lo contenían se actualizan automáticamente

**Columna izquierda — navegación:**
La columna izquierda tiene 4 pestañas de icono:
- `tag.fill` **Tags** — árbol de todos tus tags. Clic derecho en cualquier tag para Renombrar, Cambiar color o Eliminar.
- `pin.fill` **Fijados** — notas que hayas fijado (pin). Título completo, sin límite. Para fijar cualquier nota: clic derecho en el nodo → "Fijar", o desde la barra de acciones del título.
- `square.grid.2x2.fill` **Paneles** — búsquedas guardadas como vistas.
- `gearshape.fill` **Ajustes** — configuración de la app.

**Tipos sistema vs tags:**
Las tareas, eventos, agentes, prompts y bucles **no son tags**. Son tipos sistema detectados por `node.status` y `extraData["elementMode"]`. Por eso conviertes un bloque a tarea con `/Tarea` o `-t `, no con `#tarea`. Los tags quedan exclusivamente para tu organización conceptual.

---

## 7. @Menciones inline

Escribe `@` en cualquier bloque para abrir el picker de notas. Busca por título y selecciona la nota a enlazar.

**Cómo se ven:**
- En el texto: el título de la nota con un subrayado fino gris (estilo Notion)
- Mismo tamaño y tipo de letra que el texto normal
- Al pasar el ratón aparece el cursor de "mano"
- Clic → navega a esa nota

**Bidireccionalidad:**
- El nodo destino sabe qué bloques lo mencionan (panel derecho del nodo destino)
- Útil para crear un grafo de conocimiento dentro de From

---

## 7. Tareas

**Crear una tarea:**
- Escribe el texto del bullet y pulsa `⌘T`, o usa el atajo inline `-t` al final de la línea.
- También puedes escribir `#tarea` para convertir cualquier nodo en tarea.

**Marcar como hecha:**
- Haz clic en el checkbox del bullet, o pulsa `⌘T` de nuevo.
- En iOS: desliza el bullet hacia la derecha.

**Asignar fecha con lenguaje natural:**
- En el panel de propiedades, escribe en el campo de fecha: `hoy`, `mañana`, `lunes`, `15 mayo`.
- O usa el atajo inline: escribe `-d:hoy` o `-d:2026-05-20` directamente en el bullet.

**Prioridad:**
- Tres niveles: alta, media, baja. Se asigna desde el panel de propiedades o con `-p:alta`.

**Convertir en bucle:**
- Clic derecho en cualquier tarea → "Convertir en bucle". Los bucles son open loops siempre visibles en el panel del día hasta que se resuelven.

**Bucles abiertos:**
- En el dashboard global (icono de cuadrícula), la pestaña **Tareas** muestra todas las tareas vencidas y sin resolver, agrupadas por estado.
- Usa `estado:pendiente` en la barra de búsqueda inline para filtrar solo lo que está abierto.

---

## 8. Eventos y calendario

**Crear un evento:**
- En cualquier bloque, escribe `-e ` o usa el slash `/evento`
- Se abre el modal de nuevo evento con el título del bloque pre-relleno
- Selecciona fecha, hora de inicio y fin → el evento se crea en Apple Calendar y el nodo muestra icono 📅 + badge de fecha/hora a la derecha del texto
- Atajo global: `⌘E` abre el modal de nuevo evento desde cualquier parte

**Badge de fecha en el editor:**
- Los nodos tarea y evento muestran su fecha/hora como badge a la derecha del texto (y del título si el nodo está abierto)
- El badge se vuelve naranja si la fecha está vencida

**Sincronización con Apple Calendar:**
- From importa automáticamente los eventos de tus calendarios de Apple.
- La sincronización es bidireccional: los eventos aparecen en el timeline del día y en la vista de calendario.
- Actívala en **Ajustes → Calendario** y selecciona qué calendarios incluir.

**Timeline 24h:**
- Visible en la columna derecha al abrir un nodo diario.
- Muestra bloques hora a hora con los eventos del día.
- Eventos solapados se reparten el ancho (igual que Apple Calendar).
- La altura se ajusta automáticamente para llenar el panel.

**Eventos en el panel del día:**
- Los eventos del calendario aparecen en la lista de tareas de la columna derecha con icono de calendario, junto a las tareas del día.

**Organizar el día con drag & drop:**
- En la columna derecha de una nota diaria hay un control de 3 vistas:
  - `checklist` — lista de tareas, bucles y vencidas del día
  - `rectangle.split.2x1` — vista dividida: tareas a la izquierda + timeline a la derecha simultáneos (ideal para planificar arrastrando tareas al timeline)
  - `clock` — timeline completo 24h
- Activa la vista dividida (`rectangle.split.2x1`) y arrastra cualquier tarea al slot horario deseado
- El timeline muestra slots de **15 minutos** — cada uno se resalta al pasar por encima con el label `HH:MM` exacto
- El `due` de la tarea se actualiza con esa hora al soltar
- Las tareas ya colocadas en el timeline se mueven con snap visual a 15 min: el bloque muestra su posición final antes de soltar

---

## 9. Bases de datos (vistas inline)

Cualquier bloque puede convertirse en una **base de datos inline** que muestra sus nodos hijos en cuatro modos de visualización:

| Vista | Cuándo usarla |
|---|---|
| **Lista** | Vista de árbol con hijos editables inline |
| **Tabla** | Filas con columnas tipadas (date, select, number, boolean, url, etc.) |
| **Kanban** | Tablero por estado, prioridad o propiedad select del esquema |
| **Calendario** | Distribución temporal por fecha (`due` o propiedad date custom) |

**Crear una base de datos:**
1. En cualquier bloque, abre el slash y elige **Lista**, **Tabla**, **Kanban** o **Calendario**
2. El bloque se convierte en contenedor; los hijos son las "filas"
3. Cambia entre vistas con el selector del header (arriba a la derecha)

**Propiedades tipadas en tabla:**
- Botón `+` en el header de la tabla → nuevo campo con tipo (texto, número, fecha, select, boolean, URL, email, teléfono)
- Cada celda renderiza el editor correspondiente (date picker, select dropdown, checkbox, etc.)
- Las propiedades quedan disponibles para cualquier nodo hijo

**Vistas guardadas (tabs):**
- Botón `🔖` en el header → guarda la vista actual con nombre
- Cada vista guardada aparece como tab debajo del header
- Pueden coexistir varias vistas del mismo nodo (tabla, kanban por prioridad, calendario, etc.)
- Renombrar/eliminar desde el menú contextual del tab

**Kanban por propiedad:**
- El menú "Agrupar por" del kanban incluye las propiedades de tipo select del esquema
- Cada valor único de la propiedad se convierte en una columna del tablero
- Arrastrar tarjetas entre columnas actualiza el valor de la propiedad

**Filtros y orden (ViewConfig):**
- Botón `⚙` → filtros por estado, prioridad, área, tipo o texto
- Ordenar por: manual, fecha vencimiento, prioridad, alfabético, fecha creación/modificación
- Agrupar por estado, prioridad o fecha

**Navegación a la fila:**
- Hover en una fila → aparece el `●` (dot de From) a la izquierda
- Clic en el dot → zoom dentro de la fila (la fila pasa a ser página completa con sus propios bloques)
- La fila puede tener su propio editor de bloques (cada fila ES una página)

---

## 9.1 Tabla de contenidos (TOC)

`/Tabla de contenidos` inserta un bloque que genera automáticamente el índice de headings H1/H2/H3 del documento. Útil para notas largas. Clic en cada entrada navega/focaliza ese heading.

---

## 10. Búsqueda

**Búsqueda inline (`⌘F`):**
Filtra el árbol que estás viendo sin salir de él. Admite comandos:

| Comando | Ejemplo | Resultado |
|---|---|---|
| `estado:` | `estado:pendiente` | Solo tareas pendientes |
| `fecha:` | `fecha:hoy` | Nodos con vencimiento hoy |
| `tipo:` | `tipo:proyecto` | Solo nodos tipo proyecto |
| `prioridad:` | `prioridad:alta` | Solo nodos de prioridad alta |
| Texto libre | `reunión cliente` | Búsqueda por título y body |

**Búsqueda global (`⌘K`):**
- Busca en todos los nodos, archivos y agentes a la vez.
- Instantánea, sin servidor. Resultados en tiempo real mientras escribes.

**Búsqueda semántica (IA):**
- Además de la búsqueda por texto exacto, From incluye un modo de **búsqueda mágica** que responde preguntas sobre el contenido de tu vault.
- Actívala escribiendo una pregunta en lenguaje natural en la barra de búsqueda global: "¿qué tareas tengo pendientes sobre el cliente X?" o "¿qué decidimos en la reunión del martes?"
- La IA analiza el contenido de tus notas y devuelve una respuesta con referencias a los nodos relevantes.

**Spotlight:**
- From indexa tu contenido en la búsqueda de macOS para que puedas encontrar notas desde Spotlight sin abrir la app.
- La integración se activa automáticamente al instalar From. Puedes desactivarla en **Ajustes → Búsqueda**.

**Paneles de búsqueda guardada:**
- Puedes anclar búsquedas frecuentes como paneles en la barra lateral.
- Útil para "mis tareas de hoy", "proyectos activos", "notas con #cliente".

---

## 11. Captura rápida

From ofrece varias formas de capturar información sin interrumpir el flujo de trabajo.

| Atajo | Qué hace |
|---|---|
| `⌘K` | Búsqueda y captura global (nodos, archivos, agentes) |
| `⌘T` | Crear tarea rápida en el nodo actual |
| `⌘E` | Abrir panel de propiedades para capturar metadatos |
| `⌘N` | Nuevo nodo en el nivel actual |

**Captura desde cualquier app (macOS):**
- Desde la barra de menú de macOS puedes abrir una ventana flotante de captura rápida sin cambiar de app.
- El bullet se añade al nodo que tengas seleccionado o al diario del día si no hay selección.

**Captura de archivos:**
- Arrastra cualquier archivo desde el Finder al árbol de bullets para adjuntarlo a un nodo.
- También puedes pegar imágenes directamente desde el portapapeles.

**Nota enlazada:**
- Desde el menú `···` de cualquier nodo puedes crear una nueva nota hija enlazada con un clic, sin perder el contexto del nodo padre.

---

## 12. Grabación de voz

From incluye una **barra de grabación persistente** en la parte inferior de la columna izquierda. Permite capturar audio y convertirlo en bullets estructurados mediante IA.

**Cómo grabar:**
1. Selecciona la fuente: **Micrófono**, **Sistema** o **Mixto** en la barra inferior.
2. Pulsa **Grabar**. La columna izquierda se transforma en el panel de grabación (se eleva desde abajo con animación).
3. La mitad superior muestra la transcripción en tiempo real; la mitad inferior tiene un campo de apuntes manuales.
4. Pulsa **Guardar** (detiene y procesa con IA) o el chevron `⌄` para minimizar sin parar la grabación.

**Panel minimizado:**
- Mientras está minimizado, la grabación y la transcripción continúan en segundo plano.
- El árbol de navegación vuelve a aparecer con un indicador de onda y tiempo activo.
- Pulsa `⌃` para re-expandir el panel completo en cualquier momento.

**Transcripción y estructuración:**
- La IA transcribe el audio y lo estructura automáticamente en bullets.
- Los apuntes manuales se combinan con la transcripción al guardar.
- Los bullets se insertan en el diario del día.

**Casos de uso típicos:**
- Capturar ideas mientras caminas o conduces.
- Transcribir reuniones o llamadas (fuente: Sistema o Mixto).
- Dictar el borrador de una nota larga sin tocar el teclado.

---

## 13. IA integrada

**Cómo abrir el chat (3 formas):**
1. **Espacio al inicio de un bloque vacío** → abre el chat en la columna derecha y traslada el foco a la caja del chat (atajo Notion-style)
2. **`⌘E`** → abre/cierra el panel derecho con el chat
3. **Pestaña Chat** en la columna derecha cuando está visible

**Cuándo aparece la columna derecha:**
- Siempre en notas temporales (día, semana, mes, año) — muestra el panel de referencia del día
- En notas con tipo sistema: tarea, evento, bucle, agente, prompt
- En nodos zoomeados o configuración (settings)
- En notas regulares: oculta por defecto. Aparece al pulsar `⌘E` o teclear espacio al inicio de un bloque

**Columna derecha — nota diaria:**
Control de 3 vistas con iconos en la parte superior:
- `checklist` **Tareas del día** — bucles abiertos (con sus tareas hijas anidadas), tareas vencidas, tareas de hoy, completadas y eventos del calendario
- `rectangle.split.2x1` **Vista dividida** — tareas a la izquierda, timeline a la derecha simultáneos; ideal para planificar el día arrastrando tareas a slots horarios
- `clock` **Timeline** — calendario 24h completo con eventos de Apple Calendar

**Notas diarias pasadas/futuras:**
- Muestran las tareas y eventos de ese día concreto (no del día actual)
- Los bucles solo aparecen en el día actual; en otros días sus tareas salen sueltas

**Cómo usar el chat:**
- Pregunta o da instrucciones en lenguaje natural. Ejemplos:
  - "Resume los puntos pendientes de este proyecto."
  - "Crea 5 subtareas para esta fase."
  - "Redacta un email con el contenido de esta nota."
- El asistente tiene contexto completo del nodo: título, body, hijos y propiedades
- Puede leer y escribir en el nodo directamente

**Añadir resultados a la nota:**
- Las respuestas del chat incluyen botones de acción para insertar el contenido generado como bloques nuevos con un clic.

**Historial:**
- El historial del chat es específico por nota. Al cambiar de nodo, el chat se reinicia.

---

## 14. Agentes

Los **agentes** son automatizaciones de IA que se ejecutan con o sin intervención manual. Se crean como nodos normales dentro de la carpeta **Agentes/** del árbol.

**Crear un agente:**
1. Crea un nodo dentro de `Agentes/` o etiqueta cualquier nodo con `#agente`.
2. Escribe la instrucción en el body: qué debe hacer el agente, qué notas debe leer, qué debe generar.
3. En el panel de propiedades, configura el **schedule**: al abrir la app, diario, semanal o en una hora concreta.
4. Opcionalmente, añade **nodos de contexto**: arrastra otras notas al campo de contexto del agente para que las lea antes de ejecutarse.

**Qué puede hacer un agente:**
- Leer y resumir nodos del vault.
- Crear o actualizar notas con contenido generado.
- Hacer búsquedas en internet y traer resultados al árbol.
- Enviar notificaciones o generar informes periódicos.

**Ejecución manual:**
- Pulsa el botón **Ejecutar** en el panel del agente para lanzarlo en cualquier momento, independientemente del schedule.

**Historial de ejecuciones:**
- Cada ejecución queda registrada en el nodo del agente con la fecha, el resultado y cualquier error producido.

---

## 15. Áreas

Un **área** es una etiqueta que agrupa nodos relacionados bajo un mismo contexto: trabajo, personal, salud, un cliente concreto.

**Crear un área:**
- En el panel de propiedades de cualquier nodo, busca el campo **Área** y escribe el nombre.
- From crea el área al instante si no existe.

**Contexto IA de área:**
- Cada área puede tener un nodo especial de contexto (`_areaCtx`).
- El body de ese nodo se incluye automáticamente en el system prompt del chat cuando trabajas en nodos de esa área.
- Para editarlo: abre el chat en cualquier nodo del área y usa el botón de etiqueta de área.
- Ejemplo: en el área "Clientes", escribe el contexto "Trabajamos con empresas B2B del sector salud, tono formal."

---

## 16. Compartir notas

**Publicar una nota:**
- Abre el menú `···` de cualquier nodo y selecciona **Publicar**.
- From genera una URL pública del tipo `getfrom.app/p/...` con el contenido de la nota renderizado en markdown.
- La URL queda guardada en el panel de propiedades del nodo.

**Actualizar una nota publicada:**
- Edita el nodo normalmente y vuelve a seleccionar **Publicar** en el menú `···`. El contenido de la URL se actualiza al instante.

**Despublicar:**
- Selecciona **Despublicar** en el menú `···`. La URL deja de ser accesible inmediatamente.

**Usos típicos:** compartir un informe con alguien que no tiene From, publicar documentación de un proyecto, enviar un brief a un cliente.

---

## 17. Google Docs

From puede sincronizar el contenido de cualquier nota con un documento de Google Docs.

**Configuración inicial:**
1. Ve a **Ajustes → Integraciones** y conecta tu cuenta de Google.
2. Autoriza el acceso a Google Drive cuando se te solicite.

**Sincronizar una nota:**
- Abre el nodo que quieras sincronizar.
- En la barra de acciones de la nota (barra superior del panel derecho), pulsa el botón de **Google Docs**.
- Elige si vincular a un documento existente o crear uno nuevo.
- From mantiene el contenido sincronizado: los cambios en From se reflejan en el documento y viceversa.

**Notas:**
- La sincronización es por nodo, no por vault completo.
- El formato markdown se convierte automáticamente al formato de Google Docs en la exportación.

---

## 18. Sync y cuenta

**Sin cuenta (modo gratuito):**
- Hasta 1.000 nodos sincronizados entre dispositivos.
- Sin funcionalidades de IA ni archivos adjuntos.

**Con cuenta:**
- Los cambios se sincronizan automáticamente entre Mac e iPhone cada pocos minutos.
- El sync es delta: solo viajan los cambios, no toda la base de datos.

---

## Planes y precios

From está disponible en cuatro planes:

### Gratis
- Sync de hasta 1.000 nodos entre dispositivos
- App completa en Mac, iPhone y web
- Sin funcionalidades de IA
- Sin archivos adjuntos

### Pro — €7/mes o €49/año
- Nodos ilimitados
- IA completa (Claude + GPT) con tokens mensuales incluidos
- Archivos adjuntos
- Publicar notas con URL pública
- Soporte prioritario

### Lifetime — €149 pago único
- Todo lo de Pro para siempre
- 3.000.000 tokens IA incluidos (~2-3 años de uso normal)
- Cuando los tokens se agoten: compra recarga o conecta tu propia API key
- Actualizaciones incluidas

### Modo invitado (web)
Puedes usar From Web sin crear cuenta. Los datos se guardan en el navegador
pero se pierden al cerrar la pestaña. Crea una cuenta gratuita para guardar y sincronizar.

### Gestionar suscripción
Desde la app: **Ajustes → Cuenta → Suscripción**
Facturación: [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing)

---

**Tokens de IA (plan Pro y Lifetime):**
- El uso del chat consume tokens incluidos en el plan.
- Puedes comprar recargas adicionales o conectar tu propia API key desde **Ajustes → Cuenta**.

**Backup local:**
- From exporta todos tus nodos a Markdown automáticamente cada 2 horas en:
  `~/Library/Application Support/From/Backups/`

### Backup local automático

From guarda un snapshot completo de tus notas cada 2 horas en `~/Documents/From Backup/{Workspace}/`. Cada snapshot incluye:
- Todos tus nodos en Markdown estándar (compatible con Obsidian y cualquier editor)
- Una copia del archivo de base de datos para restauración instantánea

**Historial**: se conservan los últimos 6 snapshots por workspace (12 horas de historial).

**Restaurar**: Ajustes → Datos → Backup → elige el snapshot → pulsa "Restaurar". La app recarga automáticamente.

Tus notas no dependen de ningún servidor. Incluso sin conexión a internet, el backup sigue funcionando.

---

## 19. From Web — El editor en el navegador

From Web es la versión de From que funciona directamente en el navegador, sin necesidad de instalar nada. Está disponible en **[getfrom.app/app](https://getfrom.app/app)** y sincroniza en tiempo real con From para Mac y iPhone.

### Acceso y cuenta

- **Con cuenta**: inicia sesión con email/contraseña, Google o Apple ID. Tus notas se sincronizan automáticamente entre Mac, iPhone y web.
- **Sin cuenta (modo invitado)**: puedes usar From Web sin registrarte. Los datos se guardan en el navegador. Al crear una cuenta, los datos se conservan.

### Funcionalidades disponibles en la web

**Editor:**
- Outliner jerárquico con Tab/Shift+Tab para indentar
- Drag & drop para reordenar y reparentar nodos
- Tipos de bloque vía `/`: H1, H2, H3, cita, separador
- Markdown inline: **negrita**, *cursiva*, `código`, ~~tachado~~, [enlaces](url)
- Tags `#palabra` con colores automáticos
- @menciones para referenciar otras notas
- Undo/Redo con ⌘Z / ⌘⇧Z (historial de 50 estados)

**Vistas:**
- **Diario**: nota automática del día con panel derecho (Pendiente + Timeline)
- **Tareas**: secciones por fecha (Vencidas, Hoy, Semana, Más tarde, Sin fecha), filtros de prioridad y ordenación
- **Calendario**: vista semanal Mon-Sun con navegación Prev/Next
- **Kanban**: columnas Pendiente/Completado con drag & drop
- **Búsqueda**: texto libre + ✨ Búsqueda IA (síntesis de resultados con IA)
- **Agentes**: ejecutar agentes IA con historial de runs

**Organización:**
- Sidebar con 4 tabs: Tags, Fijados, Paneles, Ajustes
- Panel contextual en notas: subtareas, áreas relacionadas, backlinks
- Paneles guardados (filtros de búsqueda persistidos)
- Command palette ⌘K

**IA:**
- AI inline: ⌘Space en el body de una nota → Claude Haiku completa el texto
- Grabación de voz → nota (Chrome/Edge)
- ✨ Búsqueda IA: síntesis del vault sobre una query
- Agentes: ejecutar agentes con system prompt personalizado

**Atajos de teclado:**

| Atajo | Acción |
|---|---|
| `⌘N` | Nueva nota |
| `⌘K` | Command palette |
| `⌘T` | Nueva tarea (modal) |
| `⌘E` | Nuevo evento (modal) |
| `⌘R` | Grabar voz |
| `⌘Z` | Deshacer |
| `⌘⇧Z` | Rehacer |
| `⌘Space` | IA inline en el editor |
| `Escape` | Ir al diario de hoy |

**Datos:**
- Exportar en JSON o Markdown desde Ajustes
- Publicar nota con URL pública (`getfrom.app/p/SLUG`)
- Adjuntar archivos (subida a R2)
- Backup completo descargable

### Instalar como app (PWA)

From Web es instalable como app en el escritorio o en el móvil:
- **Chrome/Edge**: clic en el icono de instalación en la barra de dirección
- **Safari iOS**: compartir → "Añadir a pantalla de inicio"

Una vez instalada, funciona como una app nativa con su propio icono.

### Diferencias con Mac

| Feature | Mac | Web |
|---|---|---|
| Editor outliner completo | ✅ | ✅ |
| Sync en tiempo real | ✅ | ✅ |
| IA inline | ✅ | ✅ |
| Grabación de voz | ✅ | ✅ (Chrome/Edge) |
| Drag & drop reparenting | ✅ | ✅ |
| Apple Calendar sync | ✅ | ❌ |
| Canvas/whiteboard | ✅ | ❌ |
| Spotlight integration | ✅ | ❌ |
| Agentes con schedule | ✅ | Parcial |
| Instalación | App nativa | PWA |

---

## 20. From para iPhone

From está disponible para iPhone con sync instantáneo con tu Mac.

### Pestaña Hoy
La pantalla principal muestra dos vistas para el día seleccionado:

- **Agenda**: tus bucles activos, tareas overdue y tareas del día. Las tareas completadas permanecen visibles hasta el día siguiente.
- **Notas**: el diario del día, con bullets, headings y estructura libre.

Navega entre semanas con las flechas < > o con swipe horizontal en la tira de días. Toca el nombre del mes para volver a hoy. El icono de calendario permite saltar a cualquier fecha.

### Bullets
Cada bullet puede tener hijos. Si los tiene, aparece un chevron a la izquierda para colapsar/expandir. Toca **>** a la derecha para hacer zoom-in en el nodo y ver su contenido completo.

Los bullets están plegados por defecto. Al desplegarlos, los hijos se muestran con el mismo estilo (checkboxes, tags, etc.).

### Tareas y Bucles
- **Tareas** (checkbox amarillo/naranja): tienen fecha de vencimiento. Overdue = naranja.
- **Bucles** (checkbox morado): open loops, siempre visibles en Agenda.
- Swipe izquierda para completar, swipe derecha para eliminar.

### Captura rápida
El botón **+** expande dos opciones:
- **Nota**: crea un bullet en el diario de hoy
- **Tarea**: crea una tarea con fecha (por defecto hoy)

El botón de micrófono crea notas por voz.

### Sync con Mac
From sincroniza automáticamente entre Mac e iPhone. Los cambios aparecen en segundos. El diario, tareas, bucles y notas fijadas están siempre actualizados en todos tus dispositivos.

---

## 20. Ajustes útiles

Accede desde el menú **From → Ajustes** o con `⌘,`.

| Sección | Qué configuras |
|---|---|
| **Cuenta** | Login, suscripción, tokens de IA, API key propia |
| **Apariencia** | Tema claro/oscuro, tamaño de fuente |
| **Atajos de teclado** | Reasigna cualquier atajo de la app |
| **Atajos inline** | Define expansiones de texto propias (abreviación → texto completo) |
| **Calendario** | Activar sync con Apple Calendar, seleccionar calendarios |
| **Tipos y estados** | Crear, editar o eliminar tipos de nodo y estados personalizados |
| **IA** | Agentes, prompts guardados, configuración del asistente |
| **Integraciones** | Conectar cuenta de Google para Google Docs |
| **Búsqueda** | Activar/desactivar integración con Spotlight |
| **Backup** | Estado del backup local, ruta de exportación |
| **Espacio** | Directorio local para archivos y agentes |

**Atajos inline (expansiones de texto):**
- En **Ajustes → Atajos inline** defines abreviaciones propias: escribe una clave corta y From la expande automáticamente al texto que hayas configurado.
- Ejemplo: escribes `;firma` y se expande a tu firma de email completa.
- Útil para bloques de texto recurrentes, plantillas o cualquier texto que repitas a menudo.

**Transcripción de voz (iOS):**
- En la app de iPhone, el botón de micrófono en la captura rápida transcribe tu voz a texto.
- El texto transcrito se inserta como bullet listo para editar.

---

## 21. Importar desde otras apps

From puede importar notas desde Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes y cualquier carpeta de archivos Markdown.

Accede desde **Ajustes → Importar**.

### Cómo organiza From las notas importadas

From trabaja con una jerarquía temporal: cada nota y tarea vive dentro de un día concreto. Al importar, esto es lo que ocurre:

| Qué importas | Dónde va en From |
|---|---|
| Notas y tareas sin fecha | Diario de **ayer** (para no llenar el día actual) |
| Tareas con fecha (`due: 2024-07-01`) | Diario del **día que indica la fecha**, creando ese día si no existe |
| Diarios del origen (LogSeq, NotePlan, archivos `YYYY-MM-DD.md`) | Diario de **su fecha real**, conservando el historial |
| Carpetas del vault | Nodos de agrupación dentro del diario de ayer |

Después de importar, puedes mover cualquier nodo al día que quieras simplemente arrastrándolo en el árbol o editando su parentesco.

---

### Importar desde Notion

**Cómo exportar de Notion:**

1. En Notion, abre **Ajustes** (⚙ arriba a la izquierda) → **Espacio de trabajo** → **Ajustes**.
2. Baja hasta la sección **Exportar contenido del espacio de trabajo**.
3. Haz clic en **Exportar todo el contenido**.
4. Formato de exportación: elige **Markdown & CSV**.
5. Descarga el archivo ZIP que Notion genera.

**Cómo importar en From:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar ZIP** y selecciona el archivo descargado.
3. From detecta automáticamente el formato Notion y lo procesa.

**Qué hace From con tu contenido de Notion:**
- **Títulos de página**: elimina automáticamente los IDs de 32 caracteres que Notion añade al final de los nombres (`Mi página abc123def456...` → `Mi página`).
- **Páginas anidadas**: las subcarpetas de Notion se convierten en nodos padre, respetando la jerarquía.
- **Bases de datos**: los archivos CSV se omiten; las páginas Markdown se importan normalmente.
- **Propiedades frontmatter**: si una página tiene `due:` o `fecha:`, la tarea se coloca en ese día.

---

### Importar desde Obsidian

**Cómo exportar de Obsidian:**

No hace falta exportar nada. Obsidian guarda tus notas como archivos `.md` en una carpeta normal de tu disco.

**Cómo importar en From:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar carpeta** y selecciona la carpeta principal de tu vault de Obsidian (la que contiene la carpeta `.obsidian/`).
3. From detecta automáticamente que es un vault de Obsidian.

**Qué hace From con tu vault de Obsidian:**
- **Estructura de carpetas**: cada carpeta raíz del vault se convierte en un nodo agrupador dentro del diario de ayer.
- **Callouts** (`> [!NOTE]`): se convierten a blockquotes estándar Markdown.
- **Frontmatter**: los campos `due:`, `fecha:`, `tipo:`, `estado:` se mapean a los campos correspondientes de los nodos de From.
- **Carpetas ignoradas**: `.obsidian/`, `.trash/`, `Templates/`, `assets/` y `Attachments/` se omiten.
- **Tareas** (`- [ ]` y `- [x]`): se extraen como nodos hijo con estado Activo o Hecha.

---

### Importar desde LogSeq

**Cómo exportar de LogSeq:**

No hace falta exportar nada. LogSeq guarda el grafo como archivos `.md` en tu disco.

**Cómo importar en From:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar carpeta** y selecciona la carpeta principal de tu grafo (la que contiene la carpeta `logseq/`).
3. From detecta automáticamente el formato LogSeq.

**Qué hace From con tu grafo de LogSeq:**
- **Journals** (`journals/`): cada archivo de diario de LogSeq (con nombre de fecha) se importa al diario de From de su fecha correspondiente.
- **Páginas** (`pages/`): se importan como notas bajo el diario de ayer.
- **Formato de bullets**: LogSeq usa bullets para todo el contenido, incluso la prosa. From los convierte a párrafos normales de Markdown.
- **Referencias de bloque** (`((uuid))`): se eliminan al no tener equivalente en From.
- **Carpetas ignoradas**: `logseq/`, `.recycle/`, `assets/`.

---

### Importar desde NotePlan

**Cómo exportar de NotePlan:**

No hace falta exportar nada. NotePlan guarda las notas como archivos `.md` en tu disco.

**Cómo importar en From:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar carpeta** y selecciona la carpeta del vault de NotePlan.
3. From detecta automáticamente el formato NotePlan (por la presencia de archivos de fecha en la raíz).

**Qué hace From con tu contenido de NotePlan:**
- **Calendar Notes**: los archivos de diario de NotePlan (`YYYY-MM-DD.md`) se importan al diario de From de su fecha.
- **Notas de proyecto**: se importan como notas normales bajo el diario de ayer.
- **Tareas**: las líneas `- [ ]` y `- [x]` se extraen como nodos hijo con estado Activo o Hecha.

---

### Importar desde Bear

**Cómo exportar de Bear:**

1. En Bear, ve al menú **Archivo → Exportar notas**.
2. Selecciona **Todos los archivos** y el formato **Markdown**.
3. Elige una carpeta destino y guarda.

**Cómo importar en From:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar carpeta** y selecciona la carpeta que guardaste.
3. From importa todos los archivos `.md` como notas bajo el diario de ayer.

---

### Importar desde Apple Notes

Apple Notes no tiene exportación directa a Markdown, pero hay una solución sencilla:

**Pasos:**

1. Descarga la app gratuita **Exporter** desde el Mac App Store.
2. Abre Exporter y selecciona tus notas de Apple Notes.
3. Exporta en formato **Markdown** a una carpeta de tu disco.
4. En From, ve a **Ajustes → Importar → Importar carpeta** y selecciona esa carpeta.

---

### Importar una carpeta genérica de Markdown

Cualquier carpeta con archivos `.md` o `.txt` puede importarse en From, sin importar el origen.

**Cómo importar:**

1. En From, ve a **Ajustes → Importar**.
2. Haz clic en **Importar carpeta** y selecciona la carpeta.
3. Opcionalmente, si tienes todo en un ZIP, usa **Importar ZIP**.

**Reglas generales:**
- Cada archivo `.md` o `.txt` se convierte en un nodo.
- Las carpetas se convierten en nodos agrupadores.
- Los archivos con nombre `YYYY-MM-DD.md` se tratan como entradas de diario.
- Las imágenes, PDFs y otros archivos binarios se omiten.
- El frontmatter YAML estándar (`due:`, `fecha:`, `tipo:`, `estado:`) se respeta.

---

## 22. From para Claude — Integración MCP

From se conecta con Claude (Claude Desktop y Claude Code) para que puedas crear notas, añadir tareas y consultar tu vault directamente desde el chat. Claude también guarda automáticamente las conversaciones, artefactos y archivos que subes en tu diario de From.

---

### 22.1 Qué hace la integración

Cuando conectas From con Claude ocurren tres cosas automáticamente:

**1. Claude lee tu contexto al empezar**
En cuanto mencionas un área de trabajo (La Isla, piloto, inversión, personal...), Claude carga el contexto de ese tag desde From antes de responderte. No tienes que explicarle nada.

**2. Todo queda guardado en From**
- Los documentos y análisis que Claude genera van a From como notas del día.
- Los archivos, PDFs y enlaces que tú subes van a From etiquetados con la fecha.
- Al terminar la sesión Claude crea un resumen y lo guarda en el diario.

**3. Claude actualiza tu contexto**
Si la sesión generó información nueva relevante a un área (decisión tomada, cambio de estado, datos nuevos), Claude actualiza el contexto del tag en From para que la próxima sesión empiece con todo al día.

---

### 22.2 Instalación — 3 pasos

#### Paso 1: Genera tu token de API
En From, ve a **Ajustes → Cuenta → Integraciones** y pulsa **"Generar token de API"**.

- El token dura 1 año.
- Si lo generas en Mac, aparece automáticamente en iOS al abrir Ajustes.
- Cópialo — lo necesitarás en el paso 3.

> Asegúrate de que From está sincronizado antes de usar la integración. Si nunca has sincronizado, Claude no podrá ver tus tags ni tu diario.

#### Paso 2: Instala la extensión (Claude Desktop)

**Opción A — Un click (recomendada):**
1. Pulsa **"Instalar extensión"** en Ajustes → Cuenta → Integraciones, o ve a [getfrom.app/claude](https://getfrom.app/claude) y descarga `From.dxt`.
2. Haz doble click en el archivo `.dxt`.
3. Claude Desktop te pedirá el token — pégalo y confirma.

**Opción B — Manual (Claude Code / avanzado):**
Añade esto en `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "from": {
      "type": "http",
      "url": "https://from-server-production.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer TU_TOKEN"
      }
    }
  }
}
```

#### Paso 3: Escribe "Configura From" una sola vez

Una vez instalado y reiniciado Claude, escribe esto en el chat:

> **Configura From**

Claude configurará todo automáticamente — crea o actualiza tu `CLAUDE.md` con el protocolo completo (cargar contexto al empezar, guardar al terminar, comando "fin"). Solo hay que hacerlo una vez.

#### Paso 4: Reinicia Claude
Cierra y vuelve a abrir Claude para que las tools aparezcan. Luego escribe "Configura From".

---

### 22.3 Cómo funciona por dentro

```
Tú hablas con Claude
       │
       ├── Claude detecta el área (La Isla, piloto...)
       │   └── from_get_tag_context("la-isla") → lee contexto del tag
       │
       ├── Trabajas: Claude responde con contexto completo
       │
       ├── Subes un PDF / URL / imagen
       │   └── from_create_node → nodo en el diario de hoy
       │
       ├── Claude genera un documento / plan / análisis
       │   └── from_create_node → nodo en el diario de hoy
       │
       └── Dices "fin" o terminas la sesión
           ├── from_create_node → nota de sesión en el diario
           └── from_update_tag_context → actualiza contexto del tag
```

---

### 22.4 Tags disponibles

Cada tag en From tiene su contexto. Claude los carga automáticamente cuando los mencionas:

| Lo que dices | Tag que carga Claude |
|---|---|
| "La Isla", "Freelanders", "trading" | `la-isla` |
| "Café Olé", "radio", "Radiolé" | `cafe-ole` |
| "MiTrading", "podcast" | `mitrading` |
| "Media Sector", "Íñigo", "clientes" | `media-sector` |
| "inversión", "IBKR", "Apex", "Indexa" | `inversion` |
| "piloto", "PPL", "X-Plane", "ATPL" | `piloto` |
| "personal", "Marina", "diario" | `personal` |
| "coding", "código", "automatización" | `coding` |
| "From" (la app) | `from` |
| "biblioteca", "libro", "curso" | `biblioteca` |
| "procesos", "checklist" | `procesos` |

Para añadir o editar el contexto de un tag: abre el tag en From y edita los bullets directamente en el editor. Claude los leerá en la próxima sesión.

---

### 22.5 Ejemplos de uso

**Empezar sesión de trabajo:**
```
"Hablemos de La Isla — necesito preparar el lanzamiento de junio"
→ Claude carga el contexto de la-isla y trabaja con él
```

**Guardar lo que hace Claude:**
```
"Crea un plan de lanzamiento para el Squad de junio"
→ Claude crea el plan Y lo guarda automáticamente en From (diario de hoy)
```

**Subir contexto:**
```
[Subes un PDF con datos de ventas]
→ Claude lee el PDF, crea una nota en From con el contenido y lo referencia en la sesión
```

**Añadir tareas:**
```
"Añade una tarea para hablar con Adrián el lunes a las 10h"
→ Crea la tarea en From con fecha, sin salir del chat
```

**Consultar tu vault:**
```
"¿Qué tareas tengo pendientes esta semana?"
→ Claude busca en From y te responde con las tareas reales
```

**Cerrar sesión:**
```
"fin"
→ Claude guarda resumen en el diario de hoy y actualiza el contexto del tag si hay algo nuevo
```

---

### 22.6 Sincronización entre tags y Claude

Los tags de From y lo que lee Claude son exactamente lo mismo. El contexto que ves en From al abrir un tag (los bullets bajo "Quién es Alberto", "Qué es", "Escala de valor"...) es exactamente lo que Claude carga con `from_get_tag_context`.

**Para actualizar el contexto de un tag:**
- Edita los bullets directamente en From — Claude los leerá en la próxima sesión.
- O dile a Claude "actualiza el contexto de este tag" al final de una sesión y lo hará automáticamente.

**No hace falta señalar carpetas ni configurar nada extra.** La sincronización es automática por token.

---

### 22.7 Preguntas frecuentes

**¿Necesito tener From abierto mientras uso Claude?**
No. Pero From debe haber sincronizado al menos una vez para que el servidor tenga tus datos. Si creas una nota en Claude y luego abres From, aparecerá en el siguiente sync (automático cada ~60 segundos).

**¿Los tags de From son los mismos que usaba en Claude Cowork?**
Sí. Los tags (antes llamados áreas) de From corresponden directamente a los archivos `contexto-[área].md` de tu vault de Centro. La fuente de verdad ahora es From — edita el contexto en From y Claude lo verá.

**¿El DXT modifica mi CLAUDE.md automáticamente?**
No directamente, pero solo tienes que escribir **"Configura From"** una vez en Claude y él lo hace solo. El DXT instala la conexión; ese comando instala el comportamiento.

**¿Qué hace exactamente el comando "fin"?**
Si tienes el protocolo en tu CLAUDE.md, al decir "fin" Claude:
1. Crea una nota de sesión en el diario de hoy de From con un resumen de la conversación.
2. Si se trabajó en un área concreta, actualiza el contexto del tag con la información nueva.
3. Te confirma en una línea qué guardó.
Sin CLAUDE.md, "fin" no tiene efecto especial — necesitas pedirle explícitamente que guarde.

**¿Qué pasa si no digo "fin"?**
Claude no guarda la nota de sesión automáticamente sin la señal de cierre. Puedes pedirlo en cualquier momento: "guarda esta conversación en From" o "crea una nota con lo de hoy".

**¿Funciona con Claude.ai (web)?**
Por ahora solo con Claude Desktop y Claude Code (ambos con soporte MCP). Claude.ai web no soporta MCP todavía.

**¿El token caduca?**
El token dura 1 año. Si regeneras el token en From, el anterior deja de funcionar — tendrás que actualizar la configuración de Claude.

---

*getfrom.app*
