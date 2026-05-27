# From — Manual de usuario v9.0

> Web · Mac · iOS · getfrom.app

---

## Primeros pasos

### ¿Qué es From?

From es una app de notas y gestión de conocimiento personal (PKM) para Mac, iPhone y navegador. Funciona como un árbol de nodos colapsable al estilo Workflowy, con sincronización en tiempo real entre dispositivos e IA integrada de forma nativa.

Todo en From vive en un único árbol. No hay carpetas ni archivos que gestionar: cada nota, tarea y evento es un nodo que puede tener hijos, moverse libremente y referenciarse desde cualquier parte.

### Crear una cuenta

1. Ve a [getfrom.app](https://getfrom.app) y pulsa **Crear cuenta**.
2. Regístrate con email/contraseña, Google o Apple ID.
3. Accede en el navegador, descarga la app Mac o instala la app iOS — todos sincronizan con la misma cuenta.

### Instalar en Mac

1. Ve a [getfrom.app/download](https://getfrom.app/download) y descarga el archivo `From.dmg`.
2. Abre el DMG y arrastra From a la carpeta Aplicaciones.
3. Lanza From desde el Launchpad o desde Aplicaciones.
4. Inicia sesión con tu cuenta.

Las actualizaciones se instalan automáticamente en segundo plano (Sparkle).

### Instalar en iPhone

Busca **From — Notas y PKM** en el App Store o accede desde [getfrom.app/ios](https://getfrom.app/ios).

Inicia sesión con la misma cuenta para que tus notas aparezcan de inmediato.

### Usar en el navegador

Accede a [getfrom.app/app](https://getfrom.app/app) desde cualquier navegador moderno. No necesitas instalar nada.

Puedes instalarlo como PWA: en Chrome o Edge, haz clic en el icono de instalación de la barra de dirección. En Safari iOS: compartir → "Añadir a pantalla de inicio".

---

## El árbol — cómo funciona From

From organiza toda tu información como un árbol de nodos. Cada nodo puede contener texto, tareas, eventos u otros nodos hijos. No hay jerarquía fija: tú decides cómo anidas y organizas.

### Navegar por el árbol

- El árbol principal se muestra en la columna izquierda.
- Haz clic en un nodo para abrirlo y ver su contenido completo en el panel central.
- Haz clic en **▶** (o en el espacio a la izquierda del nodo) para colapsar o expandir sus hijos.
- El botón **⟶** en hover sobre un nodo hace zoom: ese nodo pasa a ser la raíz visible del árbol (útil para trabajar dentro de un proyecto).

### Crear y editar nodos

- **Enter**: crea un nuevo nodo hermano debajo del actual.
- **Tab**: indenta el nodo (lo convierte en hijo del nodo anterior).
- **Shift+Tab**: desindenta el nodo (lo sube un nivel).
- Haz clic en el texto de cualquier nodo para editarlo directamente.

### Reorganizar con drag & drop

- Arrastra cualquier nodo desde el handle `⋮⋮` (visible al pasar el cursor) para moverlo a otro lugar del árbol.
- Puedes arrastrarlo para cambiar su posición entre hermanos o para reparentarlo bajo otro nodo.

### Selección multinodo

Arrastra el cursor desde una zona vacía sobre varios nodos para seleccionarlos con un rectángulo de selección. Los nodos seleccionados se marcan en azul. Con la selección activa puedes eliminarlos, moverlos o aplicar acciones en masa.

---

## Slash menu — acciones rápidas

Escribe `/` en cualquier nodo para abrir el menú de acciones rápidas. Desde aquí puedes:

| Acción | Qué hace |
|---|---|
| `/tarea` | Convierte el nodo en tarea con checkbox |
| `/evento` | Convierte el nodo en evento con hora |
| `/espejo` | Crea un espejo (⬡) del nodo actual en otro lugar |
| `/fecha` | Abre el selector de fecha para el nodo |
| `/mover` | Mueve el nodo a otro lugar del árbol |
| `/hoy` | Navega al nodo del día actual en la Agenda |
| `/contexto` | Añade un @contexto al nodo |

Escribe después de `/` para filtrar opciones. Por ejemplo, `/ta` filtra y muestra `/tarea`.

---

## Tipos de nodo

### Nota (bullet por defecto)

Cualquier nodo sin tipo especial es una nota. Puede contener texto libre con formato Markdown inline: **negrita** (`**texto**`), *cursiva* (`*texto*`), `código` (`` `texto` ``), ~~tachado~~ (`~~texto~~`) y [enlaces](url) (`[texto](url)`).

### Tarea

Las tareas tienen un checkbox ☐/☑ a la izquierda del texto.

**Crear una tarea:**
- Escribe `/tarea` en un nodo, o
- Usa el atajo de teclado correspondiente, o
- Escribe `- [ ] ` al inicio del texto.

**Propiedades de tarea:**
- **Fecha de vencimiento**: asigna una fecha desde el panel de propiedades o escribiendo en el campo de fecha con lenguaje natural (`hoy`, `mañana`, `lunes`, `15 mayo`).
- **Prioridad**: alta, media o baja. Visible como badge junto al texto.
- **Estado**: pendiente, en progreso, hecho, vencido.

Haz clic en el checkbox para marcar la tarea como hecha. Un clic más la desmarca.

### Evento

Los eventos tienen hora de inicio y fin. Se muestran en la Agenda y, si tienes Google Calendar conectado, sincronizan automáticamente.

**Crear un evento:**
- Escribe `/evento` en un nodo, o
- Escribe `-e ` al inicio del texto.

### Espejo ⬡

Un espejo es una referencia a otro nodo. Aparece con el icono ⬡ y muestra el contenido del nodo original. Editar el espejo edita el nodo original (y viceversa). Útil para mostrar el mismo nodo en varios contextos sin duplicarlo.

---

## Sistema @ (Contextos)

Los contextos son etiquetas que agrupan nodos relacionados. Funcionan de forma similar a las áreas o proyectos en otros sistemas.

### Asignar un contexto

Escribe `@` en cualquier nodo para abrir el picker de contextos. Busca o selecciona el contexto que quieres asignar. El nodo queda etiquetado.

### Dónde viven los contextos

Todos tus contextos se definen y gestionan en el nodo raíz del sistema **🧠 Contexto**. Abre ese nodo para crear nuevos contextos, renombrarlos o reorganizarlos.

### Filtrar por @contexto

En la barra de filtros (⌘F o barra superior), escribe `@trabajo` (o el nombre de tu contexto) para ver solo los nodos que tienen ese contexto asignado. Los resultados aparecen en el panel de filtro, con las mismas vistas disponibles (lista, tabla, kanban, calendario).

---

## Nodos raíz del sistema

From incluye varios nodos raíz especiales visibles en el sidebar. Son la estructura base del sistema:

| Nodo | Función |
|---|---|
| **📅 Agenda** | Diario jerárquico: Año → Mes → Día. El día de hoy siempre está accesible. |
| **🧠 Contexto** | Tus contextos (@trabajo, @personal, @proyecto...). |
| **📋 Plantillas** | Plantillas reutilizables. Aplica una con `/plantilla`. |
| **📌 Atajos** | Accesos rápidos que aparecen en el sidebar. Sincronizados entre dispositivos. |
| **⚙️ Ajustes** | Configuración de cuenta, IA, integraciones y preferencias. |

### Agenda: el diario

El nodo 📅 Agenda organiza el tiempo en una jerarquía Año → Mes → Día. Al abrir el día de hoy encuentras:

- Las tareas con vencimiento hoy (y las vencidas).
- Los eventos del día (sincronizados con Google Calendar si está conectado).
- Un espacio para escribir libremente: notas del día, capturas rápidas, ideas.

Navega a días pasados o futuros expandiendo el árbol de la Agenda o usando el selector de fecha.

**Ir al día de hoy:** escribe `/hoy` en cualquier nodo, o pulsa el botón 📅 del sidebar.

### Plantillas

Guarda cualquier nodo como plantilla en 📋 Plantillas. Cuando apliques la plantilla con `/plantilla`, From crea una copia de ese nodo (con todos sus hijos) en el lugar actual.

Útil para reuniones recurrentes, checklist de proyectos, estructuras de notas que repites.

### Atajos

Fija cualquier nodo como atajo desde el menú contextual del nodo (clic derecho → "Fijar como atajo"). Aparece en el panel de 📌 Atajos del sidebar y sincroniza entre todos tus dispositivos.

---

## Filtros inteligentes

### Abrir el filtro

- **⌘F** desde cualquier vista, o
- Usa la barra de filtros en la parte superior.

### Filtros disponibles

| Filtro | Muestra |
|---|---|
| `hoy` | Nodos con vencimiento hoy |
| `mañana` | Vencimiento mañana |
| `semana` | Vencimiento esta semana |
| `pendiente` | Tareas no completadas |
| `hecho` | Tareas completadas |
| `vencido` | Tareas cuya fecha ya pasó |
| `@contexto` | Nodos con ese contexto asignado |
| `#tag` | Nodos con ese tag |
| `[[nombre]]` | Nodos que referencian ese nodo vía wiki-link |
| `node:ID` | Nodo concreto por su ID |

Puedes combinar filtros. Ejemplo: `@trabajo pendiente` muestra las tareas pendientes del contexto trabajo.

### Vistas de resultados

Los resultados del filtro pueden verse en cuatro modos:

| Vista | Cuándo usarla |
|---|---|
| **Lista** | Vista jerárquica estándar, editable inline |
| **Tabla** | Propiedades en columnas, útil para muchos nodos con metadatos |
| **Kanban** | Tablero por estado o prioridad, drag & drop entre columnas |
| **Calendario** | Distribución temporal por fecha de vencimiento |

Cambia de vista con los iconos en la barra superior del panel de resultados.

### Guardar como atajo

Cualquier filtro puede fijarse como atajo con el botón 📌. Aparece en el sidebar para acceder con un clic. Útil para filtros frecuentes: "mis tareas de hoy", "@trabajo pendiente", "#cliente".

---

## IA integrada

### Chat IA

From incluye un chat de IA que tiene acceso a tu árbol de nodos. Puede leer tus notas, crear nuevos nodos y editar los existentes.

**Abrir el chat:**
- Pulsa el icono de chat en la barra lateral, o
- Escribe un espacio al inicio de un bloque vacío.

**Qué puede hacer:**
- Resumir el contenido de una nota o proyecto.
- Crear subtareas a partir de una descripción.
- Buscar información dentro de tus notas ("¿qué decidimos sobre el cliente X?").
- Redactar texto con el contexto de tu nota actual.
- Añadir tareas directamente al árbol.

**Contexto automático:** la IA conoce el nodo que tienes abierto, sus hijos y su contexto (@). No necesitas explicarle en qué estás trabajando.

### IA Inline

Dentro de cualquier nodo, pulsa el botón ✨ (visible en hover) para pedir ayuda al modelo directamente en ese punto. La respuesta se inserta como contenido del nodo con streaming en tiempo real.

**Casos de uso:**
- Continuar o expandir el texto que estás escribiendo.
- Generar una lista de ideas a partir del título del nodo.
- Reformular o acortar el contenido existente.

**Tab**: acepta la sugerencia de IA inline.
**Esc**: descarta la sugerencia.

### Agentes

Los agentes son automatizaciones de IA que se ejecutan de forma programada o manual. Se crean como nodos normales y pueden leer tu árbol, crear notas y buscar en internet.

Configura el schedule desde el panel de propiedades del agente: al abrir la app, diario, semanal, o a una hora concreta.

---

## Backup y privacidad

### Backup automático

From guarda un snapshot completo de tus notas en el servidor cada 2 horas (solo cuando hay cambios). Los últimos 12 snapshots se conservan (~24 horas de historia continua).

Puedes crear un snapshot manual en cualquier momento desde **Ajustes → Datos → Backups → "Crear snapshot ahora"**.

### Restaurar un backup

Elige un snapshot de la lista y pulsa "Restaurar". Antes de pisar tus datos, el servidor crea automáticamente un snapshot de seguridad (`pre-restore`) para que puedas deshacer si te equivocas.

### Exportar tus datos

En **Ajustes → Exportar** puedes descargar todos tus datos en JSON o Markdown en cualquier momento. Tus datos no están atrapados en From.

### Privacidad

- Tus datos nunca dependen solo de la nube. El backup local y la exportación te dan control completo.
- La IA solo accede a los nodos que tú decides compartir con ella en cada sesión.

---

## Atajos de teclado principales

| Atajo | Acción |
|---|---|
| `⌘F` | Filtro/búsqueda inline en el árbol |
| `⌘K` | Command palette — búsqueda global |
| `/` | Slash menu — acciones rápidas |
| `Tab` | Indentar nodo (convertir en hijo) |
| `Shift+Tab` | Desindentar nodo (subir un nivel) |
| `⌘↑` | Mover nodo arriba entre hermanos |
| `⌘↓` | Mover nodo abajo entre hermanos |
| `Enter` | Nuevo nodo hermano debajo del actual |
| `⌘Enter` | Abrir el nodo en vista completa / hacer zoom |
| `⌘B` | Negrita |
| `⌘I` | Cursiva |
| `⌘Z` | Deshacer |
| `⌘⇧Z` | Rehacer |
| `Esc` | Cerrar filtro / volver a la vista anterior |

---

## Instalación paso a paso

### Mac

1. Descarga `From.dmg` desde [getfrom.app/download](https://getfrom.app/download).
2. Abre el DMG y arrastra el icono de From a la carpeta **Aplicaciones**.
3. Abre From desde el Launchpad.
4. En el primer arranque, macOS puede pedir que confirmes que confías en el desarrollador. Ve a **Ajustes del sistema → Privacidad y seguridad** y pulsa "Abrir igualmente".
5. Inicia sesión con tu cuenta.

Las actualizaciones se instalan automáticamente. Puedes comprobar la versión instalada en **From → Acerca de From**.

### iOS

1. Abre el App Store en tu iPhone.
2. Busca **From — Notas y PKM** o accede desde [getfrom.app/ios](https://getfrom.app/ios).
3. Pulsa **Obtener** e instala.
4. Abre From e inicia sesión con la misma cuenta que usas en Mac o web.

Tus notas aparecen en segundos tras el primer sync.

---

## Planes y precios

| Plan | Precio | Incluye |
|---|---|---|
| **Gratis** | €0 | Hasta 1.000 nodos, sin IA, sin archivos adjuntos |
| **Pro** | €7/mes o €49/año | Nodos ilimitados, IA completa, archivos adjuntos, URL pública |
| **Lifetime** | €149 pago único | Todo lo de Pro para siempre + 3M tokens IA incluidos |

Gestiona tu suscripción en **Ajustes → Cuenta → Suscripción**.

Si tienes código de beta o cupón, introdúcelo en el checkout al comprar.

---

## Preguntas frecuentes

**¿Puedo usar From sin conexión?**
Sí. La app Mac e iOS funciona sin conexión. Los cambios se sincronizan automáticamente cuando recuperas la conexión.

**¿Qué pasa si supero los 1.000 nodos en el plan gratuito?**
Puedes seguir leyendo tus notas, pero no crear nuevas hasta que elimines nodos o actualices a Pro.

**¿Dónde se guardan mis datos?**
En el servidor de From (Railway, Europa) y en tu backup local. Puedes exportar todo en JSON o Markdown desde Ajustes en cualquier momento.

**¿La IA lee todas mis notas?**
La IA solo accede al contenido que está en el contexto de la conversación: el nodo abierto, sus hijos y los nodos que le indiques explícitamente. No escanea todo el árbol de forma automática.

**¿Puedo importar mis notas de Obsidian, Notion u otras apps?**
Sí. Ve a **Ajustes → Importar** para importar desde Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes o cualquier carpeta de archivos Markdown.

**¿Cómo funciona la sincronización entre dispositivos?**
Los cambios se sincronizan en tiempo real (delta: solo viajan los cambios, no toda la base de datos). En condiciones normales los cambios aparecen en segundos en todos tus dispositivos.

**¿Los espejos (⬡) sincronizan en ambas direcciones?**
Sí. Un espejo muestra el contenido del nodo original y cualquier edición desde el espejo modifica el original.

**¿Puedo compartir una nota con alguien que no tiene From?**
Sí. Desde el menú contextual del nodo (clic derecho), selecciona "Publicar". From genera una URL pública del tipo `getfrom.app/p/...` con el contenido de la nota renderizado. Solo los usuarios con la URL pueden verla.

**¿El backup automático cada 2 horas consume cuota?**
No. Los snapshots automáticos son parte del servicio. El historial guarda los últimos 12 snapshots por usuario.

**¿Cómo cancelo la suscripción?**
Desde **Ajustes → Cuenta → Suscripción** o directamente en [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Tu acceso Pro se mantiene hasta el final del periodo pagado.

**¿Puedo conectar From con Claude?**
Sí. From tiene integración MCP con Claude Desktop y Claude Code. Ve a **Ajustes → Cuenta → Integraciones**, genera tu token de API e instala la extensión. Claude podrá leer y escribir en tu árbol de notas directamente desde el chat.

---

*getfrom.app*
