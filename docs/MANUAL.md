# From — Manual de usuario v9.6

> Web · Mac · iPhone · getfrom.app

---

## 1. ¿Qué es From?

From es tu segundo cerebro. Una app de notas, tareas y gestión de conocimiento personal que organiza todo lo que piensas, haces y quieres recordar en un único árbol jerarquizado, disponible en cualquier dispositivo y con IA integrada que realmente conoce tu información.

Existe para la persona que tiene demasiadas cosas en la cabeza, demasiadas apps para gestionarlas y no quiere invertir horas configurando sistemas complejos. En From, capturas, organizas y actúas desde un solo lugar.

---

## 2. Primeros pasos

### Crear cuenta

Ve a [getfrom.app](https://getfrom.app) y pulsa **Crear cuenta**. Puedes registrarte con:

- Email y contraseña
- Cuenta de Google
- Apple ID

Con la misma cuenta accedes desde el navegador, Mac e iPhone. Todo sincroniza automáticamente.

### Acceder desde el navegador

Ve a [getfrom.app/app](https://getfrom.app/app) desde cualquier navegador moderno. No necesitas instalar nada.

También puedes instalarlo como app de escritorio ligera: en Chrome o Edge pulsa el icono de instalación en la barra de dirección. En Safari iOS: Compartir → "Añadir a pantalla de inicio".

### Instalar en Mac

1. Ve a [getfrom.app](https://getfrom.app) y descarga el archivo `From.dmg`.
2. Abre el DMG y arrastra el icono de From a la carpeta **Aplicaciones**.
3. Abre From desde el Launchpad o desde la carpeta Aplicaciones.
4. Si macOS advierte que no puede comprobar el desarrollador, ve a **Ajustes del sistema → Privacidad y seguridad** y pulsa "Abrir igualmente".
5. Inicia sesión con tu cuenta.

**Actualizaciones automáticas:** cuando haya una nueva versión disponible, aparecerá `✦ Nueva versión — Actualizar` en la barra inferior de From. Un clic instala la actualización sin salir de la app. No hace falta descargar nada manualmente.

### Instalar en iPhone

Busca **From — Notas y PKM** en el App Store o accede desde [getfrom.app/ios](https://getfrom.app/ios). Instala la app e inicia sesión con la misma cuenta. Tus notas aparecen en segundos.

### El primer arranque: qué ves

Cuando entras en From por primera vez encuentras:

- **El árbol principal** en el centro: tu espacio de trabajo. Muestra directamente la **Agenda** — los años (2026, 2027...) desde donde navegas a meses, días y notas.
- **El sidebar izquierdo**: tus paneles guardados y la lista de contextos.
- **La barra superior**: breadcrumb de navegación y controles de vista y panel derecho.
- **El panel derecho**: se abre con Magic (IA), Filtro, Planificador o el contenido de un Contexto seleccionado.

Para empezar: haz clic en el año actual para ver tus notas del mes, o pulsa `H` para ir directamente al día de hoy.

---

## 3. El árbol — cómo funciona From

Todo en From vive en un único árbol. No hay carpetas, no hay archivos: cada nota, tarea, evento o recurso es un **nodo** que puede contener otros nodos hijos.

### Todo es un nodo

Un proyecto es un nodo. Una tarea dentro de ese proyecto es un nodo hijo. Una nota que documenta la reunión de ese proyecto es otro nodo hijo. Todo anidado, todo visible, todo movible.

### Crear nodos

- **Enter**: crea un nuevo nodo hermano debajo del actual. El cursor se mueve automáticamente al nuevo nodo.
- **Clic en zona vacía**: crea un nodo al final del nivel en el que haces clic.

Para editar cualquier nodo, haz clic en su texto.

### Indentar y desindentar

- **Tab**: indenta el nodo actual, convirtiéndolo en hijo del nodo de arriba.
- **Shift+Tab**: desindenta el nodo, subiéndolo un nivel en la jerarquía.

Ejemplo: tienes "Proyecto web" y creas "Reunión con diseñador" debajo. Si pulsas Tab en "Reunión con diseñador", pasa a ser hijo de "Proyecto web".

### Colapsar y expandir

Haz clic en el triángulo **▶** a la izquierda de un nodo para colapsar sus hijos. Haz clic de nuevo para expandirlos. Los nodos con hijos empiezan colapsados por defecto para mantener el árbol limpio.

Atajos del slash menu:

- `/Expandir todo` — expande todos los descendientes del nodo actual.
- `/Colapsar todo` — colapsa todos los descendientes.

### Reorganizar con drag & drop

Pasa el cursor sobre cualquier nodo y aparecerá el handle de arrastre `⋮⋮` a la izquierda. Arrastra desde ese handle para:

- Cambiar el orden del nodo entre sus hermanos.
- Moverlo dentro de otro nodo (reparentar).

Mientras arrastras, una línea de destino indica dónde caerá el nodo al soltar.

### Selección multinodo

Haz clic y arrastra el cursor sobre varios nodos para seleccionarlos (los nodos marcados quedan en azul). Con la selección activa:

- **Backspace / Delete** — elimina los nodos seleccionados
- **Escape** — cancela la selección
- **⌘A** — selecciona todos los nodos visibles

### Zoom en un nodo

Pasa el cursor sobre cualquier nodo y aparece el icono **→** a su derecha. Haz clic para hacer zoom: ese nodo se convierte en la raíz visible del árbol. Útil para trabajar dentro de un proyecto sin que el resto del árbol distraiga.

El **breadcrumb de navegación** en la barra superior muestra dónde estás y te permite volver a cualquier nivel anterior con un clic.

---

## 4. Tipos de nodo

### Nota (por defecto)

Cualquier nodo sin tipo especial es una nota. Escribe texto libre con formato Markdown inline:

| Formato | Sintaxis |
|---|---|
| **Negrita** | `**texto**` |
| *Cursiva* | `*texto*` |
| `Código` | `` `texto` `` |
| ~~Tachado~~ | `~~texto~~` |
| [Enlace](url) | `[texto](url)` |

Las notas también pueden tener un **body**: contenido largo, multilínea, con Markdown completo. Al seleccionar una nota, su body aparece en el panel derecho donde puedes editarlo libremente. Útil para desarrollar ideas, documentar proyectos o guardar notas extensas.

**Bloques de texto** (desde el slash menu):

- **Título** (H1, H2, H3): encabezados para estructurar el contenido.
- **Lista**: un ítem con guión visual, mayor indentación.
- **Cita**: bloque con barra lateral izquierda.
- **Código**: bloque con fuente monoespaciada y fondo diferenciado.
- **Separador**: línea horizontal para dividir secciones.

**Atajos Markdown al escribir:**

- Escribe `# ` al inicio → Título H1
- Escribe `## ` → Título H2
- Escribe `### ` → Título H3
- Escribe `- ` → bullet tipo Lista

### Tarea

Las tareas tienen un checkbox ☐/☑ a la izquierda del texto. Marcarla como hecha archiva la tarea y actualiza su estado.

**Cómo crear una tarea:**

- Escribe `/tarea` en el slash menu.
- Escribe `[ ] ` al inicio del texto del nodo.
- Escribe `[x] ` para crear una tarea ya marcada como hecha.
- Usa el atajo `⌘Enter` sobre un nodo para convertirlo en tarea.

Al convertir un nodo en tarea (con `-t` + Enter o `⌘Enter`), siempre se crea un nodo hermano vacío debajo para que puedas seguir escribiendo sin interrupciones.

**Propiedades de tarea (panel derecho):**

- **Estado**: Pendiente / En progreso / Hecho / Vencido.
- **Fecha de vencimiento**: asígnala escribiendo en el campo de fecha con lenguaje natural. From detecta automáticamente expresiones como:
  - `hoy`, `mañana`, `pasado mañana`
  - `el lunes`, `el próximo viernes`
  - `en 3 días`, `en 2 semanas`
  - `15 junio`, `15/06`
  - Mientras escribes, aparece texto en gris (ghost text) con la fecha interpretada. Pulsa `Tab` para aceptarla.
- **Prioridad**: alta, media o baja. Aparece como badge junto al texto.
- **Repetición**: diaria, semanal, mensual o personalizada (cada N días/semanas/meses/años).

**Marcar como hecha:** haz clic en el checkbox. Para desmarcarla, vuelve a hacer clic.

**Ampliar una tarea:** cuando descubres que una tarea es más grande de lo que pensabas y necesita sub-tareas o notas, usa `/Ampliar` desde el slash menu. La tarea se convierte en un contenedor que puede tener hijos.

### Evento

Los eventos tienen hora de inicio y hora de fin. Aparecen en el Planificador y en la vista de la Agenda del día correspondiente. Si tienes Google Calendar conectado, los eventos sincronizan automáticamente en ambas direcciones.

**Cómo crear un evento:**

- Escribe `/evento` en el slash menu.
- Escribe `-e ` al inicio del texto.

Al confirmar el tipo evento (con `-e` + Enter), se crea un nodo hermano vacío debajo para continuar capturando.

El modal de creación de evento te permite:

- Poner título al evento.
- Elegir fecha (obligatoria).
- Añadir hora de inicio y fin (opcional; si no hay hora, es un evento de todo el día).
- Activar repetición.

### Espejo ⬡

Un espejo es una referencia sincronizada a otro nodo. Muestra exactamente el mismo contenido que el original. Si editas el espejo, editas el original (y viceversa). Si editas el original, el espejo refleja el cambio de inmediato.

**Para qué sirve un espejo:**

- Quieres que una tarea aparezca tanto en "Trabajo" como en "Proyecto X" sin duplicarla.
- Mueves una tarea a otro día: el nodo original queda con un espejo automático en su lugar para que no pierdas el rastro.
- Un recurso o nota que es relevante en varios contextos.

**Cómo crear un espejo:**

- Slash menu → `/Espejo` → se abre un buscador → selecciona el nodo que quieres reflejar.
- Clic derecho sobre el nodo → "Crear espejo".

Los espejos se identifican visualmente con el icono ⬡ junto al texto.

### Recurso / Enlace

Un recurso es un enlace a contenido externo: un artículo, un vídeo de YouTube, un podcast, una página web. From extrae automáticamente el título y el tipo de contenido al pegarlo.

**Cómo crear un recurso:**

- Slash menu → `/Recurso`.
- **Pega una URL en un nodo vacío**: From la detecta automáticamente, hace unfurl (obtiene el título real de la página), y el nodo queda con el título de la web y el icono de enlace 🔗 en el bullet. La URL se preserva en los metadatos aunque cambies el título del nodo.

**Comportamiento del nodo de enlace:**

- El bullet cambia a un **icono de cadena** 🔗 (en lugar del punto normal).
- **Clic en el bullet** → navega a la nota del nodo en From.
- El botón **↗** inline (al lado del texto) → abre la URL en el navegador externo.
- Al editar el texto del nodo, la URL se preserva aunque cambies el título.

**Propiedades de un recurso (panel derecho):**

- URL del enlace.
- Estado: Pendiente / Futuro / Hecho (para marcar si lo has consumido o no).
- Tipo detectado automáticamente (artículo, vídeo YouTube, podcast...).

Los recursos aparecen en el bloque de recursos de la Agenda diaria para que recuerdes lo que tienes pendiente de revisar.

### PDF

Arrastra cualquier archivo PDF desde tu ordenador a un nodo en From. El PDF se sube a la nube y queda disponible en todos tus dispositivos.

**Cómo adjuntar un PDF:**

- Arrastra el archivo `.pdf` desde el Finder directamente a cualquier nodo. Se crea automáticamente un nodo hijo con el nombre del archivo y el badge **PDF** (rojo).

**Visor y anotaciones:**

Al abrir un nodo PDF, aparece el visor integrado con barra de herramientas:

| Herramienta | Función |
|---|---|
| ✏️ Lápiz | Trazo libre. Elige color y grosor. |
| 🖍 Subrayado | Pincel semitransparente amarillo. |
| T Texto | Haz clic en el PDF para insertar texto flotante. |
| ◻ Borrador | Elimina anotaciones. |

Las anotaciones se guardan en From y se **incrustan permanentemente** en el PDF al salir. Si abres el PDF fuera de From, las anotaciones siguen ahí.

### Pizarra

Una pizarra es un canvas SVG de dibujo libre dentro de un nodo.

**Cómo crear una pizarra:**

- Slash menu → `/Pizarra`.
- Escribe `pizarra` o `whiteboard` en cualquier parte del texto de un nodo: aparece un ghost text de confirmación. Pulsa `Enter` para confirmar.

La pizarra usa las mismas herramientas que el visor de PDF (lápiz, subrayado, texto, borrador). Las anotaciones se guardan automáticamente.

### Agente IA

Un agente es un nodo especial que ejecuta una tarea con IA de forma autónoma. Define qué debe hacer (prompt), cuándo se activa (schedule) y qué acciones puede realizar (crear nodos, buscar, leer tu árbol).

**Cómo crear un agente:** slash menu → `/Agente`.

**Casos de uso:**

- Resumir el diario de hoy cada noche a las 23:00.
- Extraer tareas de una nota larga cuando la terminas.
- Procesar el inbox de capturas y clasificar los items.
- Buscar en internet y guardar el resumen como nota.

Los agentes se configuran desde el panel derecho: prompt, schedule (al abrir la app / diario / semanal / hora concreta) y permisos.

### Prompt

Un prompt es una plantilla de texto reutilizable para la IA. Créalo una vez y úsalo cuando quieras lanzar siempre el mismo tipo de instrucción.

**Cómo crear un prompt:** slash menu → `/Prompt`.

Útil para: "resume esto en 3 bullets", "extrae las tareas", "traduce al inglés", "mejora el tono formal".

---

## 5. El Slash Menu — acciones rápidas

Escribe `/` en cualquier nodo para abrir el menú de acciones rápidas. Puedes seguir escribiendo para filtrar: `/ta` muestra todas las opciones que contienen "ta".

### Texto

| Acción | Resultado |
|---|---|
| Texto | Nodo de texto normal (por defecto) |
| Lista | Nodo con guión visual y mayor indentación |
| Título 1 | Encabezado grande (H1) |
| Título 2 | Encabezado mediano (H2) |
| Título 3 | Encabezado pequeño (H3) |
| Cita | Bloque de cita con barra lateral |
| Código | Bloque de código con fuente monoespaciada |
| Separador | Línea horizontal divisoria |

### Objetos

| Acción | Resultado |
|---|---|
| Nota | Convierte el nodo en nota (tipo base) |
| Tarea | Convierte el nodo en tarea con checkbox |
| Evento | Convierte el nodo en evento con hora |
| Recurso | Convierte el nodo en recurso (enlace externo) |
| Ampliar | Convierte una tarea en un contenedor expandible |

### IA

| Acción | Resultado |
|---|---|
| Agente | Crea un nodo de tipo agente autónomo |
| Prompt | Crea una plantilla de prompt reutilizable |
| Resumir | Resume el contenido del nodo y sus hijos |
| Encontrar tareas | Extrae tareas del texto del nodo y las crea como hijos |

### Vistas

| Acción | Resultado |
|---|---|
| Lista inline | Muestra los hijos en vista de lista (árbol) |
| Tabla inline | Muestra los hijos en vista de tabla con columnas |
| Kanban inline | Muestra los hijos en tablero kanban por estado |
| Calendario inline | Muestra los hijos en vista de calendario |

### Mover a fecha

Escribe `/mover a viernes` o `/mover a 15 junio` → el slash menu entra en modo fecha con ghost text predictivo que muestra la fecha interpretada. Pulsa `Tab` o `Enter` para aplicar la fecha. El nodo se mueve al día indicado en la Agenda y se deja un espejo en la posición original.

También puedes usar los accesos rápidos:

| Acción | Resultado |
|---|---|
| Mover a hoy | Mueve el nodo al día de hoy en la Agenda |
| Mover a mañana | Mueve el nodo al día de mañana |
| Mover a próxima semana | Mueve al primer día de la semana siguiente |

### Árbol

| Acción | Resultado |
|---|---|
| Expandir todo | Expande todos los nodos hijos recursivamente |
| Colapsar todo | Colapsa todos los nodos hijos |
| Contar hijos | Muestra cuántos descendientes tiene el nodo |
| Duplicar | Crea una copia exacta del nodo con todos sus hijos |
| Espejo | Crea un espejo de este nodo en otro lugar |

---

## 6. Captura unificada — Espacio y búsqueda global

Pulsar `Espacio` (con el foco en el árbol y ningún nodo en edición) o el botón `+` abre el **modal de captura unificada**. Este modal hace todo en un solo lugar: crea nodos, busca, navega y da acceso rápido a tus puntos de partida habituales.

### Vista sin texto — accesos rápidos

Al abrirse sin texto muestra cuatro accesos directos:

| Opción | Acción |
|---|---|
| **📅 Hoy** | Navega a la nota del día de hoy |
| **📅 Mañana** | Navega a la nota de mañana |
| **◈ Filtros →** | Abre la lista de tus filtros guardados |
| **🧠 Contextos →** | Abre la lista de todos tus contextos |

También aparecen los nodos marcados como **Favoritos** para acceso rápido.

### Buscar con texto

Empieza a escribir y From busca en tiempo real:

- **Nombre de una nota** → navega directamente al nodo
- **Nombre de un contexto** (ej. "trabajo") → abre el filtro de ese contexto + panel lateral
- **"contextos"** → muestra todos los contextos para seleccionar con ↑↓ y Enter
- **"filtros"** → muestra todos los filtros guardados
- **"hoy" / "mañana"** → acceso rápido a esos días
- **Texto libre** → si no hay coincidencias, aparece "Crear: [tu texto]" para crear un nodo nuevo

La búsqueda ignora tildes y mayúsculas.

### Crear con flags

Al crear cualquier elemento, añade flags al final del texto:

- `-t` → crea una tarea
- `-e` → crea un evento
- `-f` → marca como favorito

### Ghost text de predicciones

Mientras escribes en el modal, el ghost text puede sugerir fechas, tipos de nodo o contextos basándose en lo que escribes. Pulsa `Tab` para aceptar la sugerencia.

### Regla de activación de Espacio

- Si el input activo en el árbol **está vacío**: `Espacio` abre el modal de captura.
- Si el input activo **tiene texto**: `Espacio` inserta un espacio normal en el texto.

El atajo `⌘K` es equivalente a `Espacio` y funciona como acceso alternativo siempre disponible, incluso si hay texto en edición.

---

## 7. El Sidebar

El sidebar es el panel izquierdo de navegación. Contiene dos secciones principales:

### PANELES

Tus vistas dinámicas personalizadas. Cada panel es un filtro guardado o un acceso a un nodo concreto. Se actualizan automáticamente mostrando siempre el estado actual.

- **Reordenar**: arrastra los paneles con el handle `⠿` que aparece al pasar el cursor.
- **Eliminar**: icono `×` al pasar el cursor.
- **Crear**: activa un filtro con `⌘F` y pulsa el icono 📊 en la barra de resultados para guardarlo como panel.
- **Seleccionar**: clic en el panel activa el filtro en la vista central. Escape lo desactiva y vuelve a la agenda.

### CONTEXTOS

Lista de todos tus contextos, accesibles de un clic. Los contextos son etiquetas de trabajo que agrupan nodos relacionados a través del árbol.

- **Clic en un contexto**: filtra el árbol central mostrando todos los nodos con ese contexto, y abre el contenido del contexto (editable) en el panel derecho.
- **Chevron ›**: si un contexto tiene sub-contextos con contenido, puedes expandirlos.
- **Botón +**: crea un nuevo contexto directamente desde el sidebar. Escribe el nombre y pulsa Enter.
- **Escape**: deselecciona el contexto activo y cierra el panel derecho.

### El menú ··· (arriba a la derecha)

Acceso a las herramientas del sistema que no viven en el árbol principal:

- **Agentes** — tus agentes de IA autónomos.
- **Plantillas** — plantillas reutilizables.
- **Papelera** — nodos eliminados. Puedes recuperarlos (clic derecho → Restaurar) o borrarlos definitivamente.
- **Ajustes** — cuenta, IA, integraciones, apariencia, backup.
- **Cerrar sesión**.

---

## 8. La barra superior y el panel derecho

### Barra superior

La barra superior muestra en todo momento dónde estás y te da acceso a los controles de la vista actual.

- **Breadcrumb de navegación**: muestra la ruta desde el nodo raíz hasta el nodo actual. Cada elemento es clicable para volver a ese nivel. Ejemplo: `Árbol > Trabajo > Proyecto web > Reunión 4 junio`.
- **Iconos de vista**: cambian entre lista, tabla, kanban o calendario para el nodo actual.
- **Modo oscuro** (icono luna): alterna entre tema claro y oscuro.

### Panel derecho — cuatro modos

El panel derecho se activa con los iconos en la barra superior derecha:

| Icono | Panel | Atajo |
|---|---|---|
| ✦ | **Magic** — asistente IA con chat y voz | `M` |
| ⌘F | **Filtro** — filtros inteligentes con chips y resultados | `⌘F` |
| P | **Planificador** — timeline diario y vista año | `P` |
| (contexto) | **Contenido del contexto** — aparece al hacer clic en un contexto del sidebar | — |

Cada modo ocupa el panel derecho. Para cerrar el panel, pulsa `Escape` o haz clic de nuevo en el icono activo.

---

## 9. Sistema @ — Contextos

Los contextos son etiquetas que agrupan nodos relacionados más allá de la jerarquía del árbol. Imagina que tienes proyectos de trabajo repartidos en distintas ramas: con el contexto `@trabajo` los ves todos juntos de golpe sin reorganizar nada.

### Asignar un contexto a un nodo

Escribe `@` en cualquier nodo. Se abre el picker con los contextos disponibles. Selecciona el que quieres asignar. El nodo queda etiquetado con un chip morado visible junto al texto.

Puedes asignar más de un contexto al mismo nodo. También funciona en la captura unificada (Espacio): escribe `@` y From sugiere contextos como ghost text.

### Crear y gestionar contextos

**Desde el sidebar**: pulsa `+` en la sección CONTEXTOS. Escribe el nombre y pulsa Enter. El nuevo contexto aparece en la lista y se abre en el panel derecho listo para añadir contenido.

**Desde el propio contexto (panel derecho)**: al seleccionar un contexto, se abre como outliner editable en la columna derecha. Añade hijos para describir el contexto, guardar instrucciones para la IA o crear sub-secciones.

Los contextos son nodos raíz especiales con `_tagDefinition` internamente. No son carpetas del sistema: son nodos normales del árbol a los que From asigna función de etiqueta.

### Filtrar por contexto desde el sidebar

Haz clic en cualquier contexto del sidebar. El árbol central se filtra mostrando todos los nodos con ese contexto asignado, y el panel derecho muestra el contenido del contexto.

Pulsa **Escape** para desactivar el filtro y volver a la agenda.

### Filtrar por @contexto en el campo de filtro

En la barra de filtros (`⌘F`), escribe `@trabajo` (o el nombre de tu contexto) para ver todos los nodos con ese contexto asignado. En iOS, los chips morados de contexto en la pestaña Explorar hacen lo mismo con un toque.

### El Perfil de IA

Dentro del contexto **Perfil IA** puedes escribir información personal que la IA carga siempre: quién eres, en qué trabajas, tus proyectos activos, preferencias de comunicación. La IA lo usa automáticamente en todas las conversaciones sin que tengas que repetírselo.

### Auto-clasificación con IA

From puede sugerir automáticamente el contexto más apropiado para cada nota o tarea.

**Badge en tiempo real:** al crear o editar un nodo sin contexto asignado, aparece un badge pequeño `✦ NombreContexto` junto al texto. Haz clic para confirmar el contexto sugerido o seleccionar otro. From aprende de tus correcciones.

**Filtro "Sin clasificar":** en la lista de contextos aparece una entrada especial **"Sin clasificar"** con el número de nodos pendientes. Al hacer clic, el árbol se filtra para mostrar solo esos nodos.

**Clasificar todos de golpe:** bajo el filtro "Sin clasificar" aparece el botón **"✦ Clasificar todos"**. Púlsalo para que From analice en background todos los nodos históricos sin contexto. El progreso se muestra en una barra con "Clasificando… X/Y". Puedes cancelar en cualquier momento con el botón ✕.

La clasificación usa IA (Claude Haiku) sin consumir tokens de tu plan.

### Por qué usar contextos

Los contextos te permiten cruzar el árbol por dimensión. Tus tareas de trabajo están repartidas por proyectos en distintas ramas, pero con `@trabajo` las ves todas juntas. Sin mover nada, sin duplicar nada.

---

## 10. Favoritos

Los favoritos son un marcador rápido para los nodos que usas con frecuencia.

**Marcar como favorito:** pulsa `⌘⇧F` en cualquier nodo para hacer toggle favorito. El nodo queda marcado con una estrella dorada.

**Acceder a favoritos:** abre la captura unificada (Espacio) sin escribir nada. Los favoritos aparecen en la sección **Favoritos** del estado vacío del modal.

**Filtrar favoritos:** usa el operador `favorito` en el campo de filtro (`⌘F`) para ver todos tus nodos marcados.

**Uso en iOS:** en la pestaña Buscar, el estado vacío muestra los favoritos directamente para acceso inmediato.

---

## 11. La Agenda y el sistema de nodos

### La Agenda — vista principal

La vista de inicio de From ES la Agenda. Al abrir la app ves directamente los años (2026, 2027...). Navegar es tan sencillo como expandir el año → mes → día.

La Agenda organiza el tiempo en la jerarquía: **Año → Mes → Día**. Cada día tiene su propia nota con:

- Las tareas con vencimiento ese día (incluidas las vencidas que siguen pendientes).
- Los eventos del día (sincronizados con Google Calendar si está conectado).
- Un área de escritura libre para notas del día, capturas e ideas.

**Ir al día de hoy:** pulsa `H` o el icono de calendario en la barra superior.

**Navegar a otro día:** expande el árbol de años/meses/días. También puedes navegar desde el Planificador (tecla `P`) haciendo clic en cualquier día en la Vista Año.

**Mover tareas a otro día:** slash menu → `/Mover a hoy`, `/Mover a mañana` o `/Mover a fecha...`. From coloca el nodo en el día destino y deja un espejo en el origen.

Los nodos con tareas pendientes en su interior muestran el icono 📁 (contenedor vivo) aunque estén colapsados, indicando que hay trabajo pendiente dentro.

### Nodos del sistema (menú ···)

Los siguientes elementos son del sistema y se acceden desde el menú `···` (arriba a la derecha):

**🤖 Agentes** — agentes de IA autónomos. Al abrir un agente aparecen los controles: toggle Activo/Pausado y botón ▶ Ejecutar.

**📋 Plantillas** — plantillas reutilizables. Para usar una: slash menu → `/Plantilla`.

**🗑 Papelera** — nodos eliminados. La jerarquía se preserva.
- Clic derecho → **Restaurar** — devuelve el nodo a su ubicación original.
- Clic derecho → **Eliminar permanentemente**.

**⚙️ Ajustes**:
- **Cuenta**: email, contraseña, plan actual.
- **IA**: modelo activo, claves API propias (Pro/Lifetime), configuración de agentes.
- **Predicciones**: palabras clave para reconocer tareas y eventos.
- **Integraciones**: Google Calendar, conexión MCP con Claude.
- **Datos / Backup**: snapshots, restaurar, exportar JSON o Markdown.
- **Apariencia**: tema claro/oscuro, densidad, color de acento.

---

## 12. Filtros inteligentes

Los filtros te permiten ver exactamente lo que necesitas en cada momento, sin reorganizar el árbol.

Los filtros son **completamente reactivos en tiempo real**: si mueves una tarea a mañana, cambias su estado o le asignas una fecha, el filtro se actualiza al instante sin necesidad de refrescar. Los nodos que dejan de cumplir el filtro salen del resultado con una animación de deslizamiento hacia la derecha.

**Activar:** `⌘F` o el icono de filtro en la barra superior (panel derecho).

### Lenguaje natural

Puedes escribir directamente en lenguaje natural y From traduce tu consulta a los operadores técnicos automáticamente:

- "tareas de hoy y pasadas" → `tarea hoy o vencido`
- "recursos sin fecha" → `recurso sin-fecha`
- "todo lo de esta semana" → `semana`
- "favoritos pendientes" → `favorito pendiente`

From usa IA (Haiku, gratuita para todos los usuarios) para interpretar la consulta. No consume tokens de tu plan.

### Operadores disponibles

| Operador | Muestra |
|---|---|
| `hoy` | Nodos con fecha de hoy o nota de diario de hoy |
| `mañana` | Nodos con fecha de mañana |
| `semana` | Nodos con fecha en la semana actual |
| `mes` | Nodos con fecha en el mes actual |
| `pasado` | Nodos con fecha anterior a hoy |
| `futuro` | Nodos con fecha posterior a hoy |
| `sin-fecha` | Nodos sin fecha de vencimiento asignada |
| `con-fecha` | Nodos con cualquier fecha asignada |
| `tarea` | Todos los nodos que son tareas |
| `pendiente` | Tareas pendientes (no completadas) |
| `hecho` | Tareas completadas |
| `vencido` | Tareas cuya fecha ya pasó y no están hechas |
| `bucle` | Notas/nodos con tareas pendientes en su interior (📁 contenedor vivo) |
| `nota` | Todos los nodos de tipo nota |
| `evento` | Todos los eventos |
| `recurso` | Todos los recursos |
| `archivo` | Nodos con archivos adjuntos (PDF u otros) |
| `enlace` | Nodos de tipo enlace/URL |
| `diario` | Nodos de tipo diario (notas de día) |
| `favorito` | Nodos marcados como favorito |
| `@contexto` | Nodos con ese contexto asignado |
| `#tag` | Nodos que contienen ese tag en el texto |
| `[[nombre]]` | Nodos que referencian ese nodo por nombre (wiki-link) |
| `node:ID` | Nodo concreto y todos sus descendientes o referencias |

**Combinaciones:** los operadores son combinables. Separa varios operadores con espacio (AND implícito) o usa `o` para OR:

- `hoy pendiente` → tareas pendientes con fecha de hoy.
- `@trabajo pendiente` → tareas pendientes del contexto trabajo.
- `hoy pendiente @trabajo` → tareas pendientes de hoy en el contexto trabajo.
- `vencido @personal` → tareas vencidas del contexto personal.
- "tareas de hoy o mañana" → `tarea hoy o tarea mañana`.

La búsqueda ignora tildes y mayúsculas.

### El operador `bucle` — contenedores vivos

El operador `bucle` filtra los nodos que tienen tareas pendientes en su interior. Estos nodos muestran el icono 📁 (contenedor vivo) en el árbol aunque estén colapsados.

Es ideal para ver qué proyectos, áreas o notas tienen trabajo sin terminar: filtra por `bucle` y ves de un vistazo todos los contenedores activos. Un nodo sale del filtro `bucle` cuando todas sus tareas internas están marcadas como hechas.

No se aplica a: eventos, recursos, diary entries ni nodos temporales.

### Filtrar desde Magic Chat

Si abres Magic Chat y describes lo que quieres ver ("muéstrame las tareas vencidas", "filtra por recursos de esta semana"), Magic detecta la intención y aplica el filtro directamente sin que tengas que abrir `⌘F` ni escribir operadores.

### Chips de sugerencia

Debajo del campo de filtro aparecen chips de acceso rápido: **Hoy**, **Tareas**, **Pendientes**, **Esta semana**, **Vencidas**, **Eventos**. Haz clic para activarlos directamente.

### Vistas de resultado

Los resultados pueden verse en cuatro modos. Cambia con los iconos de la barra:

| Vista | Cuándo usarla |
|---|---|
| **Lista** | Árbol filtrado editable inline. Vista estándar. |
| **Tabla** | Columnas con propiedades (estado, fecha, prioridad). Ideal para muchos nodos con metadatos. |
| **Kanban** | Tablero con columnas por estado o prioridad. Drag & drop entre columnas. |
| **Calendario** | Vista mensual con nodos distribuidos por fecha de vencimiento. |

### Guardar un filtro como panel

Cuando tienes un filtro útil, guárdalo en el sidebar con el botón 📊 de la barra de resultados. Aparece en tus paneles y lo tienes disponible con un clic desde cualquier vista.

---

## 13. Paneles (📊)

Los paneles son vistas dinámicas fijas en la sección PANELES del sidebar. Se actualizan automáticamente siempre que los abres. Hay dos tipos:

**Panel de nodo**: muestra ese nodo y todos sus descendientes y referencias. Como hacer zoom en ese nodo pero accesible siempre desde el sidebar.

**Panel de filtro**: el resultado de un filtro guardado. Por ejemplo: "mis tareas de hoy", "@trabajo pendiente", "#lectura". Cada vez que lo abres muestra el estado actual.

### Cómo crear un panel

**Desde un filtro activo:** con el filtro en pantalla, pulsa el icono 📊 en la barra de resultados.

**Desde un nodo:** clic derecho sobre el nodo → "Añadir a paneles". El panel muestra ese nodo y todos sus descendientes junto con cualquier referencia al nodo.

### Gestionar paneles

Pasa el ratón sobre un panel en la sección PANELES para ver los botones de acción:

- **✏ Renombrar**: edición inline del nombre. Enter confirma, Escape cancela.
- **× Eliminar**: elimina el panel permanentemente.
- **Reordenar**: arrastra con el handle `⠿`.
- **Activar**: clic en el panel lo aplica en el árbol central. Escape lo desactiva.

Los paneles se sincronizan entre todos tus dispositivos.

---

## 14. Vistas inline

Cualquier nodo que tenga hijos puede mostrar esos hijos en cuatro modos de visualización distintos. Las vistas inline no cambian cómo se almacenan los datos, solo cómo los ves.

Activa la vista desde el slash menu (→ Vistas) o desde los iconos de la barra superior del nodo.

### Lista (por defecto)

El árbol anidado clásico. Cada hijo aparece como un nodo con posibilidad de expandir sus propios hijos. Editable inline.

### Tabla

Cada hijo del nodo es una fila. Las columnas son las propiedades: estado, fecha de vencimiento, prioridad, y cualquier columna personalizada que crees.

**Columnas personalizadas:** haz clic en "+" en la cabecera de la tabla para añadir una columna. Tipos disponibles: texto, número, selección, selección múltiple, fecha, checkbox, URL, tag, tarea, recordatorio.

- Los headers de columna son clicables para ordenar (ascendente/descendente/original).
- Puedes renombrar, reordenar y eliminar columnas.
- Las columnas se comparten entre todas las vistas del mismo nodo (la tabla y el kanban ven los mismos datos).

### Kanban

Los hijos aparecen como tarjetas en columnas. Por defecto las columnas son los estados (Pendiente, En progreso, Hecho). Puedes agrupar por:

- Estado
- Prioridad
- Cualquier columna de tipo selección

Arrastra tarjetas entre columnas para actualizar el valor directamente. Haz clic en "+" dentro de una columna para crear un nuevo nodo con ese estado/valor ya asignado.

### Calendario

Los hijos con fecha de vencimiento aparecen en el día correspondiente de un calendario mensual. Haz clic en cualquier día para crear un nuevo nodo con esa fecha.

### Multi-vistas: guarda más de una vista por nodo

Puedes crear múltiples vistas para el mismo nodo. Pulsa el "+" junto a los tabs de vista para añadir una nueva. Cada vista guarda su tipo, configuración y nombre de forma independiente. Puedes renombrar, duplicar y eliminar vistas.

---

## 15. Magic — la inteligencia de From

Magic es la capa de inteligencia de From. La idea no es "tener IA": es que **From te entienda**. Escribes como piensas y From se encarga de lo demás — entiende qué es cada cosa, la ordena, recuerda quién eres y se anticipa. Todo en segundo plano, sin menús y sin que tengas que mantener nada. El objetivo es eliminar la fricción entre lo que piensas y lo que queda escrito, y hacerlo rápido.

Magic tiene tres caras:

1. **Te entiende mientras escribes** — clasifica, fecha y detecta el tipo de cada nota sin que toques un menú (ver más abajo y la sección 9).
2. **Te recuerda** — construye un perfil tuyo y un conocimiento por contexto a partir de lo que escribes ("Lo que From sabe").
3. **Actúa por ti** — Magic Chat, grabadora, agentes programados.

### Cómo From te entiende — la capa de inteligencia

**Contextos automáticos con jerarquía.** Mientras escribes, From clasifica cada nota en el contexto al que pertenece (trabajo, familia, un proyecto concreto), entendiendo la **jerarquía** de contextos y subcontextos. Una nota de "La Isla" va a "Trabajo › La Isla", no a una etiqueta plana. Si hace falta un contexto que no existe, From puede crear el subcontexto en el lugar correcto. El badge de contexto aparece junto al nodo con la sugerencia; un clic la confirma o la cambia. Los contextos y los nodos estructurales (Agenda/Año/Mes) nunca muestran badge.

**"Lo que From sabe" por contexto.** Cada contexto acumula su propio conocimiento vivo, en tres apartados: **Palabras clave**, **Personas** y **Temas frecuentes**. From lo extrae solo de las notas que clasificas ahí y lo mantiene al día: cuando añades algo nuevo, **fusiona** la información nueva con la que ya había, sin duplicar, en lugar de reescribirlo todo. La actualización es proactiva (al clasificar nodos) y vuelve a aprender si sigues editando un nodo ya clasificado. Solo guarda información nueva: si no hay nada que añadir, no toca nada. Abres un contexto y From ya sabe de qué va.

**Tu perfil — From te recuerda.** From construye un perfil tuyo a partir de lo que escribes: tus proyectos, las personas estables de tu vida, tus objetivos y activos a largo plazo. Filtra el ruido — **solo retiene lo que perdura**, no las tareas del día ni los problemas temporales — y sintetiza en vez de copiar literal ("Me voy a casar" → "Tiene planes de matrimonio con su pareja"). El aprendizaje se guarda aunque salgas del nodo, navegues a otra página o el nodo lo cree un agente. Abre tu perfil desde **CONTEXTOS → Mi perfil**.

**Clasificar todo lo antiguo.** En el panel de contextos, bajo "Sin clasificar", el botón **"Clasificar todos"** procesa de una vez todos los nodos antiguos sin contexto, con barra de progreso y posibilidad de cancelar.

### Magic Chat — asistente de voz y texto

Magic Chat conoce tu árbol, tus tareas, tus contextos y tu perfil personal.

**Abrir Magic:**
- Icono ✦ en la barra superior derecha
- Tecla `M` (sin ningún input activo)

Escribe en el campo y pulsa Enter para enviar.

**Grabar con voz:** mantén `R` mientras hablas. Al soltar, transcribe y envía. El waveform animado muestra que está escuchando.

**Dónde crea Magic las cosas:**
- Recordatorios y tareas genéricas → van al **diario de hoy**
- Si estás en una nota de proyecto y pides añadir algo relacionado → va a **esa nota**
- Si no es el destino correcto: botón **"Muévelo a esta nota"** o **"Muévelo a hoy"** junto a Deshacer

**Navegar directamente:** di "ver las tareas de mañana" o "ábreme la nota de proyectos" — Magic navega directamente sin texto intermedio.

**Qué puede hacer:**
- Crear tareas, notas y eventos en tu árbol
- Navegar directamente a cualquier nota o día del diario
- Resumir el contenido de cualquier nodo
- Buscar información en tus notas
- Organizar, reescribir, priorizar
- Aplicar filtros directamente al describir lo que quieres ver
- Ejecutar acciones en masa

**Contexto automático:** la IA carga automáticamente:
- El nodo abierto con su título, body e hijos.
- El diario de hoy con tus tareas y eventos.
- Tus tareas pendientes.
- Los contextos (@) activos con sus instrucciones.
- Tu perfil de IA.

### Enseñar a Magic — aprendizaje continuo

Magic aprende de tus correcciones y se adapta a ti progresivamente.

**Cómo enseñar:** botón derecho en cualquier nodo → **Enseñar a Magic**. Opciones según el nodo:
- "Esto no es una tarea / evento"
- "Debería ser una tarea / evento"
- "El contexto no es correcto"
- "Esta interpretación es correcta ✓"
- Campo libre: "Magic, recuerda que..."

**Ver lo aprendido:** Ajustes → Magic → sección "Lo que Magic ha aprendido de ti". Edita o borra cualquier elemento individualmente.

### Ghost text — predicciones mientras escribes

Mientras escribes en cualquier nodo, From muestra sugerencias en gris claro (ghost text):

- Si detecta un **verbo de acción** o una expresión que suena a tarea → sugiere convertir el nodo en tarea. Pulsa `Tab` para aceptar.
- Si detecta una **fecha en lenguaje natural** (`mañana`, `el lunes`, `15 junio`) → sugiere esa fecha como vencimiento. Pulsa `Tab` para aceptar. Pulsar `Enter` después crea un nodo hermano debajo.
- Si el texto parece un **evento** (hora, reunión, llamada) → sugiere tipo evento.

Personaliza qué palabras activan estas sugerencias en **Ajustes → Predicciones**.

### Códigos de variables en prompts

Dentro de cualquier agente o prompt puedes usar variables que From resuelve antes de enviar a la IA:

| Código | Se reemplaza por |
|---|---|
| `{{fecha}}` | Fecha actual completa |
| `{{fecha_corta}}` | Fecha en formato corto (04/06/2026) |
| `{{dia}}` | Nombre del día (jueves) |
| `{{semana}}` | Número de semana del año |
| `{{mes}}` | Nombre del mes |
| `{{año}}` | Año actual |
| `{{hora}}` | Hora actual |
| `{{nota}}` | Contenido del nodo actual |
| `{{tag}}` | Tags/contextos del nodo actual |

Para insertar un código en el editor: escribe `{{` y se abre un picker con todas las variables disponibles.

### Agentes autónomos

Los agentes son nodos de tipo Agente que se ejecutan de forma programada o manual. Pueden leer tu árbol, crear notas, ejecutar búsquedas en internet y modificar nodos.

Los agentes se configuran en su panel de propiedades:

- **Prompt**: qué debe hacer.
- **Schedule**: cuándo se activa (al abrir la app, diario, semanal, hora concreta).
- **Acciones permitidas**: crear nodos, modificar nodos, buscar en internet.

**Ejemplos de agentes:**

- Cada noche a las 23:30: "Resume el diario de hoy en 3 puntos clave y añádelos como hijos".
- Cada lunes: "Lista las tareas de la semana que vienen y crea un resumen en Agenda".
- Al abrir la app: "Muestra las tareas vencidas y pregunta qué hacer con cada una".

---

## 16. El Planificador

El Planificador es la vista de calendario de From. Pulsa `P` (sin ningún input activo) o el icono de planificador en la barra superior para abrirlo y cerrarlo. Ocupa el panel derecho.

### Dos vistas

**Vista Día**: timeline de 24 horas con tus tareas y eventos dividido en dos zonas:

- **Franja "Todo el día"** (parte superior): muestra las tareas del día con fecha pero sin hora asignada, y los eventos de todo el día de Google Calendar. Es el punto de partida para planificar: aquí tienes todo lo que queda por ubicar en el tiempo.
- **Timeline de horas** (parte inferior): muestra las tareas y eventos con hora concreta. Los bloques indican su hora de inicio y pueden redimensionarse para ajustar la duración.

**Vista Año**: los 12 meses del año en una grid responsive. Los días con tareas o eventos aparecen con un punto. Haz clic en cualquier día para navegar a la nota de ese día en la Agenda.

**Navegación**: botones ‹ › para avanzar o retroceder. Botón **Hoy** para volver al día actual.

### Modelo de datos — el nodo nunca se mueve

El Planificador no mueve ni duplica tus nodos del árbol. **El nodo siempre permanece en su lugar original en el árbol.** Usar el planificador únicamente asigna o cambia la hora del nodo.

### Planificar una tarea — asignar hora

**Desde el árbol al timeline**: arrastra cualquier nodo desde el árbol central hacia el timeline del planificador. Se asigna la hora del punto donde sueltas. El nodo sigue en el mismo lugar del árbol — solo ha ganado una hora programada.

**Desde el árbol a "Todo el día"**: arrastra un nodo a la franja superior para asignarle solo una fecha (sin hora). Aparece en la franja all-day hasta que le asignes hora.

**Desde "Todo el día" al timeline**: arrastra un elemento de la franja all-day hacia el timeline para asignarle una hora concreta. A partir de ese momento aparece en el grid de horas.

**Clic en hora vacía**: crea un nuevo nodo directamente en esa hora. Escribe el título y pulsa Enter.

**Redimensionar**: arrastra el borde inferior de cualquier bloque para cambiar su duración.

**Mover un bloque**: arrastra el bloque a otra hora. La línea morada indica el inicio real del bloque al posicionarlo.

### Sincronización con Google Calendar al planificar

Si tienes Google Calendar conectado, el planificador crea y actualiza eventos automáticamente:

- **Asignar hora** a una tarea → se crea un evento en Google Calendar.
- **Mover o redimensionar** el bloque → el evento de Google Calendar se actualiza al instante.
- **Quitar la hora** (clic derecho → "Quitar hora") → el evento de Google Calendar se elimina.

Los eventos de Google Calendar también se muestran en el planificador con su color original y pueden moverse y redimensionarse directamente desde From.

### Clic derecho sobre un bloque

- **Ir al nodo** — navega al nodo en el árbol.
- **Quitar hora (→ todo el día)** — elimina la hora pero mantiene la fecha. El nodo vuelve a la franja all-day.
- **Quitar del planificador** — elimina la fecha y hora por completo.
- **Color** — cambia el color del bloque en el planificador.

### Zoom

- **Zoom vertical** (escala de horas): arrastra el eje de horas hacia arriba para hacer zoom in o hacia abajo para zoom out. También con Shift + rueda del ratón.
- **Zoom horizontal** (columnas de días): arrastra la cabecera de días para ver más o menos días simultáneamente (entre 2 y 7).
- **Restablecer zoom**: botón ↺ en la barra del planificador.

Pulsa **Escape** para cerrar el planificador.

---

## 17. Google Calendar

### Conectar

Ve a **Ajustes → Integraciones → Google Calendar** y sigue el proceso de autorización. Solo necesitas hacerlo una vez.

### Cómo funciona

- Tus eventos de Google Calendar aparecen en el Planificador con el color de cada calendario.
- Crear un evento en From lo crea también en Google Calendar.
- Editar o eliminar un evento funciona en ambas direcciones: lo que cambias en From se refleja en Google Calendar, y viceversa.
- Los colores de tus calendarios de Google se respetan.
- La sincronización tiene en cuenta tu zona horaria local.

### Eventos en la Agenda

Si tienes Google Calendar conectado, los eventos del día aparecen en el nodo del día en la Agenda, junto a tus tareas. En el Planificador, los eventos de Google se muestran con su color original.

---

## 18. Mover nodos

Hay varias formas de mover un nodo a otro lugar:

**Drag & drop:** arrastra desde el handle `⋮⋮` (visible al pasar el cursor) y suelta en el destino.

**Slash menu:**

- `/Mover a hoy` → mueve al nodo del día de hoy en la Agenda.
- `/Mover a mañana` → mueve al nodo de mañana.
- `/Mover a próxima semana` → mueve al primer día de la semana siguiente.
- `/Mover a fecha…` → escribe cualquier fecha en lenguaje natural con ghost text predictivo.

**Clic derecho → "Mover a..."** → abre un buscador para elegir el destino.

**Atajos de teclado:**

- `⌘↑` / `⌘↓` → mueve el nodo arriba o abajo entre sus hermanos.

Al mover un nodo a otro día, el nodo se traslada físicamente al destino y el sistema crea espejos automáticamente para que no pierdas el rastro:

- En el **origen** queda un espejo del nodo movido, con una referencia visual al día destino.
- En el **destino** se crean espejos del contexto original para que el nodo llegue con su contexto preservado.
- Los espejos muestran el mismo icono que el nodo original con opacidad reducida para distinguirlos.

---

## 19. From para iPhone

La app de iPhone está disponible en el App Store. Organiza en cinco pestañas accesibles desde la barra inferior:

### Pestaña 1 — Explorar

Vista de filtrado rápido por chips multiselect. Selecciona combinaciones de chips para ver exactamente lo que necesitas:

**Tipo:**
- Nota, Tarea, Evento, Archivo, Enlace

**Fecha:**
- Hoy, Esta semana, Este mes, Pasado, Futuro

**Estado:**
- Pendiente, Hecho, Sin fecha, Bucle

**Contextos** (chips morados): filtra por el contexto asignado a cada nodo.

**Filtros guardados** (chips azules con 🔖): tus filtros personalizados guardados desde web o Mac, disponibles con un toque.

Debajo de los chips aparece el resultado con el número de nodos encontrados y la lista completa. Al tocar cualquier resultado se abre la **vista de detalle del nodo** (IOSNodeDetailView) con el menú "..." para acciones: editar, mover, marcar como hecho, etc.

### Pestaña 2 — Buscar

Búsqueda full-text en tiempo real con auto-foco de teclado. Escribe cualquier término y From busca en todo tu árbol al instante.

El estado vacío (antes de escribir) muestra tus **Favoritos** para acceso inmediato a los nodos que usas con más frecuencia.

### Pestaña 3 — Agenda

Vista diaria y semanal con las tareas y eventos del día. Navega entre días con swipe o los controles de la cabecera.

### Pestaña 4 — Planner

Planificador de tareas con timeline. Muestra las tareas del día con y sin hora, y permite reorganizar la jornada.

### Pestaña 5 — Ajustes

Gestión de cuenta, modelo de IA, integraciones (Google Calendar), apariencia e importación.

### Sincronización

Todo lo que capturas en iPhone aparece en web y Mac en tiempo real. Los cambios viajan solo como deltas (solo lo que cambia, no la base de datos completa).

---

## 20. Backup y privacidad

### Backup automático en el servidor

From crea un snapshot completo de tus datos en el servidor cada 2 horas (solo cuando hay cambios). Se conservan los últimos **12 snapshots** (~24 horas de historial continuo).

Puedes crear un snapshot manual cuando quieras: **Ajustes → Datos → Backups → "Crear snapshot ahora"**.

### Restaurar un backup

En **Ajustes → Datos → Backups**, elige cualquier snapshot de la lista y pulsa "Restaurar". Antes de sobrescribir tus datos, el servidor crea automáticamente un snapshot de seguridad (`pre-restore`) para que puedas deshacer si te equivocas.

### Exportar tus datos

En **Ajustes → Exportar** puedes descargar todos tus datos en cualquier momento:

- **JSON**: formato estructurado con todos los metadatos (para uso programático o migraciones).
- **Markdown**: una carpeta de archivos `.md`, uno por nodo con cuerpo. Legible en cualquier editor.

Tus datos no están atrapados en From. La exportación es completa, sin restricciones y funciona en el plan gratuito.

### Privacidad

- La IA solo accede al contenido que está en el contexto de la conversación activa: el nodo abierto, sus hijos y los contextos que tengas activos. No escanea todo el árbol de forma automática.
- El backup local en Mac se guarda en `Application Support/From/Backups/` en tu propio ordenador.

---

## 21. Atajos de teclado

| Acción | Atajo |
|---|---|
| Captura unificada / búsqueda global | `Espacio` |
| Búsqueda global (alternativo) | `⌘K` |
| Nuevo nodo hermano | `Enter` |
| Indentar nodo | `Tab` |
| Desindentar nodo | `Shift+Tab` |
| Aceptar sugerencia ghost text | `Tab` |
| Descartar sugerencia ghost text | `Esc` |
| Mover nodo arriba entre hermanos | `⌘↑` |
| Mover nodo abajo entre hermanos | `⌘↓` |
| Toggle nodo ↔ tarea | `⌘Enter` |
| Toggle favorito | `⌘⇧F` |
| Filtro inteligente | `⌘F` |
| Abrir/cerrar planificador | `P` |
| Abrir/cerrar Magic | `M` |
| Grabar con voz en Magic (mantener) | `R` |
| Slash menu | `/` |
| Ir al día de hoy | `H` |
| Deseleccionar contexto / limpiar filtro / cerrar panel | `Escape` |
| Negrita | `⌘B` |
| Cursiva | `⌘I` |
| Deshacer | `⌘Z` |
| Rehacer | `⌘⇧Z` |
| Seleccionar todos los nodos visibles | `⌘A` |

---

## 22. Ajustes

### Cuenta

- Email y contraseña.
- Plan actual y fechas de renovación.
- Cancelar suscripción (el acceso se mantiene hasta el final del periodo pagado).
- Historial de tokens de IA consumidos.

### Idioma

From está disponible en español e inglés. El idioma se detecta automáticamente a partir de la configuración de tu navegador o sistema operativo.

Para cambiarlo manualmente: **Ajustes → 🌐 Idioma** y elige entre Español e English. El cambio se aplica de inmediato sin necesidad de recargar.

### Apariencia

- **Tema**: claro, oscuro o automático (sigue el sistema).
- **Densidad**: compacto, normal o espacioso. Cambia el espaciado entre nodos.
- **Color de acento**: el color del interfaz (por defecto morado).
- **Calendario y Timeline**: rango de horas mostrado en el planificador (por defecto 7:00-23:00).

### IA

- **Modelo**: el modelo de IA que usa From por defecto (Claude, GPT, Gemini).
- **Claves API propias**: si tienes plan Pro o Lifetime, puedes usar tus propias claves de API de Anthropic, OpenAI o Google para que el consumo vaya a tu cuenta.
- **Configuración de agentes**: permisos y límites generales de los agentes autónomos.

### Predicciones

Añade palabras clave propias para que From las reconozca como señal de tarea o evento mientras escribes. Por ejemplo: si añades "llamar", cada vez que escribas "llamar a..." From sugerirá convertirlo en tarea automáticamente.

### Integraciones

- **Google Calendar**: conectar, desconectar, ver estado de sincronización.
- **Claude (MCP)**: genera tu token de API para conectar From con Claude Desktop o Claude Code. Ver instrucciones detalladas más abajo.

### Datos / Backup

- Historial de snapshots automáticos.
- Botón para crear snapshot manual.
- Restaurar un snapshot anterior.
- Exportar en JSON o Markdown.

### Importar

From puede importar notas desde otras apps:

- Obsidian (vault de Markdown)
- Notion (export JSON)
- LogSeq
- NotePlan
- Bear
- Apple Notes
- Cualquier carpeta de archivos Markdown

Ve a **Ajustes → Importar**, elige la fuente y sigue el proceso.

---

## 23. Conexión con Claude (MCP)

From tiene integración nativa con Claude Desktop y Claude Code. Una vez conectado, Claude guarda automáticamente documentos, tareas y resúmenes de conversación en tu vault sin que tengas que pedirlo.

### Cómo conectar — Claude Desktop (recomendado)

1. Ve a **Ajustes → Integraciones → Claude (MCP)**.
2. Pulsa **"Generar token de API"**. El token dura 1 año.
3. Descarga **From.dxt** con el botón que aparece en la misma pantalla.
4. Haz doble clic en el archivo. Claude Desktop lo instala y pide el token — pégalo.
5. En la misma pantalla de ajustes aparece el **Paso 3**: copia el bloque de instrucciones y pégalo en **Claude Desktop → Ajustes → Perfil → Instrucciones personalizadas**.

Hecho. Desde ese momento Claude guarda automáticamente en From en todas tus conversaciones.

### Cómo conectar — Claude Code (CLI)

1. Genera tu token en **Ajustes → Integraciones → Claude (MCP)**.
2. Añade la entrada `from` a `~/.claude.json` bajo la clave `mcpServers`:

```json
"mcpServers": {
  "from": {
    "type": "http",
    "url": "https://from-server-production.up.railway.app/mcp",
    "headers": { "Authorization": "Bearer TU_TOKEN" }
  }
}
```

3. Copia el bloque de instrucciones de Ajustes y pégalo en tu `~/.claude/CLAUDE.md`.
4. Reinicia Claude Code.

### Cómo conectar — iPhone, Android y Claude.ai web

From funciona también como conector remoto en Claude para iOS, Android y en Claude.ai desde el navegador. El servidor MCP de From es público — Anthropic se conecta a él desde su propia nube, no desde tu dispositivo, así que no importa qué uses.

1. Genera tu token en **Ajustes → Integraciones → Claude (MCP)** (mismo token que para Desktop).
2. En Claude (iOS, Android o claude.ai): **Ajustes → Conectores personalizados → Añadir conector**.
3. Introduce:
   - **URL:** `https://from-server-production.up.railway.app/mcp`
   - **Autenticación:** Bearer → pega tu token de API
4. Copia el bloque de instrucciones personalizadas de Ajustes y pégalo en el perfil de Claude.

Desde ese momento From funciona igual desde el iPhone que desde el Mac — sin que el Mac tenga que estar encendido.

### Qué hace Claude con From automáticamente

- **Guarda documentos y análisis** que genera durante la conversación.
- **Crea tareas** cuando mencionas acciones pendientes.
- **Guarda resúmenes de sesión** cuando dices "fin".
- **Carga contexto de área** si mencionas proyectos configurados en tu Perfil IA.
- **Busca en tu vault** antes de responder para darte contexto real.

**Ejemplos:**

```
"¿Qué tareas tengo pendientes para hoy?"
"Añade una tarea para llamar a Adrián mañana a las 10"
"Busca en mis notas todo lo relacionado con el proyecto X"
fin  →  Claude guarda el resumen de la conversación en From automáticamente
```

---

## 23b. Accesorios — captura desde cualquier sitio

From no te obliga a tener la app delante. Estos accesorios mandan lo que tengas a tu **nota de hoy**, y la inteligencia de From se encarga de clasificarlo (tipo, fecha, contexto). Todos —salvo la barra de menús— se conectan con el **token de API** de tu cuenta.

### El token de API
Es la llave que usan Raycast, Chrome y la extensión de Claude para hablar con tu From. Se genera y copia en **Ajustes → Accesorios** (es el mismo token para los tres; regenerarlo invalida el anterior). Vive 1 año.

### Barra de menús (Mac)
From vive en la barra de menús del Mac con su icono (el árbol).
- **Clic en el icono** (o menú → *Captura rápida*) → abre una ventana de captura tipo Spotlight: escribe una nota, tarea o evento y cae en tu nota de hoy. From detecta el tipo, la fecha y los `@contextos` que escribas.
- Cerrar la ventana principal **no** cierra From: sigue disponible en la barra de menús.
- **Ocultarlo**: Ajustes → Accesorios → desactiva "Mostrar icono en la barra de menús", o clic derecho en el icono → *Ocultar este icono*.

### Atajo de Apple (tecla global)
Para capturar desde **cualquier app** con una sola tecla.
1. En **Ajustes → Accesorios → Atajo de Apple** pulsa **"Instalar atajo de Apple"** (abre el atajo listo en la app Atajos) y añádelo.
2. En la app Atajos, abre los **Ajustes del atajo → Tecla rápida** y asígnale la combinación que quieras (por ejemplo ⌃⌥Espacio).
3. Al pulsarla, te pide el texto y lo guarda directamente en tu nota de hoy.

Por debajo usa el enlace `from://capture?text=…&silent=1`. Si prefieres montarlo a mano, crea un Atajo con la acción *"Abrir URL"* usando ese enlace y sustituye `[Texto]` por *"Pedir texto"* o *"Portapapeles"*.

### Raycast
Extensión de From para [Raycast](https://raycast.com):
- **Create in From** — escribe y cae en tu nota de hoy (From decide si es nota, tarea o evento).
- **Search From** — busca en todo tu vault y abre el resultado en la app o en la web.
- **Open Today's Note** — abre tu nota diaria.

Instálala desde la Raycast Store y pega tu token de API en sus preferencias (Ajustes → Accesorios → Raycast → copiar token).

### Chrome
Extensión de From para Chrome:
- **Clic en el icono** → guarda la URL de la pestaña actual en tu nota de hoy (se convierte en enlace).
- **Selecciona texto → clic derecho → "Enviar selección a From"** → lo guarda como nodo.

Instálala desde la Chrome Web Store, abre sus **Opciones** y pega tu token de API.

### Conexión con Claude (MCP)
La integración con Claude Desktop/Code está descrita en la sección anterior — usa el mismo token de API.

---

## 24. Planes y precios

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | €0 | Hasta 1.000 nodos sync, sin IA, sin archivos |
| **Trial** | 7 días gratis | Acceso completo a Pro durante 7 días (requiere tarjeta) |
| **Pro Mensual** | €7/mes | Nodos ilimitados, IA completa, archivos adjuntos, notas públicas |
| **Pro Anual** | €49/año (€4,08/mes) | Todo lo de Pro Mensual, facturado anualmente |
| **Lifetime** | €149 pago único | Todo lo de Pro para siempre + 3M tokens de IA incluidos |

### Prueba gratuita de 7 días

Puedes probar todas las funcionalidades Pro durante 7 días sin coste. Se requiere tarjeta de crédito para activar el trial; si no cancelas antes de que finalice el periodo, la suscripción pasa automáticamente a Pro mensual.

Durante el trial tienes acceso completo a IA, nodos ilimitados, archivos adjuntos e integraciones. La barra superior muestra un badge **"Prueba gratuita · X días restantes"** para que sepas cuánto tiempo queda.

Para cancelar en cualquier momento: **Ajustes → Cuenta → Suscripción → Cancelar** o desde [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing).

Gestiona tu suscripción en **Ajustes → Cuenta → Suscripción** o en [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing).

Tras completar el pago, tu plan se actualiza automáticamente en la app en cuestión de segundos. No hace falta recargar ni cerrar sesión.

Si tienes código de beta o cupón, introdúcelo en el checkout al comprar. Los cupones del 100% activan el plan igual que un pago normal.

---

## 25. Canal de Telegram — @FromMagicBot

Suscríbete al canal oficial de From en Telegram para recibir tips semanales sobre cómo sacar el máximo partido a la app: atajos, flujos de trabajo, casos de uso con Magic y novedades.

**Cómo unirte:** busca **@FromMagicBot** en Telegram o accede desde el enlace en getfrom.app.

Los tips se envían de forma automática sin necesidad de interacción. Es un canal de difusión, ideal para aprender From de forma gradual sin saturar tu bandeja de entrada.

---

## Preguntas frecuentes

**¿Puedo usar From sin conexión?**
Sí. La app Mac e iPhone funciona sin conexión. Los cambios se sincronizan automáticamente cuando recuperas la conexión.

**¿Qué pasa si supero los 1.000 nodos en el plan gratuito?**
Puedes seguir leyendo tus notas, pero no crear nuevas hasta que elimines nodos o actualices a Pro.

**¿Dónde se guardan mis datos?**
En los servidores de From (Europa) y, en Mac, también en un backup local en tu propio ordenador. Puedes exportar todo en JSON o Markdown desde Ajustes en cualquier momento.

**¿La IA lee todas mis notas?**
No. La IA solo accede al contenido que está en el contexto de la conversación activa: el nodo abierto, sus hijos y los contextos que tengas activos. No escanea el árbol completo de forma automática.

**¿Puedo importar mis notas de Obsidian, Notion u otras apps?**
Sí. Ve a **Ajustes → Importar**. From acepta exports de Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes y carpetas de Markdown en general.

**¿Los espejos (⬡) sincronizan en ambas direcciones?**
Sí. Editar el espejo edita el original, y cualquier cambio en el original se refleja en todos sus espejos inmediatamente.

**¿Puedo compartir una nota con alguien que no tiene From?**
Sí. Clic derecho sobre el nodo → "Publicar". From genera una URL pública del tipo `getfrom.app/p/...` con el contenido renderizado. Solo quienes tengan el enlace pueden verla.

**¿Cómo funciona la sincronización entre dispositivos?**
Los cambios se sincronizan en tiempo real (delta: solo viajan los cambios, no toda la base de datos). En condiciones normales, los cambios aparecen en segundos en todos tus dispositivos.

**¿El backup automático consume cuota?**
No. Los snapshots automáticos son parte del servicio en todos los planes. El historial guarda los últimos 12 snapshots.

**¿Cómo cancelo la suscripción?**
Desde **Ajustes → Cuenta → Suscripción** o en [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Tu acceso Pro se mantiene hasta el final del periodo pagado.

**¿Puedo usar mis propias claves de API de IA?**
Sí, en el plan Pro o Lifetime. Ve a **Ajustes → IA** y añade tus claves de Anthropic, OpenAI o Google. El consumo irá a tu cuenta y no descuenta de los tokens de From.

**¿Qué es el filtro `bucle`?**
El operador `bucle` muestra los nodos (proyectos, áreas, notas) que tienen tareas pendientes en su interior. Útil para ver de un vistazo qué contenedores tienen trabajo sin terminar. En el árbol, estos nodos muestran el icono 📁 aunque estén colapsados.

**¿La captura con Espacio y ⌘K son lo mismo?**
Sí. `Espacio` abre el modal de captura unificada cuando el cursor no está editando texto. `⌘K` hace lo mismo y funciona siempre, aunque haya texto en edición. Son sinónimos del mismo modal.

---

*getfrom.app — Tu segundo cerebro. En todos tus dispositivos.*
