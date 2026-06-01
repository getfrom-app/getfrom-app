# From — Complete Product Documentation

> Living document. Updated with each development session.
> Last update: 2026-05-18

## Changelog

### v3.10.1 — 2026-05-18

**Audio / AI**
- If the AI fails when processing a voice recording (no subscription, expired session, network error), the transcript is automatically saved as a bullet under today's diary. The recording is no longer lost.
- Distinct server error messages: "session expired" vs "no subscription" vs generic error.
- After Sign in with Apple, subscription status is hydrated immediately via `fetchMe()` if the auth endpoint didn't return it.

### v3.10.0 — 2026-05-18

**Editor**
- Inline AI now reads the note's content as context. Asking "group these exercises" over a list works without repeating the list.
- Clicking on the empty area of any line places the cursor at the end (Notion style). Clicking below the last content line creates a new line or focuses an existing empty one.

**UI / navigation**
- View selector (Bullets/Table/Kanban/Calendar) moved to the top-right action bar (icons only). The note header stays clean.
- Collapse/expand button for the right column, mirror of the left one.
- Settings tabs properly indented as children of "Settings" and highlighted in blue only when open.
- Removed the "Calendar" tree from the sidebar (duplicated dashboard and breadcrumbs).
- Hover "···" menu button no longer disappears when approaching it.

**Side AI chat removed**
- The lateral chat panel (⌘J) fully removed (~1800 LOC). All AI interaction is now inline.

**Performance**
- Markdown regex cached as `static let`. They were being recompiled on every NSTextView render.
- `loadAllNodes()` moved to a `userInitiated`-priority Task; the main actor is free to mount UI while SQLite loads.
- Removed the global 1 s timer; it now lives only inside the bottom status bar at 5 s cadence.
- Startup phased: critical paths at `userInitiated`, non-critical at `utility`/`background` with 3–6 s delays.
- Light keystroke save path with 200 ms debounce (no `nodesVersion` bump).
- Skip hashtag coloring when text has no `#` or `@`.

**Audio / recording**
- Transcription engine errors (mic permission, language, audio engine) are no longer swallowed: surfaced live while recording.

**Critical data-loss fix**
- `getOrCreateDailyNote` now waits for memory to be loaded before creating with the canonical ID. Without this guard, an `INSERT OR REPLACE` on the canonical ID would (via `ON DELETE CASCADE`) wipe all existing diary content. Double safeguard: if memory doesn't have the diary, SQLite is consulted before inserting.

## Current state — May 2026

This section describes the complete state of the From application as implemented in May 2026. It is not a version changelog but an exhaustive description of the system.

---

### Editor and nodes

**Hierarchical outliner:**
- Outliner-style bullet editor with a tree of nested nodes. Each node has a `parentId`, single-line text, optional free-form Markdown body, and optional properties in `extraData`.
- Drag & drop to reorder nodes within the tree (same level or reparenting).
- Collapse and expand branches. Zoom in/out: navigate inside any node as if it were the root of the tree.
- Fractional indexing (`siblingOrder`) for manual ordering without collisions.

**Node types and transformations:**
- Slash palette (`/`) at the start of a bullet to transform it: Task, Event, Open Loop, Heading (h1/h2/h3), Agent, Prompt, Link, File.
- Inline headings: `/h1`, `/h2`, `/h3` with differentiated typographic rendering.
- Each node can have multiple simultaneous types (`types: ["task", "project"]`).

**Supertags (#):**
- Inline palette when typing `#` anywhere in the text.
- Predefined types: task, project, event, agent, prompt. User types created instantly without confirmation.
- The `#type` chip is deleted as a unit with Backspace and jumps with ← →.
- Dynamic color coding by type. `TypeColorService` assigns a random persistent color on first appearance.
- Right-click on sidebar chip → change color (presets + native ColorPicker).

**Node properties (`extraData`):**
- Typed fields: `text`, `number`, `date`, `select`, `bool`, `url`, `email`, `phone`.
- Area (`extraData["area"]`), area AI context (`_areaCtx=1`), R2 key for attached file (`r2Key`).
- YAML frontmatter accessible and editable per note.
- Markdown body per node with full formatting support.

**Mentions and references:**
- `@mentions` to reference other notes/nodes from the body. Direct navigation to the referenced node.

**Customizable inline shortcuts:**
- Configurable text expansion in Settings. The user defines aliases and their expansion (e.g. `-t` → converts to task, `-d:today` → today's date, `-p:high` → high priority).

---

### Tasks

- **Statuses:** `pending`, `done`, `future`, `cancelled`.
- **Priority:** high, medium, low.
- **Due date** with natural language (today, tomorrow, next Monday, in 3 days…).
- **`dueEnd`**: end date for tasks with a duration.
- **Recurrence:** daily, weekly, monthly, yearly. The task regenerates automatically on completion.
- **Open loops:** tasks without a fixed date, like persistent reminders. Visible in a dedicated sidebar section.
- **Atomic tasks:** nodes marked as the smallest indivisible action.
- **Quick tasks (⌘T):** direct capture without opening the main app. Inserted into the active root node.
- **Quick tasks** with `QuickCaptureSheet` via FAB on iOS or keyboard on macOS.

---

### Events and calendar

- **Two-way sync with Apple Calendar and Apple Reminders** via EventKit. Events created in From appear in macOS/iOS Calendar and vice versa.
- **Event creation with ⌘E** and natural language (date, time, duration parsed automatically).
- **`EventEditSheet`** to edit title, start/end date and time, notes, destination calendar.
- **Timeline** in the right column of the diary: Day (24h), Week, Month, Year views. Apple Calendar events render in all grids.
- Daily nodes (`isDiaryEntry: true`) with `diaryDate` to align with the calendar grid.

---

### Organization

- **Tags `#`** with predefined types (task, project, event, agent, prompt) and unlimited user types.
- **Knowledge areas:** area as a tag in `extraData["area"]`. Picker in the properties panel to assign or create areas. Each area has an AI context node (`_areaCtx=1`) whose body is automatically included in the chat system prompt.
- **Automatic temporal hierarchy:** on first use, a year→month→week→diary tree is created. Onboarding opens today's diary.
- **Temporal breadcrumb:** Year > Month > Week > Day > [node ancestors] > title.
- **Collections and groups:** internal organization within a space to group related nodes.
- **Workspaces:** legacy entity reduced to a minimal shim. The model is flat (`allNodes`); the area replaces the workspace as the semantic container.

---

### Views

- **List:** standard bullet tree with indentation and collapse.
- **Kanban:** columns by status (pending, done, cancelled, etc.).
- **Table:** node grid with property columns.
- **Gallery:** visual cards with body preview.
- **Calendar Day / Week / Month / Year:** nodes with dates rendered in the grid. Clickable to navigate to the node.
- **Infinite canvas (whiteboard):** nodes freely positioned on a 2D plane with visual connections between them.
- **Filters:** by status, priority, area, type, date, collection. Combinable.
- **Sorting:** by creation date, modification date, due date, priority, manual order.
- **Grouping:** by status, type, area, priority, date.
- **Saved views (panels):** searches with saved filters as a quick-access panel in the sidebar.

---

### Search

- **⌘K — Universal CommandBar:** create nodes, search, navigate, parse natural dates. Flags `-t` (task), `-e` (event), `-b` (open loop). The bar interprets natural language for dates and types.
- **⌘F — Inline search:** `InlineFilterBar` with `FilterResultsPanel` overlaid on the editor. Shows real-time results with context.
- **Search commands:** `status:pending`, `date:today`, `type:project`, `priority:high`, `col:name`, `area:name`, free text.
- **macOS Spotlight:** nodes are indexed and accessible from the system search.
- **Magic Search:** semantic search with AI. The natural language query searches the entire vault and synthesizes a response with references to relevant nodes.

---

### Artificial intelligence

**Chat per note:**
- Button ✦ or ⌘J opens the AI chat with context of the current node (title + body + children + area context).
- History specific to each note. Switching to another note clears the history (unless the chat created that note).
- Responses include action cards with colored icons to apply changes directly to the node.

**AI editor and drafts:**
- AI drafts sidebar for composing or rewriting content. The draft can be inserted into the node body or replace it.

**Inline suggestions (ghost text):**
- The model suggests continuations of the text while typing. Accepted with Tab or right arrow.

**Voice recording:**
- Capture audio from the microphone, system audio (Soundflower/BlackHole), or a mix of both.
- Automatic transcription → AI post-processing → structured bullets inserted into the active node or a new one.
- Persistent recording bar in the main window. Also accessible from QuickCaptureSheet.

**Autonomous agents:**
- Agents are nodes with `types: ["agent"]`.
- Each agent has: fixed instruction, context sources (referenced nodes), schedule (on open, daily, weekly, manual).
- Available tools: `read node`, `update node`, `create node`, `fetch_url` (up to 4,000 chars), `web search` (Brave Search API).
- Run automatically on schedule or on demand. Memory persisted in `node.body`.
- `AgentService` manages the queue and token budget per execution.

**Magic Search:**
- Semantic search over the entire vault combining FTS5 + embeddings. The AI synthesizes a response citing relevant nodes.

**Multi-provider:**
- Primary: Anthropic Claude Haiku 4.5 (cost/quality balance).
- Fallback: Google Gemini Flash.
- In license mode: the user provides their own API key (Anthropic, OpenAI, or Gemini).

**Token management:**
- Subscription plan: 2 million tokens/month included.
- Top-up available: 5 million additional token packs (LemonSqueezy variant `1553900`).
- Token panel in Settings with current usage and renewal date.

---

### Integrations

- **Apple Calendar + Reminders:** two-way sync via EventKit. Creating, editing, and deleting events from From is reflected in the system and vice versa.
- **Google Docs:** note ↔ Google document synchronization via OAuth2. Changes to the node body propagate to the doc and vice versa.
- **Note publishing:** each note can have a public URL by slug. Published content can be updated or unpublished from the properties panel.
- **macOS Spotlight:** nodes indexed in the operating system index.
- **Brave Search API:** used by agents for web searches with automatic fallback for URLs in inline AI.
- **Cloudflare R2:** storage for binary files attached to nodes (presigned URLs, never go through Railway).

---

### Sync and account

- **Own server on Railway:** `https://from-server-production.up.railway.app` (TypeScript + Bun + Hono + Drizzle + PostgreSQL).
- **Real-time delta sync:** Mac ↔ iPhone ↔ server. "Last writer wins" protocol by `updated_at`. Cycle every 5 minutes or by push.
- **Plans:**
  - Free: no account, unlimited bullets, no sync or AI.
  - Subscription €7/month: sync + 2M AI tokens/month (managed Anthropic/Gemini).
  - Lifetime license €59: sync + AI with the user's own API key.
- **LemonSqueezy** for payments. Variants: subscription (`1553200`), license (`1553210`), topup 5M tokens (`1553900`).
- **Automatic local backup:** `NodeBackupService` exports all nodes to Markdown every 2 hours to `~/Library/Application Support/From/Backups/`.

**Local backup per workspace:**
- Timestamped snapshots every 2h: `~/Documents/From Backup/{Workspace}/{yyyy-MM-dd_HH-mm}/`
- Each snapshot: SQLite copy (nodes.db) + Markdown of all nodes
- History: 6 snapshots per workspace (12h)
- Restoration from Settings without restart
- lastBackupDate key per workspace: `from.nodeBackup.lastDate.{wsId}`
- Separated by workspace: Personal and Demo have independent history

---

### Quick capture

- **⌘K:** Universal CommandBar. Create node, search, navigate, parse date and type with natural language.
- **⌘T:** quick task capture directly to the inbox or active root node.
- **⌘E:** event capture with date/time parsed with natural language.
- **Persistent recording bar:** accessible from any view to start voice transcription.
- **QuickCaptureSheet:** modal sheet with free text + inline flags (`-t`, `-d:today`, `-p:high`, `-b`).

---

### Settings

- **Appearance:** light/dark/system theme. Language selector with 7 available languages.
- **Customizable keyboard shortcuts:** full list of user-editable shortcuts.
- **Inline shortcuts (text expansion):** configurable aliases that expand when typed.
- **AI providers:** own API key configuration (Anthropic, OpenAI, Gemini). Token panel with current usage.
- **Calendar:** configuration of Apple Calendar and Reminders calendars to sync.
- **Backup:** status of the local backup service, last export, open folder.
- **Agents:** list of active agents, schedule, execution history.
- **Types and statuses:** customization of the taxonomy system (predefined and user types, statuses, colors).
- **Import/Export:** export complete vault as Markdown or JSON. Import from other apps.
- **Account:** login/logout, subscription or license status, token management.

---

### v3.6.8 (2026-05-08)
- **Area picker**: picker in properties panel to assign or create areas, shows existing areas and allows creating new ones
- **Area AI context UI**: visual banner when editing an area context node, clearly indicating its purpose
- **Workspace fully removed**: `Workspace` reduced to minimal shim, `Node.workspaceId` computed (not stored), `nodesByWorkspace` derived from `allNodes`
- **Complete cleanup**: `AreaChipsFlow`, workspace filters, and other legacy references eliminated

### v3.6.7 (2026-05-08)
- **Architecture**: workspace removed as structural entity — flat node model (`allNodes`), area as tag in `extraData["area"]`
- **Onboarding**: first use automatically creates the temporal hierarchy (year→month→week→daily) and opens today's diary
- **Area as AI context**: special node per area (`_areaCtx=1`) whose body is automatically included in the chat system prompt
- **Chat**: area tag button to edit/create the context node from any note

### v3.6.6 (2026-05-08)
- **Breadcrumb**: correct temporal hierarchy — no "From" prefix, each level shows only its ancestors. Year: no prefix; Month: year only; Week: year+month; Daily: year+month+week
- **Temporal calendars**: year/month/week node calendars open at the node's actual date instead of today
- **Daily notes in calendars**: daily notes now appear in week/month grids using `diaryDate`

### v3.5.4 (2026-05-07)
- **Performance**: TemporalNavigator pre-buckets nodes by day — O(1) lookup per cell instead of iterating all nodes with Calendar operations
- **Performance**: Dashboards (Projects, Tasks, Week, Month, Elements) with debounce + cache — no recomputation on every node change
- **Performance**: NodesView body no longer depends on `nodesByWorkspace` — eliminates unnecessary re-renders
- **Performance**: Apple Calendar sync uses direct ID lookups instead of scanning 3,000+ events
- **Swift 6**: `Node` properties (`isAtomicTask`, `isOverdue`, `isDone`...) marked `nonisolated` — compatible with `-default-isolation=MainActor`
- **Cleanup**: Removed 12 dead code files (~5,500 lines): BulletTreeView, NodeDashboardView, NodeWorkspaceDashboard and 9 legacy panel views

---

## What is From

**From** is a native macOS and iOS app that works as a personal second brain. It organizes all information in a real-time synchronized bullet tree across devices, with autonomous AI agents and integrated file management.

**Tagline:** Your second brain. On all your devices.

**Value proposition:**
- **Universal bullet tree:** Everything — notes, tasks, projects, diary, files — lives in a flexible node tree organized into color-coded workspaces.
- **Real-time sync:** Changes sync automatically between Mac, iPhone, and the cloud. No iCloud Drive, no .md files to manage.
- **Integrated AI:** Conversational assistant with full node context. Autonomous agents that run tasks periodically.
- **Native macOS + iOS:** Built in Swift and SwiftUI. Native performance.

**Target audience:**
- Knowledge workers (projects, tasks, interconnected notes)
- People who want everything in one frictionless system
- Mac + iPhone users who need real continuity across devices
- AI enthusiasts who want an assistant with real context from their life

---

## Technology stack

| Component | Technology |
|---|---|
| macOS App | Swift 5.10 + SwiftUI |
| iOS App | Swift 5.10 + SwiftUI |
| macOS platform | macOS 14+ (Sonoma) |
| iOS platform | iOS 17+ |
| Local storage | SQLite (NodeDB, FTS5) |
| Cloud sync | TypeScript + Bun + Hono + Drizzle + PostgreSQL (Railway) |
| Cloud files | Cloudflare R2 (S3-compatible) via presigned URLs |
| Search | SQLite FTS5 local + NodeSearchParser |
| Calendar | EventKit (Apple Calendar + Reminders) |
| AI | Multi-provider: Anthropic Claude, OpenAI, Google Gemini |
| Payments | LemonSqueezy |
| Updates | Sparkle (macOS) |
| Landing | Static HTML (getfrom.app) |

---

## Data architecture

### Node model

The fundamental data unit is the **Node** — a bullet with text, optional Markdown body, properties, and children. Nodes are organized into **Workspaces** (named, color-coded spaces).

```
Workspace "Work"
├── Project X
│   ├── Phase 1
│   │   ├── Pending task   [status: pending, due: 2026-05-10]
│   │   └── Done task      [status: done]
│   └── Resources
│       └── Reference doc  [body: "markdown content..."]
└── Meetings
    └── 20260506  [isDiaryEntry: true]

Workspace "Personal"
├── ...
```

A Node has:
- `text`: title/bullet (single line)
- `body`: free-form Markdown (the note that opens on expand)
- `types`: global tags (`["task", "project", "client"...]`)
- `status`: operational state (`pending | done | cancelled | ...`)
- `due`: due date
- `priority`: high | medium | low
- `isFavorite`, `isDiaryEntry`, `isChat`, `isEvent`, `isActive`
- `collections`: workspace-scoped organization
- `siblingOrder`: fractional indexing for manual ordering
- `parentId`: parent-child hierarchy

### Storage layer

```
Device (Mac / iPhone)
  └── nodes.db (SQLite)
        ├── workspaces
        ├── nodes          (FTS5 full-text search)
        ├── node_types     (node types)
        └── node_fields    (custom fields)

NodeService (in-memory)
  └── nodesByWorkspace: [UUID: [UUID: Node]]  (full tree in RAM)
```

### Synchronization

```
Mac  ←──── delta sync every 5min ────→  Railway PostgreSQL  ←──── delta sync ────→  iPhone
            (POST /sync)                  sync_workspaces                              (POST /sync)
                                          sync_nodes
```

**Delta protocol:** The client sends all nodes modified since `lastSyncAt`. The server applies "latest writer wins" (`updated_at`) and returns server-side changes the client doesn't have yet.

**Files:** Files never go through Railway. Flow: App → `POST /files/presign-upload` (get R2 URL) → App uploads directly to R2 → `extraData["r2Key"]` saved in the node.

### Local node backup

`NodeBackupService` exports all nodes to Markdown every 2 hours to:
`~/Library/Application Support/From/Backups/`

---

## First use — Onboarding

### macOS
1. **Welcome screen:** Basic permissions (Calendar, Notifications)
2. **Choose space:** User selects or creates a local folder From will use as base (for agents and local files).
3. **Login (optional):** To enable sync across devices, user logs in with their From account.

### iOS
1. **Onboarding:** Welcome screen
2. **Configure space** (if a local folder is needed for files)
3. Nodes load automatically from the server if a session is active

---

## Core features (macOS)

### Bullet tree (NodesView)
- Main app view
- Expandable/collapsible bullets with dot, checkbox, indentation
- Zoom in/out: navigate inside any node as if it were the root
- Inline search with commands: `status:pending`, `date:today`, `type:project`, `priority:high`, `col:Marketing`, etc.
- Drag & drop to reorganize the tree
- Create bullets with Enter, Tab to indent, Backspace to de-indent
- Inline shortcuts: `-t` (task), `-p:high` (priority), `-d:today` (date)

### Node detail panel (NodeEditorView)
- Ancestor breadcrumb
- Editable title
- Markdown body
- Side properties panel (status, date, types, collections, priority, favorite)
- Inline children tree

### Global dashboard (GlobalDashboardView)
- Today view: overdue, due today, upcoming tasks
- Daily diary panel (DailyNotePanelView)
- Timeline: Day / Week / Month / Year
- Kanban by status

### Global search (Cmd+O)
- Nodes, files and agents
- Instant, no server required

### AI Agents (AgentService)
- Agents are nodes with `types: ["agent"]`
- Fixed instruction + context sources + schedule
- Tools: `read node`, `update node`, `create node`, `fetch_url`, `web search`
- Run automatically on schedule or manually
- Memory stored in `node.body`

### Files (ArchivosView + FileService)
- Import files from Finder (drag & drop or menu)
- Upload to Cloudflare R2 via presigned URL
- File view with thumbnails, search, grouping by type/workspace

### Settings (SettingsView)
- Account: login, AI tokens, subscription
- Space: local directory configuration
- Types & Statuses: customization of the taxonomy system
- Calendar: Apple Calendar sync
- Backup: node backup status
- AI: Agents, Prompts, Assistant, Workshop
- Keyboard shortcuts: configurable

---

## Core features (iOS)

### Bullet tree (IOSNodesView)
- Main screen with workspace selector
- Search bar with same commands as macOS
- Active filter chips
- Zoom in/out via tap on dot
- Swipe to mark done / delete
- Long press for context menu

### Node detail (IOSNodeDetailView)
- Properties in horizontal scroll at top (status, date, priority, types)
- Editable title and body
- Children tree
- Add child bullet button

### Quick capture (FAB + IOSQuickCaptureSheet)
- Free text with inline commands: `-t`, `-d:today`, `-p:high`, `-f`
- Quick command buttons
- Workspace selector

---

## Railway server

URL: `https://from-server-production.up.railway.app`

### Key endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/health` | Server status |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/sync` | Node delta sync (requires JWT) |
| GET | `/files/status` | R2 storage status |
| POST | `/files/presign-upload` | Presigned URL to upload file |
| POST | `/files/presign-download` | Presigned URL to download file |
| POST | `/admin/bootstrap` | Create/verify admin user |

### Authentication

JWT HS256 with Railway `JWT_SECRET`. Expiry: 15 min (access) + 30 days (refresh).

---

## Usage modes and monetization

### AppMode — account state

`FromServerService.appMode` is the single source of truth for feature gating:

| Mode | Condition | What works |
|------|-----------|------------|
| `.free` | No account | Bullets + Workspaces + Files. No sync, no AI |
| `.subscription` | Login + `subscriptionStatus: active` | Everything — sync + managed AI (tokens) |
| `.license` | Login + `licenseStatus: active` | Sync + AI with own API key |
| `.expired` | Login + lapsed subscription/license | Bullets + files only |

**Convenience flags:** `canSync` (≠ free), `canUseAI` (== subscription)

### Monetization

- **Free mode:** No account, no time limit. Unlimited bullets and files.
- **Manual mode (license €59):** Own API key + Railway sync
- **Automatic mode (subscription €7/month):** Prepaid tokens + Railway sync
  - LemonSqueezy variants: subscription (`1553200`), license (`1553210`), topup 5M (`1553900`)

---

## macOS version release process

⚠️ **Updated process since v9.4.4. The old Sparkle `sign_update` process is OBSOLETE.**

The updater is `tauri-plugin-updater`. Each release requires a `latest.json` signed with the Tauri key.

```bash
# 1. Bump version in from-mac/src-tauri/tauri.conf.json
# 2. Notarized build
export APPLE_ID="albertolezaun@me.com" APPLE_PASSWORD="ulbw-glkh-jztf-hsin"
export APPLE_TEAM_ID="5YNQRA7NUE"
export TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/from-mac.key
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
make notarize   # from from-mac/

# 3. Sign DMG with Tauri key
cargo tauri signer sign --password "" -f ~/.tauri/from-mac.key /tmp/From.dmg

# 4. Create latest.json and publish to both repos
gh release create vX.X.X /tmp/From.dmg /tmp/latest.json -R getfrom-app/getfrom-app
```

**Signing key:** `~/.tauri/from-mac.key` (no password) — never lose it.

### Current published version
- **macOS**: v9.4.4 — published 2026-06-01, with integrated auto-updater
- **iOS**: v2.2 build 108 — under App Store review

---

## Repository structure

```
from/
├── app/                    # macOS + iOS app (Swift/SwiftUI)
│   ├── From/               # macOS target
│   │   ├── Services/       # Business logic (NodeService, AgentService, etc.)
│   │   ├── Models/         # Data models (Node, Workspace, VaultFile, etc.)
│   │   └── Views/          # SwiftUI views
│   └── FromiOS/            # iOS target
│       └── Views/          # iOS views
├── server/                 # Railway server (TypeScript + Bun + Hono)
│   └── src/
│       ├── routes/         # Endpoints (sync, files, auth, admin)
│       ├── db/             # Drizzle schema + PostgreSQL
│       └── lib/            # JWT, R2 wrapper
├── landing/                # Static web (getfrom.app)
├── docs/                   # Technical documentation and processes
└── logs/                   # Development session logs
```

---

## Environment variables (Railway)

```
JWT_SECRET                      # JWT signing (access tokens)
JWT_REFRESH_SECRET              # JWT signing (refresh tokens)
ADMIN_SECRET                    # Admin bootstrap
ADMIN_EMAIL                     # Admin email
LS_STORE_ID                     # LemonSqueezy store
LS_VARIANT_SUBSCRIPTION         # Monthly subscription variant
LS_VARIANT_LICENSE              # Lifetime license variant
LS_VARIANT_TOPUP_5M             # 5M token top-up variant
R2_ACCOUNT_ID                   # Cloudflare R2 account
R2_ACCESS_KEY_ID                # R2 S3 access key
R2_SECRET_ACCESS_KEY            # R2 S3 secret
R2_BUCKET                       # Bucket name (from-vault)
DATABASE_URL                    # Railway PostgreSQL (internal)
```

---

## Key architecture decisions

### Why nodes instead of .md files

The .md file system was fragile: it relied on iCloud Drive for sync (slow, frequent conflicts), structure was encoded in manual YAML frontmatter, and adding new properties required parsing text. With NodeDB (SQLite) + Railway sync:
- Instant, reliable sync across devices
- First-class properties in the database
- Native full-text search with FTS5
- No iCloud Drive dependency

### Why Railway instead of iCloud/CloudKit

CloudKit has write limits, variable latency, and doesn't work well on non-Apple platforms. Railway + PostgreSQL gives full schema control, direct SQL queries, and can scale.

### Why R2 for files

Binary files shouldn't go through Railway (transfer cost). R2 with presigned URLs allows direct client-to-storage upload/download, with the server only handling authorization.
