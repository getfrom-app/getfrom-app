# Changelog — From

Historial de versiones. Plataformas: Web · Mac · iPhone.

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

