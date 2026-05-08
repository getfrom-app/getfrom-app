# From — Documentación completa

> Documento vivo. Actualizado en cada sesión de desarrollo.
> Última actualización: 2026-05-08 (v3.6.8 — área picker + workspace eliminado)

## Changelog

### v3.6.8 (2026-05-08)
- **Área picker**: picker en el panel de propiedades para asignar o crear áreas. Muestra áreas existentes y permite escribir nuevas
- **Contexto IA de área**: banner visual cuando se edita el nodo de contexto de área, con indicador claro de su propósito
- **Workspace eliminado**: `Workspace` reducido a shim mínimo, `Node.workspaceId` computed (no almacenado), `nodesByWorkspace` derivado de `allNodes`
- **Limpieza total**: `AreaChipsFlow`, filtros de workspace, y otras referencias eliminadas

### v3.6.7 (2026-05-08)
- **Arquitectura**: workspace eliminado como entidad estructural — modelo plano de nodos (`allNodes`), área como tag en `extraData["area"]`
- **Onboarding**: primer uso crea automáticamente la jerarquía temporal (año→mes→semana→diario) y abre el diario de hoy
- **Área como contexto IA**: nodo especial por área (`_areaCtx=1`) cuyo body se incluye automáticamente en el system prompt del chat
- **Chat**: botón de tag de área para editar/crear el nodo de contexto desde cualquier nota

### v3.6.6 (2026-05-08)
- **Breadcrumb**: jerarquía temporal correcta — sin "From", cada nivel muestra solo sus ancestros. Año: sin prefijo; Mes: solo año; Semana: año+mes; Diario: año+mes+semana
- **Calendarios temporales**: el calendario de nodos año/mes/semana abre en la fecha correcta del nodo (ya no en la fecha actual)
- **Notas diarias en calendarios**: las notas diarias aparecen en el grid de semana/mes usando `diaryDate`

### v3.5.4 (2026-05-07)
- **Rendimiento**: TemporalNavigator pre-buckea nodos por día — lookup O(1) por celda en vez de iterar todos los nodos con Calendar operations
- **Rendimiento**: Dashboards (Proyectos, Tareas, Semana, Mes, Elementos) con debounce + cache — no recomputan en cada cambio de nodo
- **Rendimiento**: NodesView body ya no depende de `nodesByWorkspace` — elimina re-renders innecesarios
- **Rendimiento**: Apple Calendar sync con lookups directos por ID en vez de escanear 3.000+ eventos
- **Swift 6**: Propiedades de `Node` (`isAtomicTask`, `isOverdue`, `isDone`...) marcadas `nonisolated` — compatibles con `-default-isolation=MainActor`
- **Limpieza**: Eliminados 12 ficheros de código muerto (~5.500 líneas): BulletTreeView, NodeDashboardView, NodeWorkspaceDashboard y 9 panel views del sistema antiguo

### v3.5.2 (2026-05-06)
- Fix crash `Dictionary(uniqueKeysWithValues:)` en Apple Calendar sync con eventos recurrentes duplicados
- Añadidos `NodeMode.enlace` y `NodeMode.archivo` como tipos first-class
- GlobalDashboardView rediseñado con 6 pestañas fijas (Proyectos/Tareas/Agenda/Mes/Elementos/Chat IA)

---

## Qué es From

**From** es una aplicación nativa para macOS e iOS que funciona como un segundo cerebro personal. Organiza toda la información en un árbol de bullets sincronizado en tiempo real entre dispositivos, con agentes autónomos de IA y gestión de archivos integrada.

**Tagline:** Tu segundo cerebro. En todos tus dispositivos.

**Propuesta de valor:**
- **Árbol de bullets universal:** Todo — notas, tareas, proyectos, diario, archivos — vive en un árbol de nodos flexible organizado en workspaces con colores.
- **Sync real en tiempo real:** Los cambios se sincronizan entre Mac, iPhone y la nube automáticamente. Sin iCloud Drive, sin ficheros .md que gestionar.
- **IA integrada:** Asistente conversacional con contexto completo de los nodos. Agentes autónomos que ejecutan tareas periódicas.
- **Nativo macOS + iOS:** Construido en Swift y SwiftUI. Rendimiento nativo.

**Público objetivo:**
- Knowledge workers (proyectos, tareas, notas interconectadas)
- Personas que quieren todo en un único sistema sin fricciones
- Usuarios de Mac + iPhone que necesitan continuidad real entre dispositivos
- Entusiastas de IA que quieren un asistente con contexto real de su vida

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| App macOS | Swift 5.10 + SwiftUI |
| App iOS | Swift 5.10 + SwiftUI |
| Plataforma macOS | macOS 14+ (Sonoma) |
| Plataforma iOS | iOS 17+ |
| Almacenamiento local | SQLite (NodeDB, FTS5) |
| Sync en la nube | TypeScript + Bun + Hono + Drizzle + PostgreSQL (Railway) |
| Archivos en la nube | Cloudflare R2 (S3-compatible) via presigned URLs |
| Búsqueda | SQLite FTS5 local + NodeSearchParser |
| Calendario | EventKit (Apple Calendar + Reminders) |
| IA | Multi-proveedor: Anthropic Claude, OpenAI, Google Gemini |
| Pagos | LemonSqueezy |
| Updates | Sparkle (macOS) |
| Landing | HTML estático (getfrom.app) |

---

## Arquitectura de datos

### Modelo de nodos

El dato fundamental es el **Node** — un bullet con texto, body markdown opcional, propiedades y hijos. Los nodos se organizan en **Workspaces** (espacios de trabajo con nombre y color).

```
Workspace "Trabajo"
├── Proyecto X
│   ├── Fase 1
│   │   ├── Tarea pendiente   [status: pending, due: 2026-05-10]
│   │   └── Tarea hecha       [status: done]
│   └── Recursos
│       └── Documento de referencia  [body: "contenido markdown..."]
└── Reuniones
    └── 20260506  [isDiaryEntry: true]

Workspace "Personal"
├── ...
```

Un Node tiene:
- `text`: el título/bullet (una línea)
- `body`: markdown libre (la nota al abrir)
- `types`: etiquetas globales (`["tarea", "proyecto", "cliente"...]`)
- `status`: estado operativo (`pending | done | cancelled | ...`)
- `due`: fecha de vencimiento
- `priority`: alta | media | baja
- `isFavorite`, `isDiaryEntry`, `isChat`, `isEvent`, `isActive`
- `collections`: organización interna del workspace
- `siblingOrder`: fractional indexing para ordenación manual
- `parentId`: jerarquía padre-hijo

### Capa de almacenamiento

```
Dispositivo (Mac / iPhone)
  └── nodes.db (SQLite)
        ├── workspaces
        ├── nodes          (FTS5 full-text search)
        ├── node_types     (tipos de nodo)
        └── node_fields    (campos personalizados)

NodeService (in-memory)
  └── nodesByWorkspace: [UUID: [UUID: Node]]  (árbol completo en RAM)
```

### Sincronización

```
Mac  ←──── delta sync cada 5min ────→  Railway PostgreSQL  ←──── delta sync ────→  iPhone
            (POST /sync)                sync_workspaces                              (POST /sync)
                                        sync_nodes
```

**Protocolo delta:** El cliente envía todos los nodos modificados desde `lastSyncAt`. El servidor aplica "ganador más reciente" (`updated_at`) y devuelve los cambios del servidor que el cliente no tiene.

**Archivos:** Los archivos nunca pasan por Railway. Flujo: App → `POST /files/presign-upload` (obtiene URL R2) → App sube directamente a R2 → `extraData["r2Key"]` guardado en el nodo.

### Backup local de nodos

`NodeBackupService` exporta todos los nodos a Markdown cada 2 horas en:
`~/Library/Application Support/From/Backups/`

---

## Primer uso — Onboarding

### macOS
1. **Pantalla de bienvenida:** Permisos básicos (Calendar, Notifications)
2. **Elegir espacio:** El usuario selecciona o crea una carpeta local que From usará como base (para agentes y archivos locales). El vault .md ya no existe.
3. **Login (opcional):** Para activar sync entre dispositivos, el usuario hace login con su cuenta From.

### iOS
1. **Onboarding:** Pantalla de bienvenida
2. **Configurar espacio** (si se necesita uno local para archivos)
3. Los nodos se cargan automáticamente desde el servidor si hay sesión activa

---

## Funcionalidades principales (macOS)

### Árbol de bullets (NodesView)
- Vista principal de la app
- Bullet expandible/colapsable con dot, checkbox, indentación
- Zoom in/out: navegar dentro de cualquier nodo como si fuera la raíz
- Búsqueda inline con comandos: `estado:pendiente`, `fecha:hoy`, `tipo:proyecto`, `prioridad:alta`, `col:Marketing`, etc.
- Drag & drop para reorganizar el árbol
- Crear bullets con Enter, Tab para indentar, Backspace para des-indentar
- Atajos inline: `-t` (tarea), `-p:alta` (prioridad), `-d:hoy` (fecha)

### Panel de detalle del nodo (NodeEditorView)
- Breadcrumb de ancestros
- Título editable
- Body en Markdown
- Panel de propiedades lateral (estado, fecha, tipos, colecciones, prioridad, favorito)
- Árbol de hijos inline

### Dashboard global (GlobalDashboardView)
- Vista de hoy: tareas vencidas, vencen hoy, próximas
- Panel de diario diario (DailyNotePanelView)
- Timeline: Día / Semana / Mes / Año
- Kanban por estado

### Búsqueda global (Cmd+O)
- Nodos, archivos y agentes
- Instantáneo, sin servidor

### Agentes IA (AgentService)
- Los agentes son nodos con `types: ["agente"]`
- Instrucción fija + fuentes de contexto + schedule
- Herramientas: `leer nodo`, `actualizar nodo`, `crear nodo`, `fetch_url`, `buscar web`
- Se ejecutan automáticamente según schedule o manualmente
- Memoria en `node.body`

### Archivos (ArchivosView + FileService)
- Importar archivos desde Finder (drag & drop o menú)
- Subida a Cloudflare R2 via presigned URL
- Vista de archivos con thumbnails, búsqueda, agrupación por tipo/workspace

### Ajustes (SettingsView)
- Cuenta: login, tokens IA, suscripción
- Espacio: configuración del directorio local
- Tipos y Estados: personalización del sistema de taxonomía
- Calendario: sincronización con Apple Calendar
- Backup: estado de backups de nodos
- IA: Agentes, Prompts, Asistente, Taller
- Atajos de teclado: configurables

---

## Funcionalidades principales (iOS)

### Árbol de bullets (IOSNodesView)
- Pantalla principal con selector de workspace
- Buscador con comandos idénticos a macOS
- Chips de filtros activos
- Zoom in/out mediante tap en el dot
- Swipe para marcar hecho / eliminar
- Long press para menú contextual

### Detalle de nodo (IOSNodeDetailView)
- Propiedades en scroll horizontal en la parte superior (estado, fecha, prioridad, tipos)
- Título y body editables
- Árbol de hijos
- Botón añadir bullet hijo

### Captura rápida (FAB + IOSQuickCaptureSheet)
- Texto libre con comandos inline: `-t`, `-d:hoy`, `-p:alta`, `-f`
- Botones rápidos de comandos
- Selector de workspace

---

## Servidor Railway

URL: `https://from-server-production.up.railway.app`

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado del servidor |
| POST | `/auth/login` | Login, devuelve JWT |
| POST | `/sync` | Delta sync de nodos (requiere JWT) |
| GET | `/files/status` | Estado de R2 |
| POST | `/files/presign-upload` | URL presignada para subir archivo |
| POST | `/files/presign-download` | URL presignada para descargar archivo |
| POST | `/admin/bootstrap` | Crear/verificar usuario admin |

### Autenticación

JWT HS256 con `JWT_SECRET` de Railway. Expiración: 15 min (access) + 30 días (refresh).

---

## Modos de uso y monetización

### AppMode — estado de la cuenta

`FromServerService.appMode` es la fuente única de verdad para el gating de features:

| Modo | Condición | Qué funciona |
|------|-----------|-------------|
| `.free` | Sin cuenta | Bullets + Workspaces + Archivos. Sin sync ni IA |
| `.subscription` | Login + `subscriptionStatus: active` | Todo — sync + IA automática (tokens) |
| `.license` | Login + `licenseStatus: active` | Sync + IA con API key propia |
| `.expired` | Login + suscripción/licencia caducada | Solo bullets + archivos |

**Flags de conveniencia:** `canSync` (≠ free), `canUseAI` (== subscription)

### Monetización

- **Modo gratuito:** Sin cuenta, sin límite de tiempo. Bullets y archivos ilimitados.
- **Modo manual (licencia €59):** API key propia del usuario + sync Railway
- **Modo automático (suscripción €7/mes):** Tokens prepago + sync Railway
  - Variantes LemonSqueezy: suscripción (`1553200`), licencia (`1553210`), topup 5M (`1553900`)

---

## Proceso de publicación de versión (macOS)

1. Bump `MARKETING_VERSION` y `CURRENT_PROJECT_VERSION` (entero incremental) en Xcode
2. `xcodebuild archive` (Release, Developer ID, Hardened Runtime)
3. `xcodebuild -exportArchive` → `.app`
4. `hdiutil create` → `.dmg`
5. `xcrun notarytool submit --keychain-profile "notarytool" --wait`
6. `xcrun stapler staple` + `validate`
7. `/tmp/sparkle-bin/bin/sign_update From.dmg` → obtener `edSignature` y `length`
8. `gh release create vX.X /tmp/From.dmg` en repo `albertolezaun-afk/getfrom-app`
9. Añadir `<item>` en `landing/appcast.xml` con edSignature, length y sparkle:version
10. `git push` en landing → GitHub Pages publica en ~1 min → Sparkle detecta automáticamente

**Credenciales notarización:** guardadas en Keychain como `"notarytool"` (`--keychain-profile "notarytool"`)

Referencia completa: `docs/publicar-version.md`

### Versión actual publicada
- **macOS**: v3.0 (build 18) — publicada 2026-05-06
- **iOS**: pendiente App Store (roadmap)

---

## Estructura del repositorio

```
from/
├── app/                    # App macOS + iOS (Swift/SwiftUI)
│   ├── From/               # Target macOS
│   │   ├── Services/       # Lógica de negocio (NodeService, AgentService, etc.)
│   │   ├── Models/         # Modelos de datos (Node, Workspace, VaultFile, etc.)
│   │   └── Views/          # Vistas SwiftUI
│   └── FromiOS/            # Target iOS
│       └── Views/          # Vistas iOS
├── server/                 # Servidor Railway (TypeScript + Bun + Hono)
│   └── src/
│       ├── routes/         # Endpoints (sync, files, auth, admin)
│       ├── db/             # Schema Drizzle + PostgreSQL
│       └── lib/            # JWT, R2 wrapper
├── landing/                # Web estática (getfrom.app)
├── docs/                   # Documentación técnica y procesos
└── logs/                   # Logs de sesiones de desarrollo
```

---

## Variables de entorno (Railway)

```
JWT_SECRET                      # Firma JWT (access tokens)
JWT_REFRESH_SECRET              # Firma JWT (refresh tokens)
ADMIN_SECRET                    # Bootstrap admin
ADMIN_EMAIL                     # Email del admin
LS_STORE_ID                     # LemonSqueezy store
LS_VARIANT_SUBSCRIPTION         # Variant suscripción mensual
LS_VARIANT_LICENSE              # Variant licencia perpetua
LS_VARIANT_TOPUP_5M             # Variant topup 5M tokens
R2_ACCOUNT_ID                   # Cloudflare R2 account
R2_ACCESS_KEY_ID                # R2 S3 access key
R2_SECRET_ACCESS_KEY            # R2 S3 secret
R2_BUCKET                       # Nombre del bucket (from-vault)
DATABASE_URL                    # PostgreSQL Railway (interna)
```

---

## Decisiones de arquitectura clave

### Por qué nodos en lugar de .md

El sistema de archivos .md era frágil: dependía de iCloud Drive para sync (lento, conflictos frecuentes), la estructura se codificaba en frontmatter YAML manual, y añadir nuevas propiedades requería parsear texto. Con NodeDB (SQLite) + Railway sync:
- Sync instantáneo y fiable entre dispositivos
- Propiedades first-class en la base de datos
- FTS5 para búsqueda de texto completo nativa
- Sin dependencia de iCloud Drive

### Por qué Railway en lugar de iCloud/CloudKit

CloudKit tiene límites de escritura, latencia variable y no funciona bien en plataformas no-Apple. Railway + PostgreSQL da control total del esquema, queries SQL directas y se puede escalar.

### Por qué R2 para archivos

Los archivos binarios no deben pasar por Railway (coste de transferencia). R2 con presigned URLs permite subir/descargar directamente desde el cliente, con el servidor solo gestionando autorización.
