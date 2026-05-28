# Changelog — From

Historial de versiones. Plataformas: Web · Mac · iPhone.

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
- Atajos del árbol: al hacer clic ahora aplican correctamente el filtro al árbol (race condition resuelto)
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
- 📌 Atajos visible en el árbol
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
- 📌 Atajos — accesos rápidos sincronizados entre dispositivos
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
