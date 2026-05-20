# Changelog — From

Historial de versiones de From para Mac, iPhone y Web.

---

## v3.12 — 20 mayo 2026 — Mac + iOS + Web

### Nuevo
- **From Web** lanzado: editor completo en getfrom.app/app — outliner, diario, tareas, búsqueda, IA, sync en tiempo real
- Login con email/contraseña en Mac e iOS (antes solo Apple ID)
- Login con Google (Google Sign-In) en Mac, iOS y Web
- **iOS**: tab dedicado de Tareas con secciones Vencidas / Hoy / Esta semana / Más tarde / Sin fecha
- **iOS**: botón IA en editor de notas con streaming en tiempo real
- **iOS**: ShareLink en menú de nodo — comparte enlace de cualquier nota
- **iOS**: pantalla de carga animada al iniciar la app
- **Web**: sidebar con 4 tabs (Tags, Fijados, Paneles, Ajustes)
- **Web**: panel derecho en diario (Pendiente + Timeline del día)
- **Web**: atajos Cmd+T (nueva tarea), Cmd+E (nuevo evento), Cmd+R (grabar voz), Escape (ir a hoy)
- **Web**: grabación de voz con Web Speech API → nota (Chrome/Edge)
- **Web**: vista Kanban, vista Calendario semana
- **Web**: exportar datos (JSON + Markdown)

### Mejorado
- Precios actualizados: Free · Pro €7/mes · Anual €49/año · Lifetime €149
- Checkout directo sin cuenta (LemonSqueezy crea la cuenta automáticamente y envía credenciales por mail)
- Manual actualizado con sección de novedades por versión

---

## v3.11 — 13 mayo 2026 — Mac + iOS

### Nuevo
- Extensión MCP para Claude Desktop y Claude Code — instalar en getfrom.app/claude
- Tags unificados con áreas: gestión de contextos por área de trabajo
- Token de API para integraciones (válido 1 año, generado desde Ajustes)
- **iOS**: indicador de plan en Ajustes (Free / Pro / Lifetime / Caducado)
- **iOS**: Google Sign-In

### Mejorado
- Sync más rápido al arrancar: delay reducido de 2s a 0.5s en Mac e iOS
- Indicador de modo offline (wifi.slash, amarillo) en Mac e iOS
- Arquitectura confirmada como local-first: SQLite como fuente de verdad, servidor solo relay

---

## v3.10.1 — 18 mayo 2026 — Mac

### Arreglado
- Si la IA falla al procesar una grabación, la transcripción se guarda automáticamente como bullet — ya no se pierde nada
- Mensajes de error diferenciados: sesión expirada vs sin suscripción vs error genérico

---

## v3.10 — 18 mayo 2026 — Mac

### Nuevo
- IA inline lee el contenido de la nota como contexto ("agrupa estos ejercicios" funciona sin repetir la lista)
- Click en zona vacía de línea coloca cursor al final (estilo Notion)

### Mejorado
- Selector de vista movido a barra superior derecha (iconos compactos, sin texto)
- Panel chat lateral retirado — toda la IA es ahora inline en el editor
- Rendimiento: regex cacheadas, carga en prioridades, debounce 200ms por keystroke, arranque por fases

### Arreglado
- Fix crítico: `getOrCreateDailyNote` ya no borraba el diario existente en arranque concurrente
- Transcripción de voz se guarda automáticamente si falla la IA, sin perder nada
- Mensajes de error de IA diferenciados: sesión expirada vs sin suscripción vs error de red
