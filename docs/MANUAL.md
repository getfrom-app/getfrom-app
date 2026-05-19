# From — Manual de usuario

> Versión 3.8 · macOS 14+ · iOS 17+

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

**Organizar el día con drag & drop:**
- Pulsa el icono `clock` en la columna derecha → abre panel dividido (tareas izquierda + timeline derecha)
- Arrastra cualquier tarea desde la columna izquierda al slot horario deseado
- El timeline muestra slots de **15 minutos** — cada uno se resalta al pasar por encima con el label `HH:MM` exacto
- El `due` de la tarea se actualiza con esa hora al soltar
- Las tareas ya colocadas en el timeline se mueven con snap visual a 15 min: el bloque muestra su posición final antes de soltar
- Pulsa `clock` de nuevo para volver al panel único de tareas

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
Dos pestañas de icono:
- `checklist` **Tareas del día** — bucles abiertos (con sus tareas hijas anidadas), tareas vencidas, tareas de hoy, completadas
- `clock` **Timeline** — calendario 24h con eventos de Apple Calendar. Pulsar de nuevo colapsa el timeline

**Panel dividido (organización del día):**
- Pulsa el `clock` → la columna se duplica: tareas a la izquierda, timeline a la derecha
- Arrastra cualquier tarea al slot horario deseado para bloquear tiempo en el día
- La nota central se estrecha para dar espacio al panel dividido
- Pulsa `clock` de nuevo → colapsa de vuelta al panel único

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
- Bullets, nodos y archivos ilimitados en local.
- Sin sincronización entre dispositivos ni IA.

**Con cuenta:**
- Los cambios se sincronizan automáticamente entre Mac e iPhone cada pocos minutos.
- El sync es delta: solo viajan los cambios, no toda la base de datos.

**Planes:**

| Plan | Precio | Incluye |
|---|---|---|
| Gratuito | €0 | Nodos y archivos locales, sin sync |
| Suscripción | €7/mes | Sync + IA con tokens gestionados |
| Licencia | €59 única | Sync + IA con tu propia API key |

**Tokens de IA (plan suscripción):**
- El uso del chat consume tokens prepago incluidos en la suscripción.
- Puedes comprar recargas adicionales desde **Ajustes → Cuenta**.

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

## 19. From para iPhone

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
From sincroniza automáticamente entre Mac e iPhone. Los cambios aparecen en segundos. El diario, tareas, bucles y favoritos están siempre actualizados en todos tus dispositivos.

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

*getfrom.app*
