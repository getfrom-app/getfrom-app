# From — Complete Product Documentation

> Living document. Updated with each development session.
> Last update: 2026-05-08 (v3.6.6 — temporal hierarchy + calendar fixes)

## Changelog

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

1. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` (incremental integer) in Xcode
2. `xcodebuild archive` (Release, Developer ID, Hardened Runtime)
3. `xcodebuild -exportArchive` → `.app`
4. `hdiutil create` → `.dmg`
5. `xcrun notarytool submit --keychain-profile "notarytool" --wait`
6. `xcrun stapler staple` + `validate`
7. `/tmp/sparkle-bin/bin/sign_update From.dmg` → get `edSignature` and `length`
8. `gh release create vX.X /tmp/From.dmg` in repo `albertolezaun-afk/getfrom-app`
9. Add `<item>` to `landing/appcast.xml` with edSignature, length and sparkle:version
10. `git push` landing → GitHub Pages publishes in ~1 min → Sparkle auto-detects

**Notarization credentials:** stored in Keychain as `"notarytool"` (`--keychain-profile "notarytool"`)

Full reference: `docs/publicar-version.md`

### Current published version
- **macOS**: v3.0 (build 18) — published 2026-05-06
- **iOS**: pending App Store (roadmap)

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
