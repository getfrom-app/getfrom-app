# From — Manual de usuario

> Versión 3.7 · macOS 14+ · iOS 17+

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

## 3. Notas y nodos

En From, todo es un **nodo**: una línea de texto con título, cuerpo (markdown libre) e hijos. No hay distinción entre nota y tarea: un nodo puede ser las dos cosas al mismo tiempo.

**Crear un nodo:**
- Pulsa `Enter` en cualquier bullet para crear uno nuevo al mismo nivel.
- Pulsa `Tab` para hacer ese nodo hijo del anterior.
- Pulsa `Backspace` al inicio de un bullet vacío para subir un nivel.

**Abrir el detalle de un nodo:**
- Haz clic en el título del bullet para abrirlo en el panel derecho.
- Ahí puedes editar el body en markdown, ver las propiedades (estado, fecha, prioridad, tipos) y gestionar los hijos.

**Organizar con jerarquía:**
- Anida nodos sin límite de profundidad. Por ejemplo: `Proyecto X → Fase 1 → Tarea pendiente`.
- Haz clic en el punto (●) del bullet para hacer zoom y ver solo ese nodo como raíz.
- Arrastra bullets para reorganizarlos dentro del árbol.

**Nodo de diario:**
- Los nodos marcados como entrada de diario (`isDiaryEntry`) forman la jerarquía temporal.
- From los crea automáticamente al iniciar: no tienes que hacerlo tú.

---

## 4. Atajos de teclado esenciales

| Atajo | Acción |
|---|---|
| `⌘K` | Búsqueda rápida global (nodos, archivos, agentes) |
| `⌘T` | Marcar/desmarcar bullet como tarea |
| `⌘E` | Abrir/cerrar panel de propiedades del nodo |
| `⌘N` | Nuevo nodo en el nivel actual |
| `⌘F` | Búsqueda inline en el árbol actual |
| `Tab` | Indentar (hacer hijo del nodo anterior) |
| `Shift+Tab` | Des-indentar (subir un nivel) |
| `Enter` | Crear nuevo bullet al mismo nivel |
| `/` | Abrir menú de comandos en el bullet actual |
| `@` | Abrir picker de menciones para enlazar otra nota |

Los atajos son configurables en **Ajustes → Atajos de teclado**.

---

## 5. Tags (#objetos)

Los **supertags** permiten etiquetar cualquier nodo con un tipo semántico. Escribe `#` en cualquier posición del texto para abrir el selector de tipos.

**Tipos predefinidos:**

| Tag | Uso |
|---|---|
| `#tarea` | Elemento de acción con estado y fecha |
| `#proyecto` | Contenedor de tareas y recursos |
| `#evento` | Cita o compromiso con hora |
| `#agente` | Automatización de IA con schedule |
| `#prompt` | Instrucción reutilizable para el chat |

**Tipos propios:**
- Escribe `#cliente`, `#reunión`, `#idea` o cualquier palabra: From crea el tipo al instante.
- Cada tipo recibe un color automático. Puedes cambiarlo haciendo clic derecho en el chip del árbol.
- Los tags son visibles en el bullet, en el título del panel y en el árbol lateral.

**Borrar un tag:** `Backspace` sobre el chip lo elimina como unidad completa.

---

## 6. @Menciones

Escribe `@` en cualquier posición de un bullet para abrir el **picker de menciones**. Busca por nombre y selecciona la nota que quieras enlazar. El nodo queda referenciado: aparece un chip con el nombre de la nota destino y puedes navegar a ella con un clic.

- Las menciones son bidireccionales: la nota destino muestra en su panel de propiedades qué nodos la referencian.
- Útil para vincular tareas a proyectos, enlazar ideas relacionadas o crear un grafo de conocimiento dentro del árbol.

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
- Crea un nodo y etiquétalo con `#evento`, o usa el botón "Nuevo evento" en el panel derecho al estar en un nodo diario.
- Asigna hora de inicio y fin desde el panel de propiedades.

**Sincronización con Apple Calendar:**
- From importa automáticamente los eventos de tus calendarios de Apple.
- La sincronización es bidireccional: los eventos aparecen en el timeline del día y en la vista de calendario.
- Actívala en **Ajustes → Calendario** y selecciona qué calendarios incluir.

**Timeline 24h:**
- Visible en la columna derecha al abrir un nodo diario.
- Muestra bloques hora a hora con los eventos del día.
- Estilo similar a un planificador de día: ves de un vistazo qué hay ocupado.

---

## 9. Vistas

From ofrece cinco modos de visualización para los nodos de cualquier nivel. Cambia de vista desde los botones en la barra superior.

| Vista | Cuándo usarla |
|---|---|
| **Lista** | Navegación general del árbol, escritura, jerarquía |
| **Kanban** | Gestión de proyectos con estados (pendiente, en curso, hecho) |
| **Tabla** | Comparar propiedades de varios nodos a la vez |
| **Galería** | Revisar contenido visual o tarjetas de recursos |
| **Canvas** | Organización visual libre sobre lienzo infinito |

- La vista **Kanban** agrupa los nodos hijos por su campo `estado`. Arrastra tarjetas entre columnas para cambiar el estado.
- La vista **Tabla** muestra campos como fecha, prioridad y tipos en columnas editables.
- La última vista seleccionada se recuerda por nodo.

### Canvas

El **Canvas** es un lienzo infinito donde puedes colocar notas, tareas y textos libremente y conectarlos con líneas. Es la vista adecuada cuando el árbol lineal no refleja bien las relaciones entre ideas.

- **Añadir elementos:** arrastra cualquier nodo existente al canvas, o crea uno nuevo directamente sobre el lienzo haciendo doble clic.
- **Conectar elementos:** arrastra desde el borde de un nodo al borde de otro para crear una línea de conexión.
- **Navegar:** usa el scroll o el trackpad para hacer pan y zoom sobre el lienzo.
- Los cambios en el canvas se reflejan en el árbol y viceversa: los nodos son los mismos, solo cambia la presentación visual.

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

From incluye una **barra de grabación persistente** en la parte inferior de la app. Permite capturar audio y convertirlo en bullets estructurados mediante IA.

**Cómo grabar:**
1. Haz clic en el icono de micrófono en la barra inferior.
2. Elige la fuente: **micrófono** (tu voz) o **audio del sistema** (reuniones, podcasts, cualquier sonido del Mac).
3. Pulsa el botón de grabación. La barra muestra el tiempo y el nivel de audio en tiempo real.
4. Pulsa **Detener** cuando termines.

**Transcripción y estructuración:**
- La IA transcribe el audio y lo estructura automáticamente en bullets.
- Los bullets se insertan en el nodo activo o en el diario del día si no hay ninguno seleccionado.
- Puedes revisar y editar los bullets antes de confirmar la inserción.

**Casos de uso típicos:**
- Capturar ideas mientras caminas o conduces.
- Transcribir reuniones o llamadas.
- Dictar el borrador de una nota larga sin tocar el teclado.

---

## 13. IA integrada

**Activar el chat:**
- Abre cualquier nodo y ve a la pestaña **Chat** en el panel derecho.
- El asistente tiene contexto completo del nodo: título, body e hijos.

**Cómo usarlo:**
- Pregunta o da instrucciones en lenguaje natural. Ejemplos:
  - "Resume los puntos pendientes de este proyecto."
  - "Crea 5 subtareas para esta fase."
  - "Redacta un email con el contenido de esta nota."
- El asistente puede leer y escribir en el nodo directamente.

**Añadir resultados a la nota:**
- Las respuestas del chat incluyen botones de acción para insertar el contenido generado en el body del nodo con un clic.

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

## 19. Ajustes útiles

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

## 20. Importar desde otras apps

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
