# Fromly — Manual de usuario v9.6.424

> Web · Mac · iPhone · fromly.app

---

## 1. ¿Qué es Fromly?

Fromly es tu segundo cerebro. Una app de notas, tareas y gestión de conocimiento personal que organiza todo lo que piensas, haces y quieres recordar en un único árbol jerarquizado, disponible en cualquier dispositivo y con IA integrada que realmente conoce tu información.

Existe para la persona que tiene demasiadas cosas en la cabeza, demasiadas apps para gestionarlas y no quiere invertir horas configurando sistemas complejos. En Fromly, capturas, organizas y actúas desde un solo lugar.

---

## 2. Primeros pasos

### Crear cuenta

Ve a [fromly.app](https://fromly.app) y pulsa **Crear cuenta**. Puedes registrarte con:

- Email y contraseña
- Cuenta de Google
- Apple ID

Con la misma cuenta accedes desde el navegador, Mac e iPhone. Todo sincroniza **en tiempo real**: empieza una idea en el móvil y aparece al instante en el ordenador. La sincronización registra cada cambio como una operación, así que nunca pierde ni borra nada por error — incluido lo que crees desde Claude o tus agentes, que también aparece al momento.

### Acceder desde el navegador

Ve a [fromly.app/app](https://fromly.app/app) desde cualquier navegador moderno. No necesitas instalar nada.

También puedes instalarlo como app de escritorio ligera: en Chrome o Edge pulsa el icono de instalación en la barra de dirección. En Safari iOS: Compartir → "Añadir a pantalla de inicio".

### Instalar en Mac

1. Ve a [fromly.app](https://fromly.app) y descarga el archivo `From.dmg`.
2. Abre el DMG y arrastra el icono de Fromly a la carpeta **Aplicaciones**.
3. Abre Fromly desde el Launchpad o desde la carpeta Aplicaciones.
4. Si macOS advierte que no puede comprobar el desarrollador, ve a **Ajustes del sistema → Privacidad y seguridad** y pulsa "Abrir igualmente".
5. Inicia sesión con tu cuenta.

**Actualizaciones automáticas:** cuando haya una nueva versión disponible, aparecerá `✦ Nueva versión — Actualizar` en la barra inferior de Fromly. Un clic instala la actualización sin salir de la app. No hace falta descargar nada manualmente.

### Instalar en iPhone

Busca **Fromly — Notas y PKM** en el App Store o accede desde [fromly.app/ios](https://fromly.app/ios). Instala la app e inicia sesión con la misma cuenta. Tus notas aparecen en segundos.

### El primer arranque: qué ves

Cuando entras en Fromly por primera vez encuentras:

- **El árbol principal** en el centro: tu espacio de trabajo. Muestra directamente la **Agenda** — los años (2026, 2027...) desde donde navegas a meses, días y notas.
- **El sidebar izquierdo**: tus paneles guardados y la lista de contextos.
- **La barra superior**: breadcrumb de navegación y controles de vista y panel derecho.
- **El panel derecho**: se abre con Magic (IA), Filtro, Planificador o el contenido de un Contexto seleccionado.

Para empezar: pulsa **«Ir a hoy»** (o `⌘D`) para entrar directamente en el lienzo del día de hoy.

**Cada día es su propio lienzo.** Al entrar en un día tienes una pizarra en blanco donde escribes y dibujas: todo lo que pongas ahí es contenido de ese día. El día abre **siempre al mismo zoom (100%)**, así los textos y dibujos de todos los días guardan la misma escala y se pueden comparar. La **columna del día** (eventos, tareas, seguimiento) sigue a la derecha.

En la **barra superior** tienes dos botones siempre visibles, en el mismo sitio:
- **🌍 Lienzo** — el **lienzo de contextos** (el plano infinito de ideas). Aparece resaltado cuando ya estás en él, y te devuelve a él desde cualquier sitio.
- **📆 Hoy** — entra en el lienzo del **día de hoy**.

Para **viajar entre días**, dentro de un día tienes arriba de la columna diaria un **timeline horizontal**: desplázalo para ir a días anteriores o posteriores y pulsa uno para entrar en él (el día actual va resaltado). El **icono de calendario** del timeline **despliega hacia abajo** un mes completo (con navegación de mes «‹ ›» y de año «« »»); pulsa cualquier día y entras en él, y el calendario se colapsa solo. Así navegas por los días como lo que son —un lienzo por día—, sin salir a una página de calendario aparte.

---

## 3. El árbol — cómo funciona Fromly

Todo en Fromly vive en un único árbol. No hay carpetas, no hay archivos: cada nota, tarea, evento o recurso es un **nodo** que puede contener otros nodos hijos.

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
- **Fecha de vencimiento**: asígnala escribiendo en el campo de fecha con lenguaje natural. Fromly detecta automáticamente expresiones como:
  - `hoy`, `mañana`, `pasado mañana`
  - `el lunes`, `el próximo viernes`
  - `en 3 días`, `en 2 semanas`
  - `15 junio`, `15/06`
  - Mientras escribes, aparece texto en gris (ghost text) con la fecha interpretada. Pulsa `Tab` para aceptarla.
- **Prioridad**: alta, media o baja. Aparece como badge junto al texto.
- **Repetición**: diaria, semanal, mensual o personalizada (cada N días/semanas/meses/años).

**Marcar como hecha:** haz clic en el checkbox. Para desmarcarla, vuelve a hacer clic.

**Ampliar una tarea:** cuando descubres que una tarea es más grande de lo que pensabas y necesita sub-tareas o notas, usa `/Ampliar` desde el slash menu. La tarea se convierte en un contenedor que puede tener hijos.

### Propiedades personalizadas

Además de Estado, Fecha y Prioridad, **cualquier nodo puede tener propiedades a tu medida**: texto, número, lista (select), casilla, fecha, enlace o etiqueta. Son las mismas en dos sitios:

- **En la tabla de un contenedor**, cada propiedad es una **columna**. Con el botón **＋** de la cabecera añades una; mantén pulsada (o haz clic en) la cabecera para renombrarla, cambiar su tipo u ordenarla.
- **En el detalle de un nodo** (sección «Propiedades»), ves y editas los valores de ese nodo y, con **＋**, añades una propiedad que aparecerá también como columna en la tabla del contenedor — y al revés.

En iPhone y iPad funciona igual: abre un nodo y verás su sección «Propiedades» bajo el título; las listas (select) muestran su etiqueta con un punto de color.

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

**Editar un evento (iPhone y iPad).** En el detalle de un nodo-evento (o con «Convertir en evento» desde su menú) puedes ajustar la **hora de inicio y fin** y el **lugar**. Si tienes Google Calendar conectado, al guardar se **crea o actualiza** allí, y «Eliminar evento» lo borra también de Google Calendar.

### Tarea de seguimiento (tarea sin fecha)

No hay un tipo aparte para «lo que tienes en curso»: es simplemente una **tarea sin fecha**. Una tarea con fecha cae en su día; una tarea **sin fecha** es de **seguimiento** y permanece visible en la sección **«Seguimiento»** del panel del día hasta que la marcas hecha o la borras. Checkbox normal, sin decidir tipos.

- **Crear:** una tarea a la que no le pones fecha. Ya está en seguimiento.
- **Cerrar:** márcala hecha (su checkbox). Para volver a tenerla en seguimiento, ponle o quítale la fecha desde su menú de triaje.
- La sección «Seguimiento» del día arranca **colapsada con un contador** (suele haber muchas tareas sin fecha); despliégala cuando quieras.

> Nota: la idea anterior de «bucles» se sustituyó por esto. Tus bucles antiguos se convierten solos en tareas de seguimiento.

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

Un recurso es un enlace a contenido externo: un artículo, un vídeo de YouTube, un podcast, una página web. Fromly extrae automáticamente el título y el tipo de contenido al pegarlo.

**Cómo crear un recurso:**

- Slash menu → `/Recurso`.
- **Pega una URL en un nodo vacío**: Fromly la detecta automáticamente, hace unfurl (obtiene el título real de la página), y el nodo queda con el título de la web y el icono de enlace 🔗 en el bullet. La URL se preserva en los metadatos aunque cambies el título del nodo.

**Comportamiento del nodo de enlace:**

- El bullet cambia a un **icono de cadena** 🔗 (en lugar del punto normal).
- **Clic en el bullet** → navega a la nota del nodo en Fromly.
- El botón **↗** inline (al lado del texto) → abre la URL en el navegador externo.
- Al editar el texto del nodo, la URL se preserva aunque cambies el título.

**Propiedades de un recurso (panel derecho):**

- URL del enlace.
- Estado: Pendiente / Futuro / Hecho (para marcar si lo has consumido o no).
- Tipo detectado automáticamente (artículo, vídeo YouTube, podcast...).

Los recursos aparecen en el bloque de recursos de la Agenda diaria para que recuerdes lo que tienes pendiente de revisar.

### PDF

Arrastra cualquier archivo PDF desde tu ordenador a un nodo en Fromly. El PDF se sube a la nube y queda disponible en todos tus dispositivos.

**Cómo adjuntar un PDF:**

- Arrastra el archivo `.pdf` desde el Finder directamente a cualquier nodo. Se crea automáticamente un nodo hijo con el nombre del archivo y el badge **PDF** (rojo).

**El PDF se abre EN el lienzo:**

Al abrir un nodo PDF, el documento aparece **sobre la pizarra**, a tamaño completo y **nítido al ampliar**. Encima puedes usar todas las herramientas del lienzo —lápiz, formas, flechas, texto— para marcarlo, igual que con cualquier otro contenido del lienzo. Las marcas son trazos del lienzo y se guardan solas.

En el iPad, además, los PDF que ancles en un lienzo muestran su **primera página** en la tarjeta (no un icono), con el badge **PDF** (rojo).

### Pizarra

La Pizarra es un lienzo infinito de dibujo, escritura y organización dentro de un nodo. Es el mismo lienzo que en el iPad: lo que pintas o escribes se sincroniza entre la web y la tablet.

**Cómo crear una pizarra:**

- Slash menu → `/Pizarra`.
- Escribe `pizarra` o `whiteboard` en cualquier parte del texto de un nodo: aparece un ghost text de confirmación. Pulsa `Enter` para confirmar.

**Herramientas (barra superior):**

- **Lápiz, rotulador y subrayador** — con paleta de colores y 6 grosores. El subrayador es semitransparente.
- **Formas** — línea, flecha, rectángulo y elipse, dibujadas arrastrando de un punto a otro.
- **Texto** — escribe libremente encima del lienzo, sin caja ni marco. La barra de formato (negrita, encabezados, listas, colores…) aparece justo encima del texto al escribir.
- **Tarea** — escribe en lenguaje natural («Llamar a Marina mañana», «Repasar cada lunes») y se crea una tarea con su fecha y recurrencia; aparece en la columna del día.
- **Tabla, Kanban, Calendario** — añade uno de estos elementos al lienzo (ver abajo).
- **Flecha** — conecta dos elementos (ver «Conectar elementos»).
- **Borrador** — borra trazos y formas.
- **Seleccionar** — clic en un elemento para seleccionarlo, o arrastra un marco (⌘/Ctrl + arrastrar) para varios. Con la selección hecha: clic derecho para **duplicar / eliminar / agrupar**, o pulsa **Retroceso** para borrar. Con cualquier herramienta activa, el **clic derecho** vuelve a «seleccionar».

**Elementos del lienzo (la misma pieza dentro y fuera).** Texto, tablas, kanban y calendarios son **elementos** del lienzo. Cada uno:
- Se mueve, se redimensiona (tirador de ancho a la derecha, escala en la esquina) y se borra como cualquier pieza.
- Se **abre en su propia página** con un clic en su **punto** (a la izquierda del texto, o en la cabecera de tabla/kanban/calendario). Es exactamente la misma pieza: lo que cambies dentro del lienzo o a pantalla completa es lo mismo.

**Tablas.** Crea una tabla vacía y empieza a escribir en las celdas. Muévete como en una hoja de cálculo: **Enter** baja, **Tab** va a la derecha, **Mayús+Tab** a la izquierda. Arrastra el **borde de una columna** para ajustar su ancho. Con el botón **+** de la cabecera añades propiedades (estado, fecha, prioridad, select, checkbox, tags…).

**Calendario.** Cambia entre **Mes**, **Semana** y **Timeline** (línea de tiempo de todo lo que tiene fecha) con el selector de arriba a la derecha.

**Documentos.** Un texto del lienzo es un **documento** de verdad (editor rico). Al editarlo —en el lienzo o a pantalla completa— la **columna derecha se convierte en su panel de formato** (estilo de párrafo, fuente, color, listas, enlace, imagen). Su **punto** (siempre visible, a la izquierda del título) lo abre en su página. También puedes crear uno directo con `/documento`, y pegar prosa larga en una nota vacía la convierte en documento.

**Soltar y pegar entidades.** Arrastra (o pega) un **PDF, una imagen o un enlace** sobre el lienzo y queda anclado donde lo soltaste, como una tarjeta que abres en su página. Pega una imagen del portapapeles o una URL y aparece en el sitio.

**Dibujar por encima.** El **lápiz, las formas y el borrador** funcionan sobre las tarjetas (tablas, documentos, imágenes): puedes anotar, tachar o rodear cualquier elemento, como en una pizarra de verdad.

**Conectar elementos.** Con la herramienta **Flecha**: haz **clic en un elemento** (ancla el inicio) y **clic en otro** (lo conecta). La flecha empieza y termina en el **borde** de cada tarjeta y **sigue a los elementos** cuando los mueves. Pasa el ratón por encima de la flecha y arrastra su **punto central** para curvarla; clic derecho sobre ella la elimina.

**Atajos de teclado** (una letra por herramienta): **V** seleccionar · **B** lápiz · **M** rotulador · **H** subrayador · **E** borrador · **T** texto · **A** flecha · **L** línea · **R** rectángulo · **O** elipse. **⌫** borra lo seleccionado.

**Nodos y notas en el lienzo.** Arrastra cualquier nodo (tarea, nota, captura) al lienzo: se muestra como una tarjeta. Clic derecho abre el menú (duplicar, eliminar, favorito).

**Áreas (regiones del lienzo).** El botón de **marcador** de la barra guarda la zona visible como un **área**: una región con nombre que aparece como un **marco** en el lienzo y en el panel del día bajo **Áreas**. Un clic en su etiqueta vuela a esa zona. Las áreas se comportan como cualquier otro nodo:
- **Son contenedores**: las tarjetas que quedan dentro del marco pasan a ser **hijas** del área (al crearla sobre una zona con tarjetas, se recogen solas).
- **Favorito ★ y renombrar**: márcala como favorita o cámbiale el nombre con **doble clic** en la lista de Áreas. La lista se **agrupa por contexto** (con su color).
- **Mover el área entera**: arrastra la **etiqueta** del marco y se mueve la región con **todas sus tarjetas** dentro.
- **Entrar/salir**: arrastra una tarjeta **dentro** del marco y pasa a pertenecerle; sácala y vuelve a la nota.
- **Borrado seguro**: al eliminar un área, sus tarjetas **vuelven a la nota** (no se borran con ella).

Todo se guarda automáticamente.

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

### Log 🕐

Un log es un nodo con la **fecha y hora delante del texto**, en un chip discreto (p.ej. `10 jun 08:55`). Es para registros: avances de un proyecto, seguimientos de clientes, un diario de hechos con marca temporal.

**Cómo crear un log:**

- Slash menu → `/Log`.
- Termina el texto con `-l` y pulsa Enter.

La fecha/hora se estampa en el momento de crearlo y queda fijada en el chip (no se borra al editar el texto).

### Captura 🎬

Una **captura** es lo que guardas al **compartir un enlace o texto a Fromly** desde otra app (ver «Compartir a Fromly» más abajo). Tiene su propio icono y es **filtrable**: en la columna de filtros tienes **«Capturas»** para verlas todas. Una captura de un vídeo (TikTok, YouTube, Reel…) incluye el enlace clicable, el autor, una breve descripción y la **transcripción** del audio bajo un encabezado «Transcripción».

---

## Compartir a Fromly (iPhone)

Cuando ves un vídeo en redes y quieres quedarte con **lo que dice, no con el vídeo**: pulsa **Compartir → Fromly**.

- Se guarda una **captura** en tu diario de hoy con el enlace, el autor, un título y resumen automáticos (en el idioma del vídeo) y la **transcripción** completa.
- Ocurre **en segundo plano**: la nota aparece al instante y la transcripción se rellena sola en unos segundos. No tienes que esperar.
- Funciona con **TikTok, YouTube, Instagram, X y muchos más**. Si compartes un enlace normal o un texto, se guarda tal cual (sin transcribir).
- **La primera vez**, activa Fromly en la hoja de compartir: desliza la fila de apps hasta el final → **Más / Editar** → activa **Fromly**.
- La transcripción usa tus **tokens de IA** (plan Pro, Lifetime o prueba).

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
| Log | Entrada con fecha y hora delante (registro) |

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

Empieza a escribir y Fromly busca en tiempo real:

- **Nombre de una nota** → navega directamente al nodo
- **Nombre de un contexto** (ej. "trabajo") → abre el filtro de ese contexto + panel lateral
- **"contextos"** → muestra todos los contextos para seleccionar con ↑↓ y Enter
- **"filtros"** → muestra todos los filtros guardados
- **"hoy" / "mañana"** → acceso rápido a esos días
- **Texto libre** → si no hay coincidencias, aparece "Crear: [tu texto]" para crear un nodo nuevo

La búsqueda ignora tildes y mayúsculas. Todo lo que escribes en el lienzo (textos y documentos) es buscable, porque son nodos.

**Filtrar por tipo.** En el panel de búsqueda tienes chips para acotar por tipo: **Nota · Tarea · Evento · Documento · PDF · Imagen · Enlace · Archivo** (además de estado, fecha y contextos). Útil para encontrar, por ejemplo, todos tus PDFs o todas las imágenes.

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

**Cada nodo tiene UN contexto.** Tienes varias formas de asignarlo, todas equivalentes:
- **`#` en el título** de un nodo: escribe y aparece un selector; `Tab`/`Enter` lo asigna (o crea uno nuevo si no existe).
- **Chip de contexto** en la columna derecha y en las filas de la columna de hoy: si el nodo no tiene contexto verás un **«?»**; al pulsarlo se abre el selector (con buscador, dots de color y agrupado por contexto padre). Si ya tiene, el chip muestra su nombre y al pulsarlo puedes cambiarlo o quitarlo.
- **Clic derecho** sobre una fila → «Añadir/Cambiar contexto» (mismo selector) y «Quitar contexto».
- En la **captura rápida** (Espacio): escribe el nombre del contexto y Fromly lo sugiere como ghost text; al aceptarlo, la palabra se quita del texto y queda asignado.

Asignar un contexto a una tarea **no la mueve**: sigue en tu agenda y, a la vez, «entra» en ese contexto.

### Crear y gestionar contextos

**Desde el sidebar**: pulsa `+` en la sección CONTEXTOS. Escribe el nombre y pulsa Enter. El nuevo contexto aparece en la lista y se abre en el panel derecho listo para añadir contenido.

**Desde el propio contexto (panel derecho)**: al seleccionar un contexto, se abre como outliner editable en la columna derecha. Añade hijos para describir el contexto, guardar instrucciones para la IA o crear sub-secciones.

Los contextos son nodos raíz especiales con `_tagDefinition` internamente. No son carpetas del sistema: son nodos normales del árbol a los que Fromly asigna función de etiqueta.

### Proyectos: contextos que se abren y se cierran

Dentro de un contexto grande (un «área» como Media Sector) puedes crear **proyectos** — subcontextos pequeños que empiezan y terminan. Son contextos normales, solo que **se abren y se cierran**.

**Crear y asignar con `#`.** Escribe `#nombre` en cualquier nodo o en la captura rápida:
- Si no existe, Fromly lo crea. Si escribes `#nombre` solo (sin más texto), te lleva directo al nuevo contexto.
- Mientras tecleas el nombre (aunque no pongas `#`), aparece como sugerencia (ghost text). Pulsa `Enter` o `Tab` para asignarlo.
- Al asignar un proyecto a una tarea, la tarea no se mueve: sigue en tu agenda y, a la vez, «entra» en el proyecto.

**La página de un proyecto.** El centro es un lienzo limpio para tus notas, logs, tablas, PDFs e imágenes. En la columna derecha:
- **Estado**: botón **Cerrar / Reabrir** (solo en proyectos; las áreas raíz están siempre activas). Un proyecto cerrado desaparece de las sugerencias pero conserva todo.
- **Contexto padre**: elige un contexto y este proyecto pasa a ser su subcontexto.
- **Contiene**: todo lo que tiene asignado, con un clic para abrirlo y una `×` para quitarlo.

**Chips de contexto.** En cualquier nodo, haz **clic** en un chip de contexto para abrirlo, o pulsa la **×** para quitarlo de ese nodo.

**En la columna de hoy** todo lo accionable vive en el bloque **«Para hacer»**: las tareas de hoy y atrasadas se agrupan **bajo su contexto** (cada uno con un dot de su color), y las que no tienen contexto van al final, bajo **«Sin contexto»**. El bloque **Seguimiento** (tareas sin fecha) queda debajo, colapsado.

### Filtrar por contexto desde el sidebar

Haz clic en cualquier contexto del sidebar. El árbol central se filtra mostrando todos los nodos con ese contexto asignado, y el panel derecho muestra el contenido del contexto.

Pulsa **Escape** para desactivar el filtro y volver a la agenda.

### Filtrar por @contexto en el campo de filtro

En la barra de filtros (`⌘F`), escribe `@trabajo` (o el nombre de tu contexto) para ver todos los nodos con ese contexto asignado. En iOS, los chips morados de contexto en la pestaña Explorar hacen lo mismo con un toque.

### El Perfil de IA

Dentro del contexto **Perfil IA** puedes escribir información personal que la IA carga siempre: quién eres, en qué trabajas, tus proyectos activos, preferencias de comunicación. La IA lo usa automáticamente en todas las conversaciones sin que tengas que repetírselo.

### Auto-clasificación con IA

Fromly clasifica automáticamente el contexto más apropiado de cada nota o tarea y **se lo asigna** (cuando hay confianza suficiente) en el sistema único de contexto. No hay que confirmar ningún badge: aparece directamente en su chip, y tú lo cambias o lo quitas si no acierta.

**Filtro "Sin clasificar":** en la lista de contextos aparece una entrada especial **"Sin clasificar"** con el número de nodos sin contexto. Al hacer clic, el árbol se filtra para mostrar solo esos nodos; cada uno trae el chip **«?»** para asignarle contexto a mano.

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

### La nota diaria es tu centro de mando

Al abrir Fromly aterrizas directamente en la **nota del día de hoy** (no en la raíz del árbol): es el sitio desde el que trabajas. Si navegas a otro nodo y pulsas **Escape**, vuelves a la nota de hoy. El botón de inicio sigue llevándote a la raíz del árbol cuando quieras la vista estructural.

### «Tu día» — la foto de tu jornada

Al inicio de la nota de hoy aparece el bloque **«Tu día»**, que reúne de un vistazo todo lo que requiere tu atención. Se puede colapsar y, si no hay nada, no se muestra. Todo lo que ves son enlaces a tus notas reales: marcar una tarea ahí mismo actúa sobre el nodo original. Clic en el texto te lleva a la nota.

- **Para hacer** — lo accionable, agrupado **bajo su contexto** (cada uno con un dot de su color). Aquí viven las atrasadas (con su día en rojo) y las de hoy; las que no tienen contexto van al final, bajo **«Sin contexto»**.
- **Seguimiento** — tus tareas **sin fecha** (lo que tienes en curso); arranca colapsado con un contador.
- **Por planificar** — tareas sin fecha que hay que agendar, colapsado por defecto.

**Despachar conscientemente:** pasa el ratón sobre una tarea → **⏭ Posponer** (*Mañana · +1 semana · Sin fecha*) o, si no tiene fecha, **Hoy** para programarla hoy.

**Completar:** al marcar una tarea, el check se pone **verde**, queda tachada y baja con una animación al final de su grupo — sigue visible hasta mañana, no desaparece de golpe.

**Llevar al planificador:** arrastra cualquier fila de «Tu día» al planificador de la derecha para darle hora. La tarea sigue en tu lista y gana un chip con la hora.

### La Agenda — vista principal

La vista de inicio de Fromly ES la Agenda. Al abrir la app ves directamente los años (2026, 2027...). Navegar es tan sencillo como expandir el año → mes → día.

La Agenda organiza el tiempo en la jerarquía: **Año → Mes → Día**. Cada día tiene su propia nota con:

- Las tareas con vencimiento ese día (incluidas las vencidas que siguen pendientes).
- Los eventos del día (sincronizados con Google Calendar si está conectado).
- Un área de escritura libre para notas del día, capturas e ideas.

**Ir al día de hoy:** pulsa `H` o el icono de calendario en la barra superior.

**Navegar a otro día:** expande el árbol de años/meses/días. También puedes navegar desde el Planificador (tecla `P`) haciendo clic en cualquier día en la Vista Año.

**Mover tareas a otro día:** slash menu → `/Mover a hoy`, `/Mover a mañana` o `/Mover a fecha...`. Fromly coloca el nodo en el día destino y deja un espejo en el origen.

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

Puedes escribir directamente en lenguaje natural y Fromly traduce tu consulta a los operadores técnicos automáticamente:

- "tareas de hoy y pasadas" → `tarea hoy o vencido`
- "recursos sin fecha" → `recurso sin-fecha`
- "todo lo de esta semana" → `semana`
- "favoritos pendientes" → `favorito pendiente`

Fromly usa IA (Haiku, gratuita para todos los usuarios) para interpretar la consulta. No consume tokens de tu plan.

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
| `bucle` | Bucles abiertos (nodos en curso sin cerrar) |
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

### El operador `bucle` — nodos en curso

El operador `bucle` filtra tus **bucles abiertos**: los nodos de tipo bucle que aún no has cerrado (ver «Bucle» en Tipos de nodo). Es ideal para ver de un vistazo todo lo que tienes en marcha sin terminar. Un bucle sale del filtro cuando lo cierras.

> Nota: no confundir con el icono 📁 de «contenedor vivo» — ese es una pista visual de cualquier nota que tiene tareas pendientes dentro, independiente del tipo bucle.

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

## 15. Magic — la inteligencia de Fromly

Magic es la capa de inteligencia de Fromly. La idea no es "tener IA": es que **Fromly te entienda**. Escribes como piensas y Fromly se encarga de lo demás — entiende qué es cada cosa, la ordena, recuerda quién eres y se anticipa. Todo en segundo plano, sin menús y sin que tengas que mantener nada. El objetivo es eliminar la fricción entre lo que piensas y lo que queda escrito, y hacerlo rápido.

Magic tiene tres caras:

1. **Te entiende mientras escribes** — clasifica, fecha y detecta el tipo de cada nota sin que toques un menú (ver más abajo y la sección 9).
2. **Te recuerda** — construye un perfil tuyo y un conocimiento por contexto a partir de lo que escribes ("Lo que Fromly sabe").
3. **Actúa por ti** — Magic Chat, grabadora, agentes programados.

### Cómo Fromly te entiende — la capa de inteligencia

**Contextos automáticos con jerarquía.** Mientras escribes, Fromly clasifica cada nota en el contexto al que pertenece (trabajo, familia, un proyecto concreto), entendiendo la **jerarquía** de contextos y subcontextos. Una nota de "La Isla" va a "Trabajo › La Isla", no a una etiqueta plana. Si hace falta un contexto que no existe, Fromly puede crear el subcontexto en el lugar correcto. El badge de contexto aparece junto al nodo con la sugerencia; un clic la confirma o la cambia. Los contextos y los nodos estructurales (Agenda/Año/Mes) nunca muestran badge.

**"Lo que Fromly sabe" por contexto.** Cada contexto acumula su propio conocimiento vivo, en tres apartados: **Palabras clave**, **Personas** y **Temas frecuentes**. Fromly lo extrae solo de las notas que clasificas ahí y lo mantiene al día: cuando añades algo nuevo, **fusiona** la información nueva con la que ya había, sin duplicar, en lugar de reescribirlo todo. La actualización es proactiva (al clasificar nodos) y vuelve a aprender si sigues editando un nodo ya clasificado. Solo guarda información nueva: si no hay nada que añadir, no toca nada. Abres un contexto y Fromly ya sabe de qué va.

**Tu perfil — Fromly te recuerda.** Fromly construye un perfil tuyo a partir de lo que escribes: tus proyectos, las personas estables de tu vida, tus objetivos y activos a largo plazo. Filtra el ruido — **solo retiene lo que perdura**, no las tareas del día ni los problemas temporales — y sintetiza en vez de copiar literal ("Me voy a casar" → "Tiene planes de matrimonio con su pareja"). El aprendizaje se guarda aunque salgas del nodo, navegues a otra página o el nodo lo cree un agente. Abre tu perfil desde **CONTEXTOS → Mi perfil**.

**Clasificar todo lo antiguo.** En el panel de contextos, bajo "Sin clasificar", el botón **"Clasificar todos"** procesa de una vez todos los nodos antiguos sin contexto, con barra de progreso y posibilidad de cancelar.

### Magic Chat — asistente de voz y texto

Magic Chat conoce tu árbol, tus tareas, tus contextos y tu perfil personal.

**Abrir Magic:**
- Icono ✦ en la barra superior derecha
- Tecla `M` (sin ningún input activo)

Escribe en el campo y pulsa Enter para enviar.

**Grabar con voz:** mantén `R` mientras hablas. Al soltar, transcribe y envía. El waveform animado muestra que está escuchando.

#### Grabadora de voz (botón REC)

El botón rojo **REC** (abajo a la derecha, junto al `+`) es para **dictar una nota larga**:

1. Pulsa **REC**: se abre la **grabadora en la columna derecha** y empieza a grabar. Ves la **onda** y la **transcripción en vivo**.
2. Pulsa **STOP** (o el ■ del panel) para parar. Verás la **transcripción completa** (puedes editarla) y un botón **«Crear nota»**.
3. Al pulsar **«Crear nota»** se crea una **nota en tu diario de hoy** con un **título puesto por la IA** según lo que dijiste y, dentro, la **transcripción**. Se abre **Magic** para que sigas trabajando sobre ella (resumir, sacar tareas, etc.).

La nota aparece en **«Capturas»** del día; arrástrala al lienzo cuando quieras colocarla.

**Dónde crea Magic las cosas:**
- Recordatorios y tareas genéricas → van al **diario de hoy**
- Si estás en una nota de proyecto y pides añadir algo relacionado → va a **esa nota**
- Si no es el destino correcto: botón **"Muévelo a esta nota"** o **"Muévelo a hoy"** junto a Deshacer

**Navegar directamente:** di "ver las tareas de mañana" o "ábreme la nota de proyectos" — Magic navega directamente sin texto intermedio.

### Prompts — modos de conversación para Magic

Los **Prompts** (icono ⚡ en la barra superior) son modos de conversación que tú creas y que cambian cómo te responde Magic. Un prompt es un nodo: su **contenido son sus hijos**, donde escribes las instrucciones (lo editas como cualquier nota).

**Crear y editar:** abre el panel ⚡ Prompts, pulsa "Nuevo prompt…" y escribe sus instrucciones dentro. Fromly trae dos de ejemplo: **Diario del día** y **Brainstorming**.

**Variables** (Fromly las rellena al usar el prompt): `{{fecha}}`, `{{nombre}}`, `{{contexto_actual}}`, `{{notas_hoy}}`, `{{perfil}}`. En el panel de propiedades del prompt, clic en una variable la inserta donde tengas el cursor.

**Cómo se activa en Magic (tres formas):**
- **Manual**: escribe `/` en Magic y elige el prompt; o el botón ✨ en iPhone.
- **Automático por contexto**: en las propiedades del prompt eliges "activar en la nota diaria / en tareas / en un contexto". Al abrir Magic desde ahí, se activa solo (chip con etiqueta "auto").
- **Sugerencia**: mientras escribes, si el texto encaja con un prompt, Magic lo activa solo. Siempre puedes quitarlo con la **×** del chip.

Ejemplo del prompt "Diario del día": al abrir Magic desde tu nota de hoy, Magic se vuelve tu compañero de diario — escucha, responde con calma y, si lo pides, te resume el día.

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

Mientras escribes en cualquier nodo, Fromly muestra sugerencias en gris claro (ghost text):

- Si detecta un **verbo de acción** o una expresión que suena a tarea → sugiere convertir el nodo en tarea. Pulsa `Tab` para aceptar.
- Si detecta una **fecha en lenguaje natural** (`mañana`, `el lunes`, `15 junio`) → sugiere esa fecha como vencimiento. Pulsa `Tab` para aceptar. Pulsar `Enter` después crea un nodo hermano debajo.
- Si el texto parece un **evento** (hora, reunión, llamada) → sugiere tipo evento.

Personaliza qué palabras activan estas sugerencias en **Ajustes → Predicciones**.

### Códigos de variables en prompts

Dentro de cualquier agente o prompt puedes usar variables que Fromly resuelve antes de enviar a la IA:

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

El Planificador es la vista de calendario de Fromly. Pulsa `P` (sin ningún input activo) o el icono de planificador en la barra superior para abrirlo y cerrarlo. Ocupa el panel derecho.

### Cuatro vistas: Día · Semana · Mes · Año

**Vista Día**: el día de hoy a pantalla completa (una sola columna). Timeline de horas con tus tareas y eventos con hora concreta; los bloques indican su hora de inicio y se pueden redimensionar para ajustar la duración.

**Vista Semana**: varios días en columnas (entre 2 y 7; arrastra la cabecera para ver más o menos). El mismo timeline de horas por columna. Arriba, una **franja «todo el día»** para las tareas con fecha pero sin hora: **haz clic** en el hueco de un día para escribir una tarea nueva ahí mismo y pulsa **Enter** (puedes encadenar varias seguidas).

**Vista Mes**: la cuadrícula del mes. Cada día muestra **todas** sus tareas (las filas crecen de alto si hace falta). **Clic en una tarea** te lleva **a la tarea**; clic en un evento abre su editor.

**Vista Año**: los 12 meses del año en una grid. Los días con tareas o eventos aparecen con un punto. Haz clic en cualquier día para abrir su vista Día.

> En el timeline de horas solo aparece lo que tiene **hora**. Las tareas con fecha pero sin hora viven en la **franja «todo el día»** (arriba) y en la sección «Tu día» de la nota diaria.

**Tareas vs eventos de un vistazo**: las **tareas** se muestran **sin fondo** (borde fino con un toque de color); los **eventos de Google** se muestran **con su color de fondo**.

**Navegación**: botones ‹ › para avanzar o retroceder. Botón **Hoy** para volver al día actual.

### Modelo de datos — el nodo nunca se mueve

El Planificador no mueve ni duplica tus nodos del árbol. **El nodo siempre permanece en su lugar original en el árbol.** Usar el planificador únicamente asigna o cambia la hora del nodo.

### Planificar una tarea — asignar hora

**Desde el árbol (o desde «Tu día») al timeline**: arrastra cualquier nodo hacia el timeline del planificador. Se asigna la hora del punto donde sueltas. El nodo sigue en el mismo lugar del árbol — solo ha ganado una hora programada.

**Clic en hora vacía**: crea un nuevo nodo directamente en esa hora. Escribe el título y pulsa Enter.

**Redimensionar**: arrastra el borde inferior de cualquier bloque para cambiar su duración.

**Mover un bloque**: arrastra el bloque a otra hora. La línea morada indica el inicio real del bloque al posicionarlo.

### Sincronización con Google Calendar al planificar

Si tienes Google Calendar conectado, el planificador crea y actualiza eventos automáticamente:

- **Asignar hora** a una tarea → se crea un evento en Google Calendar.
- **Mover o redimensionar** el bloque → el evento de Google Calendar se actualiza al instante.
- **Quitar la hora** (clic derecho → "Quitar hora") → el evento de Google Calendar se elimina.

**Los eventos de Google viven solo en Google** (no se copian como notas en Fromly). Se muestran en el planificador y en la columna del día con su color original. Al hacer **clic** en uno se abre el **editor del evento de Google** (título, fechas, eliminar) con un botón **«➕ Crear nodo en Fromly»** — solo se crea una nota si lo pulsas.

### Clic derecho sobre un bloque

- **Ir al nodo** — navega al nodo en el árbol.
- **Quitar hora** — elimina la hora pero mantiene la fecha. El nodo sale del timeline y vuelve a la lista de la nota diaria.
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
- Crear un evento en Fromly lo crea también en Google Calendar.
- Editar o eliminar un evento funciona en ambas direcciones: lo que cambias en Fromly se refleja en Google Calendar, y viceversa.
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

## 19. Fromly para iPhone

La app de iPhone está disponible en el App Store. Organiza en cinco pestañas accesibles desde la barra inferior:

### Pestaña 1 — Explorar

Vista de filtrado rápido por chips multiselect. Selecciona combinaciones de chips para ver exactamente lo que necesitas:

**Tipo:**
- Nota, Tarea, Evento, Documento, PDF, Imagen, Enlace, Archivo

**Fecha:**
- Hoy, Esta semana, Este mes, Pasado, Futuro

**Estado:**
- Pendiente, Hecho, Sin fecha

**Contextos** (chips morados): filtra por el contexto asignado a cada nodo.

**Filtros guardados** (chips azules con 🔖): tus filtros personalizados guardados desde web o Mac, disponibles con un toque.

Debajo de los chips aparece el resultado con el número de nodos encontrados y la lista completa. Al tocar cualquier resultado se abre la **vista de detalle del nodo** (IOSNodeDetailView) con el menú "..." para acciones: editar, mover, marcar como hecho, etc.

### Pestaña 2 — Buscar

Búsqueda full-text en tiempo real con auto-foco de teclado. Escribe cualquier término y Fromly busca en todo tu árbol al instante.

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

Fromly crea un snapshot completo de tus datos en el servidor cada 2 horas (solo cuando hay cambios). Se conservan los últimos **12 snapshots** (~24 horas de historial continuo).

Puedes crear un snapshot manual cuando quieras: **Ajustes → Datos → Backups → "Crear snapshot ahora"**.

### Restaurar un backup

En **Ajustes → Datos → Backups**, elige cualquier snapshot de la lista y pulsa "Restaurar". Antes de sobrescribir tus datos, el servidor crea automáticamente un snapshot de seguridad (`pre-restore`) para que puedas deshacer si te equivocas.

### Exportar tus datos

En **Ajustes → Exportar** puedes descargar todos tus datos en cualquier momento:

- **JSON**: formato estructurado con todos los metadatos (para uso programático o migraciones).
- **Markdown**: una carpeta de archivos `.md`, uno por nodo con cuerpo. Legible en cualquier editor.

Tus datos no están atrapados en Fromly. La exportación es completa, sin restricciones y funciona en el plan gratuito.

### Privacidad

- La IA solo accede al contenido que está en el contexto de la conversación activa: el nodo abierto, sus hijos y los contextos que tengas activos. No escanea todo el árbol de forma automática.
- El backup local en Mac se guarda en `Application Support/Fromly/Backups/` en tu propio ordenador.

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

- **Email**: solo lectura (cambiarlo rompería el inicio de sesión con Google/Apple).
- **Contraseña**: puedes cambiarla (pide la actual).
- **Suscripción**: tu plan y, si tienes suscripción activa, renovación, «Cancelar» y «Gestionar facturación» (portal de cliente). En plan gratuito solo verás «Mejorar»; en licencia perpetua, nada que gestionar.
- **Eliminar cuenta**: protegida — pide confirmar con tu contraseña (o tu email si entras con Google).

### Idioma

Fromly está disponible en **12 idiomas**: español, inglés, alemán, francés, italiano, portugués, griego, neerlandés, polaco, ruso, turco y sueco. El idioma se detecta automáticamente a partir de la configuración de tu navegador o sistema operativo (inglés si el tuyo no está disponible — nunca asume español).

Para cambiarlo manualmente: **Ajustes → 🌐 Idioma** y elige tu idioma. El cambio se aplica de inmediato sin necesidad de recargar. Los tooltips, los textos de ayuda y los marcadores de los campos también están traducidos, y la IA y la voz siguen el mismo idioma de la interfaz.

### Apariencia

- **Tema**: claro u oscuro.
- **Color de acento**: 12 colores para el interfaz (por defecto morado).
- **Calendario y Planner**: hora de inicio y fin del día (por defecto 7:00-23:00); las horas fuera de rango se ocultan en el calendario y el planner.

### IA

- **Tokens incluidos**: tu saldo de tokens de IA.
- **Claves API propias**: solo con **licencia perpetua** puedes usar tus propias claves de Anthropic/OpenAI/Google (el consumo va a tu cuenta).
- **Idioma** de la IA: español, inglés o automático.

### Magic

Todo lo que Fromly sabe de ti vive en tu **Perfil de IA** (una nota editable). Desde aquí, «Ver y editar» abre lo que Fromly ha aprendido por su cuenta, y se lista lo que sabe **por cada contexto**. La limpieza es automática. Magic siempre está activo (no hay interruptores).

### Atajos

Atajos de teclado (los configurables se reasignan con un clic) y expansión de texto.

### Google

Conectar/desconectar Google Calendar y ver el estado de sincronización.

### Accesorios

Token de API, barra de menús (Mac), Atajo de Apple, Raycast, Chrome y Claude. Ver §23b.

### Datos / Backup

- Snapshots automáticos cada ~2h; crear snapshot manual; restaurar uno anterior.
- **Exportar** una copia completa en JSON o Markdown.

### Importar

Fromly importa desde otras apps con un **asistente paso a paso**. Ve a **Ajustes → Importar** y elige la fuente:

- **Obsidian** — sube la carpeta del vault (.md). Se respeta la estructura de subcarpetas.
- **Notion** — exporta a «Markdown & CSV», descomprime el .zip y sube la carpeta.
- **Apple Notes** — pásalas antes a .txt/.md y súbelas.
- **Markdown / texto** — uno o varios archivos .md/.txt, o una carpeta entera.
- **Fromly (JSON)** — una copia de seguridad exportada desde Fromly.

Lo importado se crea en un nodo **«📥 Importado [fecha]»** (con encabezados → secciones y viñetas anidadas), para que lo revises y reorganices sin tocar tus notas actuales.

### Plantillas

Una plantilla es un **nodo hijo de 📋 Plantillas**: la editas como cualquier nota. Al abrirla, en la columna derecha puedes:
- **Auto-aplicar en nota diaria**: cada día nuevo arranca con su contenido.
- **Nota recurrente**: cada X días/semanas/meses (y el día), Fromly inserta la plantilla como una **sección dentro de la nota de ese día** (ideal para revisión semanal/mensual).

---

## 23. Conexión con Claude (MCP)

Fromly está en el **directorio oficial de conectores de Claude** (Anthropic). Una vez conectado, Claude guarda automáticamente documentos, tareas y resúmenes de conversación en tu vault sin que tengas que pedirlo.

### Cómo conectar — directorio de Claude (recomendado)

Funciona desde cualquier dispositivo: claude.ai, iPhone, Android y Claude Desktop.

1. Abre Claude (claude.ai, app de iPhone/Android o Claude Desktop).
2. Ve a **Ajustes → Conectores**.
3. Busca **"Fromly"** en el directorio.
4. Pulsa **Conectar** e inicia sesión con tu cuenta de Fromly mediante OAuth.
5. Listo — Claude puede guardar notas y tareas en tu vault desde ese momento.

No necesitas instalar extensiones, copiar tokens ni introducir URLs manualmente.

### Cómo conectar — Claude Code (CLI)

Para Claude Code (la CLI de terminal), configura la conexión manualmente. Primero genera tu token en **Fromly → Ajustes → Accesorios**. Luego añade la entrada `from` a `~/.claude.json` bajo la clave `mcpServers`:

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
fin  →  Claude guarda el resumen de la conversación en Fromly automáticamente
```

---

## 23b. Accesorios — captura desde cualquier sitio

Fromly no te obliga a tener la app delante. Estos accesorios mandan lo que tengas a tu **nota de hoy**, y la inteligencia de Fromly se encarga de clasificarlo (tipo, fecha, contexto). Todos —salvo la barra de menús— se conectan con el **token de API** de tu cuenta.

### El token de API
Es la llave que usan Raycast, Chrome y Claude Code (CLI) para hablar con tu Fromly. Se genera y copia en **Ajustes → Accesorios** (es el mismo token para los tres; regenerarlo invalida el anterior). Vive 1 año. Para Claude en web, iPhone, Android y Desktop, no necesitas el token — usa el directorio de conectores (ver sección 23).

### Barra de menús (Mac)
Fromly vive en la barra de menús del Mac con su icono (el árbol).
- **Clic en el icono** (o menú → *Captura rápida*) → abre una ventana de captura tipo Spotlight: escribe una nota, tarea o evento y cae en tu nota de hoy. Fromly detecta el tipo, la fecha y los `@contextos` que escribas.
- Cerrar la ventana principal **no** cierra Fromly: sigue disponible en la barra de menús.
- **Ocultarlo**: Ajustes → Accesorios → desactiva "Mostrar icono en la barra de menús", o clic derecho en el icono → *Ocultar este icono*.

### Atajo de Apple (tecla global)
Para capturar desde **cualquier app** con una sola tecla.
1. En **Ajustes → Accesorios → Atajo de Apple** pulsa **"Instalar atajo de Apple"** (abre el atajo listo en la app Atajos) y añádelo.
2. En la app Atajos, abre los **Ajustes del atajo → Tecla rápida** y asígnale la combinación que quieras (por ejemplo ⌃⌥Espacio).
3. Al pulsarla, te pide el texto y lo guarda directamente en tu nota de hoy.

Por debajo usa el enlace `from://capture?text=…&silent=1`. Si prefieres montarlo a mano, crea un Atajo con la acción *"Abrir URL"* usando ese enlace y sustituye `[Texto]` por *"Pedir texto"* o *"Portapapeles"*.

### Raycast
Extensión de Fromly para [Raycast](https://raycast.com):
- **Create in Fromly** — escribe y cae en tu nota de hoy (Fromly decide si es nota, tarea o evento).
- **Search Fromly** — busca en todo tu vault y abre el resultado en la app o en la web.
- **Open Today's Note** — abre tu nota diaria.

Instálala desde la Raycast Store y pega tu token de API en sus preferencias (Ajustes → Accesorios → Raycast → copiar token).

### Chrome
Extensión de Fromly para Chrome:
- **Clic en el icono** → guarda la URL de la pestaña actual en tu nota de hoy (se convierte en enlace).
- **Selecciona texto → clic derecho → "Enviar selección a Fromly"** → lo guarda como nodo.

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

Suscríbete al canal oficial de Fromly en Telegram para recibir tips semanales sobre cómo sacar el máximo partido a la app: atajos, flujos de trabajo, casos de uso con Magic y novedades.

**Cómo unirte:** busca **@FromMagicBot** en Telegram o accede desde el enlace en fromly.app.

Los tips se envían de forma automática sin necesidad de interacción. Es un canal de difusión, ideal para aprender Fromly de forma gradual sin saturar tu bandeja de entrada.

---

## Preguntas frecuentes

**¿Puedo usar Fromly sin conexión?**
Sí. La app Mac e iPhone funciona sin conexión. Los cambios se sincronizan automáticamente cuando recuperas la conexión.

**¿Qué pasa si supero los 1.000 nodos en el plan gratuito?**
Puedes seguir leyendo tus notas, pero no crear nuevas hasta que elimines nodos o actualices a Pro.

**¿Dónde se guardan mis datos?**
En los servidores de Fromly (Europa) y, en Mac, también en un backup local en tu propio ordenador. Puedes exportar todo en JSON o Markdown desde Ajustes en cualquier momento.

**¿La IA lee todas mis notas?**
No. La IA solo accede al contenido que está en el contexto de la conversación activa: el nodo abierto, sus hijos y los contextos que tengas activos. No escanea el árbol completo de forma automática.

**¿Puedo importar mis notas de Obsidian, Notion u otras apps?**
Sí. Ve a **Ajustes → Importar**. Fromly acepta exports de Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes y carpetas de Markdown en general.

**¿Los espejos (⬡) sincronizan en ambas direcciones?**
Sí. Editar el espejo edita el original, y cualquier cambio en el original se refleja en todos sus espejos inmediatamente.

**¿Puedo compartir una nota con alguien que no tiene Fromly?**
Sí. Clic derecho sobre el nodo → "Publicar". Fromly genera una URL pública del tipo `fromly.app/p/...` con el contenido renderizado. Solo quienes tengan el enlace pueden verla.

**¿Cómo funciona la sincronización entre dispositivos?**
Los cambios se sincronizan en tiempo real (delta: solo viajan los cambios, no toda la base de datos). En condiciones normales, los cambios aparecen en segundos en todos tus dispositivos.

**¿El backup automático consume cuota?**
No. Los snapshots automáticos son parte del servicio en todos los planes. El historial guarda los últimos 12 snapshots.

**¿Cómo cancelo la suscripción?**
Desde **Ajustes → Cuenta → Suscripción** o en [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Tu acceso Pro se mantiene hasta el final del periodo pagado.

**¿Puedo usar mis propias claves de API de IA?**
Sí, en el plan Pro o Lifetime. Ve a **Ajustes → IA** y añade tus claves de Anthropic, OpenAI o Google. El consumo irá a tu cuenta y no descuenta de los tokens de Fromly.

**¿Qué es el filtro `bucle`?**
El operador `bucle` muestra tus bucles abiertos: nodos de tipo bucle que tienes en curso y aún no has cerrado. Útil para ver de un vistazo todo lo que tienes en marcha.

**¿La captura con Espacio y ⌘K son lo mismo?**
Sí. `Espacio` abre el modal de captura unificada cuando el cursor no está editando texto. `⌘K` hace lo mismo y funciona siempre, aunque haya texto en edición. Son sinónimos del mismo modal.

---

*fromly.app — Tu segundo cerebro. En todos tus dispositivos.*
