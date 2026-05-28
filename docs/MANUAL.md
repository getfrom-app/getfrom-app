# From — Manual de usuario v9.1

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

1. Ve a [getfrom.app/download](https://getfrom.app/download) y descarga el archivo `From.dmg`.
2. Abre el DMG y arrastra el icono de From a la carpeta **Aplicaciones**.
3. Abre From desde el Launchpad o desde la carpeta Aplicaciones.
4. Si macOS advierte que no puede comprobar el desarrollador, ve a **Ajustes del sistema → Privacidad y seguridad** y pulsa "Abrir igualmente".
5. Inicia sesión con tu cuenta.

Las actualizaciones de Mac se instalan automáticamente en segundo plano.

### Instalar en iPhone

Busca **From — Notas y PKM** en el App Store o accede desde [getfrom.app/ios](https://getfrom.app/ios). Instala la app e inicia sesión con la misma cuenta. Tus notas aparecen en segundos.

### El primer arranque: qué ves

Cuando entras en From por primera vez encuentras:

- **El árbol principal** en el centro: tu espacio de trabajo. Al principio incluye los nodos raíz del sistema: 📅 Agenda, 🧠 Contexto, 📋 Plantillas, 📌 Atajos, 🤖 Agentes y 🗑 Papelera.
- **El sidebar izquierdo**: accesos rápidos, navegación y ajustes.
- **El panel derecho**: propiedades y contenido del nodo seleccionado.
- **La barra superior**: breadcrumb de navegación y controles de filtro y vista.

Para empezar: haz clic en el área en blanco del árbol o pulsa `Enter` para crear tu primer nodo.

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

Arrastra el cursor desde una zona vacía del árbol sobre varios nodos. Cuando el cursor sale del nodo inicial, se activa la selección por área: los nodos que cruzan el punto medio del cursor quedan seleccionados (marcados en azul). Con la selección activa puedes eliminarlos, moverlos o aplicar acciones en masa.

También puedes arrastrar directamente desde el punto/bullet del nodo para iniciar la selección de inmediato.

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
- **Lista**: un ítem con guión visual, mayor indentación. Diferente al bullet normal.
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
- Usa el atajo `⌘+Enter` sobre un nodo para convertirlo en tarea.

**Propiedades de tarea (panel derecho):**

- **Estado**: Pendiente / En progreso / Hecho / Vencido.
- **Fecha de vencimiento**: asígnala escribiendo en el campo de fecha con lenguaje natural. From detecta automáticamente expresiones como:
  - `hoy`, `mañana`, `pasado mañana`
  - `el lunes`, `el próximo viernes`
  - `en 3 días`, `en 2 semanas`
  - `15 junio`, `15/06`
  - While escribes, aparece texto en gris (ghost text) con la fecha interpretada. Pulsa `Tab` para aceptarla.
- **Prioridad**: alta, media o baja. Aparece como badge junto al texto.
- **Repetición**: diaria, semanal, mensual o personalizada (cada N días/semanas/meses/años).

**Marcar como hecha:** haz clic en el checkbox. Para desmarcarla, vuelve a hacer clic.

**Ampliar una tarea:** cuando descubres que una tarea es más grande de lo que pensabas y necesita sub-tareas o notas, usa `/Ampliar` desde el slash menu. La tarea se convierte en un contenedor que puede tener hijos.

### Evento

Los eventos tienen hora de inicio y hora de fin. Aparecen en el Planificador y en la vista de la Agenda del día correspondiente. Si tienes Google Calendar conectado, los eventos sincronizan automáticamente en ambas direcciones.

**Cómo crear un evento:**

- Escribe `/evento` en el slash menu.
- Escribe `-e ` al inicio del texto.

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

### Recurso

Un recurso es un enlace a contenido externo: un artículo, un vídeo de YouTube, un podcast, una página web. From intenta extraer automáticamente el título del enlace al pegarlo.

**Cómo crear un recurso:**

- Slash menu → `/Recurso`.
- Pega una URL directamente en un nodo vacío: From la detecta y ofrece convertirla en recurso.

**Propiedades de un recurso (panel derecho):**

- URL del enlace.
- Estado: Pendiente / Futuro / Hecho (para marcar si lo has consumido o no).
- Tipo detectado automáticamente (artículo, vídeo YouTube, podcast...).

Los recursos aparecen en el bloque de recursos de la Agenda diaria para que recuerdes lo que tienes pendiente de revisar.

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

### Mover

| Acción | Resultado |
|---|---|
| Mover a fecha… | Abre selector: escribe una fecha en lenguaje natural |
| Mover a hoy | Mueve el nodo al día de hoy en la Agenda |
| Mover a mañana | Mueve el nodo al día de mañana |
| Mover a próxima semana | Mueve al primer día de la semana siguiente |

Al mover un nodo a otro día, se deja un espejo ⬡ en la posición original para que no pierdas el rastro.

### Árbol

| Acción | Resultado |
|---|---|
| Expandir todo | Expande todos los nodos hijos recursivamente |
| Colapsar todo | Colapsa todos los nodos hijos |
| Contar hijos | Muestra cuántos descendientes tiene el nodo |
| Duplicar | Crea una copia exacta del nodo con todos sus hijos |
| Espejo | Crea un espejo de este nodo en otro lugar |

---

## 6. El Sidebar

El sidebar es el panel izquierdo de navegación. Contiene:

**📌 Atajos** — tus accesos rápidos personalizados, sincronizados entre dispositivos. Aparecen en la parte superior para que llegues de un clic a los nodos y filtros que usas más. Puedes reordenarlos arrastrándolos.

**Hoy** — abre el nodo del día actual en la Agenda. Tu punto de partida cada mañana.

**Planificador** — vista de calendario con tus tareas y eventos del mes. Desde aquí planificas y navegas entre días.

**Papelera** — contiene los nodos eliminados. Puedes recuperarlos en cualquier momento (clic derecho → "Restaurar") o eliminarlos definitivamente.

**Ajustes** — abre el panel de configuración: cuenta, IA, integraciones, apariencia, backup y preferencias.

**Cerrar sesión** — cierra la sesión activa.

---

## 7. La barra superior

La barra superior muestra en todo momento dónde estás y te da acceso a los controles de la vista actual.

- **Breadcrumb de navegación**: muestra la ruta desde el nodo raíz hasta el nodo actual. Cada elemento es clicable para volver a ese nivel. Ejemplo: `Árbol > Trabajo > Proyecto web > Reunión 27 mayo`.
- **⌘F** — activa el filtro inteligente inline. El árbol se filtra en tiempo real según los operadores que escribas.
- **Iconos de vista**: cambian entre lista, tabla, kanban o calendario para el nodo actual.
- **Modo oscuro** (icono luna): alterna entre tema claro y oscuro.

---

## 8. Sistema @ — Contextos

Los contextos son etiquetas que agrupan nodos relacionados más allá de la jerarquía del árbol. Imagina que tienes proyectos de trabajo repartidos en distintas ramas del árbol: con un contexto `@trabajo` puedes verlos todos juntos de golpe sin reorganizar nada.

### Asignar un contexto

Escribe `@` en cualquier nodo. Se abre el picker de contextos con los contextos disponibles. Selecciona el que quieres asignar. El nodo queda etiquetado con un chip morado visible junto al texto.

Puedes asignar más de un contexto al mismo nodo.

### Dónde se definen los contextos

Todos tus contextos viven en el nodo raíz **🧠 Contexto**. Ábrelo para:

- Crear nuevos contextos.
- Renombrarlos.
- Organizarlos en grupos.
- Añadir a cada contexto información de fondo que la IA usa como contexto adicional al trabajar contigo (por ejemplo, en el contexto `@trabajo` puedes describir en qué empresa trabajas, cuál es tu rol y qué proyectos llevas).

Dentro de **🧠 Contexto** también vive tu **Perfil**: información personal que la IA carga siempre para entenderte mejor sin que tengas que explicarte en cada conversación.

### Filtrar por @contexto

En la barra de filtros (⌘F), escribe `@trabajo` (o el nombre de tu contexto) para ver todos los nodos con ese contexto asignado. Los contextos más usados aparecen como chips de sugerencia debajo del campo de filtro.

### Por qué usar contextos

Los contextos te permiten cruzar el árbol por dimensión. Tus tareas de trabajo están repartidas por proyectos en distintas ramas, pero con `@trabajo` las ves todas juntas. Tus lecturas pendientes en distintas carpetas aparecen juntas con `@leer`. Sin mover nada, sin duplicar nada.

---

## 9. Nodos raíz del sistema

Siempre presentes al fondo del árbol (no se pueden eliminar):

### 📅 Agenda

El diario de From. Organiza el tiempo en una jerarquía: **Agenda → Año → Mes → Día**. Cada día tiene su propia nota, y dentro de ella encuentras:

- Las tareas con vencimiento ese día (incluidas las vencidas que siguen pendientes).
- Los eventos del día (sincronizados con Google Calendar si está conectado).
- Un área de escritura libre: notas del día, capturas rápidas, ideas.

**Ir al día de hoy:** pulsa **Hoy** en el sidebar o escribe `/hoy` en cualquier nodo.

**Navegar a otros días:** expande el árbol de la Agenda. También puedes navegar desde el Planificador haciendo clic en cualquier día del calendario.

**Cuando mueves una tarea "a hoy" o "a mañana"**, From la coloca dentro del nodo de ese día en la Agenda. En su posición original deja un espejo automático para que no pierdas la referencia.

Los nodos con tareas pendientes en su interior se muestran con un icono 📁 (contenedor vivo), indicando que hay trabajo activo dentro aunque el nodo esté colapsado.

### 🧠 Contexto

Gestiona tus contextos de trabajo y tu perfil personal para la IA.

- **Perfil**: nodo especial dentro de Contexto. La IA lo carga siempre. Escribe aquí quién eres, en qué trabajas y cualquier información que quieras que la IA tenga siempre presente.
- **Contextos**: crea aquí los @contextos que quieras. Puedes añadir dentro de cada contexto una descripción o instrucciones que la IA usará cuando trabajes en ese contexto.
- **Prompts de IA por contexto**: dentro de cualquier contexto puedes añadir prompts específicos (hijos del tipo Prompt). La IA los detecta y los usa automáticamente cuando ese contexto está activo.

### 📋 Plantillas

Guarda aquí cualquier nodo (con todos sus hijos) como plantilla reutilizable. Una plantilla puede ser una estructura de proyecto, una checklist de onboarding, el formato de reunión semanal, o cualquier cosa que repitas.

Para usar una plantilla: slash menu → `/Plantilla` en cualquier nodo. From crea una copia de la plantilla en la posición actual.

### 📌 Atajos

Contiene los atajos que has fijado. Desde aquí puedes reorganizarlos, renombrarlos o eliminarlos. También puedes hacer clic derecho en cualquier atajo del sidebar para gestionarlo directamente.

### 🤖 Agentes

Contiene los agentes de IA predefinidos y los que crees tú. Un agente es una instrucción que le das a Magic para que ejecute una tarea automáticamente.

Al abrir un nodo agente, aparece la **barra de controles**:
- **Toggle Activo/Pausado** — activa o desactiva el agente
- **▶ Ejecutar** — lanza el agente ahora. El resultado aparece como nodo en el diario de hoy

Puedes crear agentes personalizados directamente en el árbol desde el nodo raíz 🤖 Agentes.

### 🗑 Papelera

Cuando eliminas un nodo va a la Papelera (no se borra permanentemente). La **jerarquía se preserva**: si borras A y luego B (padre de A), la Papelera muestra B→A como estaban.

- **Botón derecho → Restaurar** — devuelve el nodo a su ubicación original
- **Botón derecho → Eliminar permanentemente** — lo borra definitivamente
- **Vaciar papelera** — aparece como control al abrir el nodo Papelera

### ⚙️ Ajustes

Accesible también desde el sidebar. Contiene:

- **Cuenta**: email, contraseña, plan actual, cancelar suscripción.
- **IA**: modelo de IA activo, claves API propias (plan Pro/Lifetime), configuración de agentes.
- **Predicciones**: añade palabras propias para que From las reconozca como señal de tarea o evento al escribir.
- **Integraciones**: Google Calendar, conexión MCP con Claude.
- **Datos / Backup**: historial de snapshots, crear snapshot manual, restaurar backup, exportar en JSON o Markdown.
- **Apariencia**: tema claro/oscuro/sistema, densidad (compacto/normal/espacioso), color de acento, rango horario del planificador.
- **Notificaciones**: configura qué alertas recibes y cómo.

---

## 10. Filtros inteligentes

Los filtros te permiten ver exactamente lo que necesitas en cada momento, sin reorganizar el árbol.

**Activar:** ⌘F o clic en la barra de filtro superior.

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
| `tarea` | Todos los nodos que son tareas |
| `pendiente` | Tareas pendientes (no completadas) |
| `hecho` | Tareas completadas |
| `vencido` | Tareas cuya fecha ya pasó y no están hechas |
| `evento` | Todos los eventos |
| `recurso` | Todos los recursos |
| `diario` | Nodos de tipo diario (notas de día) |
| `favorito` | Nodos marcados como favorito |
| `@contexto` | Nodos con ese contexto asignado |
| `#tag` | Nodos que contienen ese tag en el texto |
| `[[nombre]]` | Nodos que referencian ese nodo por nombre (wiki-link) |
| `node:ID` | Nodo concreto y todos sus descendientes o referencias |

Los filtros son combinables. Escribe varios seguidos separados por espacio, o usa `y` (AND) y `o` (OR) en lenguaje natural:

- `hoy pendiente` → tareas pendientes con fecha de hoy.
- `@trabajo pendiente` → tareas pendientes del contexto trabajo.
- `hoy pendiente @trabajo` → tareas pendientes de hoy en el contexto trabajo.
- `vencido @personal` → tareas vencidas del contexto personal.
- "tareas de hoy o mañana" → `tarea hoy o tarea mañana`.

La búsqueda ignora tildes y mayúsculas. `trabajo` encuentra también `Trabajo` y `trabájo`.

### Filtrar desde Magic Chat

Si abres Magic Chat y describes lo que quieres ver ("muéstrame las tareas vencidas", "filtra por recursos de esta semana"), Magic detecta la intención y aplica el filtro directamente sin que tengas que abrir ⌘F ni escribir operadores.

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

### Guardar un filtro como atajo

Cuando tienes un filtro útil, fíjalo en el sidebar con el botón 📌 de la barra de resultados. Aparece en tus atajos y lo tienes disponible con un clic desde cualquier vista.

---

## 11. Atajos (📌)

Los atajos son accesos directos fijos en la parte superior del sidebar. Hay dos tipos:

**Atajo de nodo**: muestra ese nodo y todos sus descendientes y referencias. Como hacer zoom en ese nodo pero accesible siempre desde el sidebar.

**Atajo de filtro**: el resultado de un filtro guardado. Por ejemplo: "mis tareas de hoy", "@trabajo pendiente", "#lectura".

### Cómo crear un atajo

**Desde un filtro activo:** con el filtro en pantalla, pulsa el icono 📌 en la barra de resultados.

**Desde un nodo:** clic derecho sobre el nodo → "Fijar como atajo". El atajo muestra ese nodo y todos sus descendientes junto con cualquier referencia al nodo desde otras partes del árbol.

### Gestionar atajos

- Los atajos tienen una vista asociada (lista/tabla/kanban/calendario) que se recuerda.
- Se sincronizan entre todos tus dispositivos.
- Para eliminar un atajo: clic derecho en el sidebar → "Eliminar". El nodo no se borra, solo el atajo.
- Para reorganizar: arrastra los atajos en el sidebar o entra al nodo 📌 Atajos del árbol.

---

## 12. Vistas inline

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

Puedes crear múltiples vistas para el mismo nodo (como las vistas de Notion). Pulsa el "+" junto a los tabs de vista para añadir una nueva. Cada vista guarda su tipo, configuración y nombre de forma independiente. Puedes renombrar, duplicar y eliminar vistas.

---

## 13. IA integrada — Magic

### Magic Chat — asistente de voz y texto

Magic es el asistente de IA de From. No es un chatbot genérico: conoce tu árbol, tus tareas, tus contextos y tu perfil personal.

**Abrir Magic:**
- **Espacio** (sin input activo) — abre Magic para escribir
- **Mantén R** — abre Magic y empieza a grabar inmediatamente. Suelta R para transcribir y enviar
- **⌘J** — atajo alternativo
- **Botón ✨** (esquina inferior derecha)

**Grabar con voz:** mantén R mientras hablas. Al soltar, Magic transcribe tu voz y lo envía como mensaje. El waveform animado muestra que está escuchando.

**Lo que crea Magic queda en tu árbol:** cada conversación genera un nodo `✦ Título` en el diario de hoy. Dentro: transcripción completa + nodos creados (tareas, notas, eventos). Si reanudan la conversación, se añade al mismo nodo sin perder lo anterior.

**Qué puede hacer:**
- Crear tareas, notas y eventos en tu árbol
- Resumir el contenido de cualquier nodo
- Buscar información en tus notas
- Organizar, reescribir, priorizar
- Ejecutar acciones en masa

### Enseñar a Magic — aprendizaje continuo

Magic aprende de tus correcciones y se adapta a ti progresivamente. El objetivo: que From entienda quién eres y qué necesitas sin que tengas que explicarlo cada vez.

**Cómo enseñar:** botón derecho en cualquier nodo → **Enseñar a Magic**. Opciones según el nodo:
- "Esto no es una tarea / evento"
- "Debería ser una tarea / evento"
- "El contexto no es correcto"
- "Esta interpretación es correcta ✓"
- Campo libre: "Magic, recuerda que..."

**Ver lo aprendido:** Ajustes → Magic → sección "Lo que Magic ha aprendido de ti". Edita o borra cualquier elemento individualmente.

### Chat IA (versión texto)

**Abrir el chat:** ⌘J o Espacio.

**Qué puede hacer:**

- Resumir el contenido del nodo actual y sus hijos.
- Crear tareas, notas o eventos directamente en tu árbol (te pide confirmación antes de escribir).
- Buscar en tus notas ("¿qué decidimos sobre el cliente X?").
- Redactar texto con el contexto de lo que estás haciendo.
- Responder preguntas usando tus propias notas como fuente.
- Ejecutar acciones en masa ("marca como hecho todo lo de hoy").

**Chips de acceso rápido:** al abrir el chat, aparecen chips de acciones sugeridas según el nodo que tienes abierto (Resumir, Priorizar, Organizar, Continuar escribiendo...). Haz clic para lanzar esa acción directamente.

**Quick reply chips:** la IA puede sugerirte opciones de respuesta rápida en forma de chips. Haz clic en uno para enviarlo como tu próximo mensaje.

**Contexto automático:** no tienes que explicarle en qué estás. La IA carga automáticamente:
- El nodo abierto con su título, body e hijos.
- El diario de hoy con tus tareas y eventos.
- Tus tareas pendientes (vencidas, hoy, próximas, sin fecha).
- Los contextos (@) activos con sus instrucciones.
- Tu perfil desde 🧠 Contexto.

### IA Inline (✨)

Dentro de cualquier nodo puedes pedir ayuda a la IA sin salir del editor.

**Cómo activar:**

- Pulsa Espacio al principio de un nodo con bullet/lista para que aparezca el campo de prompt inline.
- Usa `/Resumir` para resumir el contenido del nodo y sus hijos.
- Usa `/Encontrar tareas` para que la IA lea el texto y extraiga las tareas, creándolas como hijos.

La respuesta se inserta como hijos del nodo, con streaming en tiempo real. El resultado es editable inmediatamente.

### Ghost text — predicciones mientras escribes

Mientras escribes en cualquier nodo, From muestra sugerencias en gris claro (ghost text):

- Si detecta un **verbo de acción** o una expresión que suena a tarea → sugiere convertir el nodo en tarea. Pulsa `Tab` para aceptar.
- Si detecta una **fecha en lenguaje natural** (`mañana`, `el lunes`, `15 junio`) → sugiere esa fecha como vencimiento. Pulsa `Tab` para aceptar.
- Si el texto parece un **evento** (hora, reunión, llamada) → sugiere tipo evento.

Personaliza qué palabras activan estas sugerencias en **Ajustes → Predicciones**. Puedes añadir tus propios términos clave.

### Códigos de variables en prompts

Dentro de cualquier agente o prompt puedes usar variables que From resuelve antes de enviar a la IA:

| Código | Se reemplaza por |
|---|---|
| `{{fecha}}` | Fecha actual completa |
| `{{fecha_corta}}` | Fecha en formato corto (27/05/2026) |
| `{{dia}}` | Nombre del día (miércoles) |
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

## 14. El Planificador

El Planificador es la vista de calendario de From. Accede desde el sidebar (icono de calendario), desde la barra lateral, o pulsa `P` (sin ningún input activo) para abrirlo y cerrarlo al instante.

- Vista **mensual** por defecto, con las tareas y eventos del mes distribuidos en sus días.
- Las tareas con fecha aparecen en el día correspondiente.
- Los eventos de Google Calendar aparecen con su color de calendario.
- Haz clic en cualquier **día** para ir a ese día en la Agenda.
- Haz clic en un **evento** para editarlo: cambiar título, hora, o eliminarlo. Pulsa Enter en los campos de hora o fecha para guardar sin necesidad de hacer clic.
- El rango de horas del planificador se configura en Ajustes → Apariencia → Calendario y Timeline (por defecto 7:00-23:00).

### Mover y redimensionar eventos de Google Calendar

Si tienes Google Calendar conectado, puedes gestionar los eventos directamente en el planificador sin salir de From:

- **Arrastra un evento** a otra hora o día: el evento se mueve visualmente al instante y se sincroniza con Google Calendar en segundo plano.
- **Redimensiona la duración**: arrastra el borde inferior del evento para alargar o acortar su duración.
- Si la operación falla (sin conexión, error de la API), el evento vuelve automáticamente a su posición original.

---

## 15. Google Calendar

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

## 16. Mover nodos

Hay varias formas de mover un nodo a otro lugar:

**Drag & drop:** arrastra desde el handle `⋮⋮` (visible al pasar el cursor) y suelta en el destino.

**Slash menu:**

- `/Mover a hoy` → mueve al nodo del día de hoy en la Agenda.
- `/Mover a mañana` → mueve al nodo de mañana.
- `/Mover a próxima semana` → mueve al primer día de la semana siguiente.
- `/Mover a fecha…` → escribe cualquier fecha en lenguaje natural.

**Clic derecho → "Mover a..."** → abre un buscador para elegir el destino.

**Atajos de teclado:**

- `⌘↑` / `⌘↓` → mueve el nodo arriba o abajo entre sus hermanos.

Al mover un nodo a otro día, el nodo se traslada físicamente al destino y el sistema crea espejos automáticamente para que no pierdas el rastro:

- En el **origen** queda un espejo del nodo movido, con una referencia visual al día destino ("→ 30 mayo").
- En el **destino** se crean espejos del padre y de los nodos hermanos del contexto original, para que el nodo llegue con su contexto preservado.
- Los espejos muestran el mismo icono que el nodo original (checkbox si es tarea, icono de evento si es evento) con opacidad reducida para distinguirlos.

---

## 17. Backup y privacidad

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

## 18. Atajos de teclado

| Acción | Atajo |
|---|---|
| Nuevo nodo hermano | `Enter` |
| Indentar nodo | `Tab` |
| Desindentar nodo | `Shift+Tab` |
| Mover nodo arriba entre hermanos | `⌘↑` |
| Mover nodo abajo entre hermanos | `⌘↓` |
| Colapsar/expandir nodo | Clic en ▶ |
| Filtro inteligente inline | `⌘F` |
| Abrir/cerrar planificador | `P` |
| Chat IA | `⌘J` |
| Slash menu | `/` |
| Paleta de comandos (búsqueda global) | `⌘K` |
| Toggle nodo ↔ tarea | `⌘Enter` |
| Negrita | `⌘B` |
| Cursiva | `⌘I` |
| Deshacer | `⌘Z` |
| Rehacer | `⌘⇧Z` |
| Aceptar sugerencia ghost text | `Tab` |
| Descartar sugerencia ghost text | `Esc` |
| Cerrar filtro / volver | `Esc` |

---

## 19. Ajustes

### Cuenta

- Email y contraseña.
- Plan actual y fechas de renovación.
- Cancelar suscripción (el acceso se mantiene hasta el final del periodo pagado).
- Historial de tokens de IA consumidos.

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

## 20. Conexión con Claude (MCP)

From tiene integración nativa con Claude Desktop y Claude Code. Una vez conectado, Claude puede leer y escribir en tu árbol de From directamente desde el chat.

### Cómo conectar

1. Ve a **Ajustes → Integraciones → Claude (MCP)**.
2. Pulsa "Generar token de API". El token dura 1 año.
3. Sigue las instrucciones que aparecen en pantalla para añadir el MCP a tu configuración de Claude.
4. Reinicia Claude. Las herramientas de From aparecen automáticamente.

### Qué puede hacer Claude con tu From

- **Crear notas y tareas**: Claude puede añadir nodos directamente a tu árbol.
- **Editar nodos existentes**: actualizar contenido, cambiar estado de tareas.
- **Buscar en tu árbol**: "¿qué tengo apuntado sobre el proyecto X?" → Claude busca en tus notas y responde con contexto real.
- **Listar tareas pendientes**: ver todas tus tareas por estado, fecha o contexto.

**Ejemplo de uso:**

```
"Claude, crea en From un resumen de esta conversación"
"¿Qué tareas tengo pendientes para hoy?"
"Añade a From una tarea para llamar a Adrián mañana a las 10"
"Busca en mis notas todo lo relacionado con La Isla"
```

---

## 21. Planes y precios

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | €0 | Hasta 1.000 nodos sync, sin IA, sin archivos |
| **Pro Mensual** | €7/mes | Nodos ilimitados, IA completa, archivos adjuntos, notas públicas |
| **Pro Anual** | €49/año (€4,08/mes) | Todo lo de Pro Mensual, facturado anualmente |
| **Lifetime** | €149 pago único | Todo lo de Pro para siempre + 3M tokens de IA incluidos |

Gestiona tu suscripción en **Ajustes → Cuenta → Suscripción** o en [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing).

Si tienes código de beta o cupón, introdúcelo en el checkout al comprar.

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

---

*getfrom.app — Tu segundo cerebro. En todos tus dispositivos.*
