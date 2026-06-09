# Fromly — User manual v9.6

> Web · Mac · iPhone · fromly.app

---

## 1. What is Fromly?

Fromly is your second brain. A notes, tasks and personal knowledge-management app that organizes everything you think, do and want to remember into a single hierarchical tree, available on any device and with built-in AI that genuinely knows your information.

It exists for the person who has too many things on their mind, too many apps to manage them, and doesn't want to spend hours configuring complex systems. In Fromly, you capture, organize and act from a single place.

---

## 2. Getting started

### Create an account

Go to [fromly.app](https://fromly.app) and press **Create account**. You can sign up with:

- Email and password
- Google account
- Apple ID

With the same account you sign in from the browser, Mac and iPhone. Everything syncs **in real time**: start an idea on your phone and it appears instantly on your computer. Sync records every change as an operation, so it never loses or deletes anything by mistake — including whatever you create from Claude or your agents, which also shows up instantly.

### Access from the browser

Go to [fromly.app/app](https://fromly.app/app) from any modern browser. Nothing to install.

You can also install it as a lightweight desktop app: in Chrome or Edge, press the install icon in the address bar. In Safari on iOS: Share → "Add to Home Screen".

### Install on Mac

1. Go to [fromly.app](https://fromly.app) and download the `From.dmg` file.
2. Open the DMG and drag the Fromly icon into the **Applications** folder.
3. Open Fromly from Launchpad or the Applications folder.
4. If macOS warns it can't verify the developer, go to **System Settings → Privacy & Security** and press "Open anyway".
5. Sign in with your account.

**Automatic updates:** when a new version is available, `✦ New version — Update` appears in Fromly's bottom bar. One click installs the update without leaving the app. No need to download anything manually.

### Install on iPhone

Search for **Fromly — Notes and PKM** in the App Store, or go to [fromly.app/ios](https://fromly.app/ios). Install the app and sign in with the same account. Your notes appear within seconds.

### First launch: what you see

When you first open Fromly you find:

- **The main tree** in the center: your workspace. It shows the **Agenda** directly — the years (2026, 2027...) from which you navigate to months, days and notes.
- **The left sidebar**: your saved panels and the list of contexts.
- **The top bar**: navigation breadcrumb and controls for the view and the right panel.
- **The right panel**: opens with Magic (AI), Filter, Planner, or the contents of a selected Context.

To start: click the current year to see your notes for the month, or press `H` to jump straight to today.

---

## 3. The tree — how Fromly works

Everything in Fromly lives in a single tree. There are no folders, no files: every note, task, event or resource is a **node** that can contain other child nodes.

### Everything is a node

A project is a node. A task inside that project is a child node. A note documenting that project's meeting is another child node. Everything nested, everything visible, everything movable.

### Creating nodes

- **Enter**: creates a new sibling node below the current one. The cursor moves automatically to the new node.
- **Click an empty area**: creates a node at the end of the level you click.

To edit any node, click its text.

### Indent and outdent

- **Tab**: indents the current node, making it a child of the node above.
- **Shift+Tab**: outdents the node, raising it one level in the hierarchy.

Example: you have "Web project" and create "Meeting with designer" below it. If you press Tab on "Meeting with designer", it becomes a child of "Web project".

### Collapse and expand

Click the **▶** triangle to the left of a node to collapse its children. Click again to expand them. Nodes with children start collapsed by default to keep the tree clean.

Slash menu shortcuts:

- `/Expand all` — expands all descendants of the current node.
- `/Collapse all` — collapses all descendants.

### Reorganize with drag & drop

Hover over any node and the drag handle `⋮⋮` appears on the left. Drag from that handle to:

- Change the node's order among its siblings.
- Move it inside another node (re-parent it).

While dragging, a target line shows where the node will land when you drop it.

### Multi-node selection

Click and drag the cursor over several nodes to select them (selected nodes turn blue). With a selection active:

- **Backspace / Delete** — deletes the selected nodes
- **Escape** — cancels the selection
- **⌘A** — selects all visible nodes

### Zoom into a node

Hover over any node and the **→** icon appears on its right. Click it to zoom in: that node becomes the visible root of the tree. Useful for working inside a project without the rest of the tree distracting you.

The **navigation breadcrumb** in the top bar shows where you are and lets you return to any previous level with a click.

---

## 4. Node types

### Note (default)

Any node without a special type is a note. Write free text with inline Markdown formatting:

| Format | Syntax |
|---|---|
| **Bold** | `**text**` |
| *Italic* | `*text*` |
| `Code` | `` `text` `` |
| ~~Strikethrough~~ | `~~text~~` |
| [Link](url) | `[text](url)` |

Notes can also have a **body**: long, multi-line content with full Markdown. When you select a note, its body appears in the right panel where you can edit it freely. Useful for developing ideas, documenting projects or storing long notes.

**Text blocks** (from the slash menu):

- **Heading** (H1, H2, H3): headers to structure content.
- **List**: an item with a visual dash and extra indentation.
- **Quote**: block with a left side bar.
- **Code**: block with a monospaced font and a distinct background.
- **Divider**: a horizontal line to split sections.

**Markdown shortcuts while typing:**

- Type `# ` at the start → H1 Heading
- Type `## ` → H2 Heading
- Type `### ` → H3 Heading
- Type `- ` → List-style bullet

### Task

Tasks have a ☐/☑ checkbox to the left of the text. Marking it done archives the task and updates its status.

**How to create a task:**

- Type `/task` in the slash menu.
- Type `[ ] ` at the start of the node's text.
- Type `[x] ` to create a task already marked done.
- Use the `⌘Enter` shortcut on a node to turn it into a task.

When you turn a node into a task (with `-t` + Enter or `⌘Enter`), an empty sibling node is always created below so you can keep writing without interruptions.

**Task properties (right panel):**

- **Status**: To do / In progress / Done / Overdue.
- **Due date**: set it by typing in the date field with natural language. Fromly automatically detects expressions like:
  - `today`, `tomorrow`, `the day after tomorrow`
  - `on Monday`, `next Friday`
  - `in 3 days`, `in 2 weeks`
  - `June 15`, `06/15`
  - As you type, gray ghost text shows the interpreted date. Press `Tab` to accept it.
- **Priority**: high, medium or low. Appears as a badge next to the text.
- **Repeat**: daily, weekly, monthly or custom (every N days/weeks/months/years).

**Mark as done:** click the checkbox. To uncheck it, click again.

**Expand a task:** when you discover a task is bigger than you thought and needs sub-tasks or notes, use `/Expand` from the slash menu. The task becomes a container that can have children.

### Event

Events have a start time and an end time. They appear in the Planner and in the Agenda view of the matching day. If you have Google Calendar connected, events sync automatically in both directions.

**How to create an event:**

- Type `/event` in the slash menu.
- Type `-e ` at the start of the text.

When you confirm the event type (with `-e` + Enter), an empty sibling node is created below so you can keep capturing.

The event creation modal lets you:

- Title the event.
- Choose a date (required).
- Add a start and end time (optional; without a time, it's an all-day event).
- Enable repetition.

### Mirror ⬡

A mirror is a synchronized reference to another node. It shows exactly the same content as the original. If you edit the mirror, you edit the original (and vice versa). If you edit the original, the mirror reflects the change immediately.

**What a mirror is for:**

- You want a task to appear in both "Work" and "Project X" without duplicating it.
- You move a task to another day: the original node is left with an automatic mirror in its place so you don't lose track.
- A resource or note that's relevant in several contexts.

**How to create a mirror:**

- Slash menu → `/Mirror` → a search box opens → select the node you want to mirror.
- Right-click the node → "Create mirror".

Mirrors are identified visually by the ⬡ icon next to the text.

### Resource / Link

A resource is a link to external content: an article, a YouTube video, a podcast, a web page. Fromly automatically extracts the title and content type when you paste it.

**How to create a resource:**

- Slash menu → `/Resource`.
- **Paste a URL into an empty node**: Fromly detects it automatically, unfurls it (fetches the page's real title), and the node ends up with the web title and the link icon 🔗 in the bullet. The URL is preserved in the metadata even if you change the node's title.

**Link node behavior:**

- The bullet changes to a **chain icon** 🔗 (instead of the normal dot).
- **Click the bullet** → navigates to the node's note in Fromly.
- The inline **↗** button (next to the text) → opens the URL in your external browser.
- When you edit the node's text, the URL is preserved even if you change the title.

**Resource properties (right panel):**

- Link URL.
- Status: To do / Later / Done (to mark whether you've consumed it).
- Type detected automatically (article, YouTube video, podcast...).

Resources appear in the resources block of the daily Agenda so you remember what you have left to review.

### PDF

Drag any PDF file from your computer onto a node in Fromly. The PDF is uploaded to the cloud and becomes available on all your devices.

**How to attach a PDF:**

- Drag the `.pdf` file from Finder directly onto any node. A child node is created automatically with the file name and the **PDF** badge (red).

**Viewer and annotations:**

When you open a PDF node, the built-in viewer appears with a toolbar:

| Tool | Function |
|---|---|
| ✏️ Pen | Freehand stroke. Pick color and thickness. |
| 🖍 Highlighter | Semi-transparent yellow brush. |
| T Text | Click on the PDF to insert floating text. |
| ◻ Eraser | Removes annotations. |

Annotations are saved in Fromly and are **permanently embedded** into the PDF on exit. If you open the PDF outside Fromly, the annotations are still there.

### Whiteboard

A whiteboard is a freehand SVG drawing canvas inside a node.

**How to create a whiteboard:**

- Slash menu → `/Whiteboard`.
- Type `whiteboard` anywhere in a node's text: a confirmation ghost text appears. Press `Enter` to confirm.

The whiteboard uses the same tools as the PDF viewer (pen, highlighter, text, eraser). Annotations are saved automatically.

### AI Agent

An agent is a special node that runs an AI task autonomously. You define what it should do (prompt), when it triggers (schedule) and what actions it can take (create nodes, search, read your tree).

**How to create an agent:** slash menu → `/Agent`.

**Use cases:**

- Summarize today's diary every night at 11:00 PM.
- Extract tasks from a long note when you finish it.
- Process the capture inbox and classify the items.
- Search the internet and save the summary as a note.

Agents are configured from the right panel: prompt, schedule (on app open / daily / weekly / specific time) and permissions.

### Prompt

A prompt is a reusable text template for the AI. Create it once and use it whenever you want to launch the same kind of instruction.

**How to create a prompt:** slash menu → `/Prompt`.

Useful for: "summarize this in 3 bullets", "extract the tasks", "translate to English", "improve the formal tone".

---

## 5. The Slash Menu — quick actions

Type `/` in any node to open the quick-actions menu. You can keep typing to filter: `/ta` shows all options containing "ta".

### Text

| Action | Result |
|---|---|
| Text | Normal text node (default) |
| List | Node with a visual dash and extra indentation |
| Heading 1 | Large header (H1) |
| Heading 2 | Medium header (H2) |
| Heading 3 | Small header (H3) |
| Quote | Quote block with a side bar |
| Code | Code block with a monospaced font |
| Divider | Horizontal dividing line |

### Objects

| Action | Result |
|---|---|
| Note | Turns the node into a note (base type) |
| Task | Turns the node into a task with a checkbox |
| Event | Turns the node into an event with a time |
| Resource | Turns the node into a resource (external link) |
| Expand | Turns a task into an expandable container |

### AI

| Action | Result |
|---|---|
| Agent | Creates an autonomous agent node |
| Prompt | Creates a reusable prompt template |
| Summarize | Summarizes the node's content and its children |
| Find tasks | Extracts tasks from the node's text and creates them as children |

### Views

| Action | Result |
|---|---|
| Inline list | Shows the children in list (tree) view |
| Inline table | Shows the children in table view with columns |
| Inline kanban | Shows the children in a kanban board by status |
| Inline calendar | Shows the children in calendar view |

### Move to date

Type `/move to Friday` or `/move to June 15` → the slash menu enters date mode with predictive ghost text showing the interpreted date. Press `Tab` or `Enter` to apply the date. The node moves to the indicated day in the Agenda and a mirror is left in the original position.

You can also use the shortcuts:

| Action | Result |
|---|---|
| Move to today | Moves the node to today in the Agenda |
| Move to tomorrow | Moves the node to tomorrow |
| Move to next week | Moves to the first day of next week |

### Tree

| Action | Result |
|---|---|
| Expand all | Expands all child nodes recursively |
| Collapse all | Collapses all child nodes |
| Count children | Shows how many descendants the node has |
| Duplicate | Creates an exact copy of the node with all its children |
| Mirror | Creates a mirror of this node somewhere else |

---

## 6. Unified capture — Space and global search

Pressing `Space` (with focus on the tree and no node being edited) or the `+` button opens the **unified capture modal**. This modal does everything in one place: creates nodes, searches, navigates and gives quick access to your usual starting points.

### Empty view — quick access

When it opens with no text, it shows four shortcuts:

| Option | Action |
|---|---|
| **📅 Today** | Navigates to today's note |
| **📅 Tomorrow** | Navigates to tomorrow's note |
| **◈ Filters →** | Opens the list of your saved filters |
| **🧠 Contexts →** | Opens the list of all your contexts |

Nodes marked as **Favorites** also appear here for quick access.

### Search with text

Start typing and Fromly searches in real time:

- **A note's name** → navigates directly to the node
- **A context's name** (e.g. "work") → opens that context's filter + side panel
- **"contexts"** → shows all contexts to select with ↑↓ and Enter
- **"filters"** → shows all saved filters
- **"today" / "tomorrow"** → quick access to those days
- **Free text** → if there's no match, "Create: [your text]" appears to create a new node

Search ignores accents and case.

### Create with flags

When creating any item, add flags at the end of the text:

- `-t` → creates a task
- `-e` → creates an event
- `-f` → marks as favorite

### Prediction ghost text

While you type in the modal, ghost text may suggest dates, node types or contexts based on what you write. Press `Tab` to accept the suggestion.

### Space activation rule

- If the active input in the tree **is empty**: `Space` opens the capture modal.
- If the active input **has text**: `Space` inserts a normal space.

The `⌘K` shortcut is equivalent to `Space` and works as an always-available alternative, even when text is being edited.

---

## 7. The Sidebar

The sidebar is the left navigation panel. It has two main sections:

### PANELS

Your custom dynamic views. Each panel is a saved filter or a link to a specific node. They update automatically, always showing the current state.

- **Reorder**: drag panels with the `⠿` handle that appears on hover.
- **Delete**: `×` icon on hover.
- **Create**: activate a filter with `⌘F` and press the 📊 icon in the results bar to save it as a panel.
- **Select**: clicking a panel activates the filter in the central view. Escape deactivates it and returns to the agenda.

### CONTEXTS

A list of all your contexts, accessible with one click. Contexts are work tags that group related nodes across the tree.

- **Click a context**: filters the central tree showing all nodes with that context, and opens the context content (editable) in the right panel.
- **Chevron ›**: if a context has sub-contexts with content, you can expand them.
- **+ button**: creates a new context directly from the sidebar. Type the name and press Enter.
- **Escape**: deselects the active context and closes the right panel.

### The ··· menu (top right)

Access to system tools that don't live in the main tree:

- **Agents** — your autonomous AI agents.
- **Templates** — reusable templates.
- **Trash** — deleted nodes. You can restore them (right-click → Restore) or delete them permanently.
- **Settings** — account, AI, integrations, appearance, backup.
- **Sign out**.

---

## 8. The top bar and the right panel

### Top bar

The top bar always shows where you are and gives you access to the controls of the current view.

- **Navigation breadcrumb**: shows the path from the root node to the current node. Each item is clickable to return to that level. Example: `Tree > Work > Web project > Meeting June 4`.
- **View icons**: switch between list, table, kanban or calendar for the current node.
- **Dark mode** (moon icon): toggles between light and dark theme.

### Right panel — four modes

The right panel is activated by the icons in the top-right bar:

| Icon | Panel | Shortcut |
|---|---|---|
| ✦ | **Magic** — AI assistant with chat and voice | `M` |
| ⌘F | **Filter** — smart filters with chips and results | `⌘F` |
| P | **Planner** — daily timeline and year view | `P` |
| (context) | **Context content** — appears when you click a context in the sidebar | — |

Each mode takes over the right panel. To close the panel, press `Escape` or click the active icon again.

---

## 9. The @ system — Contexts

Contexts are tags that group related nodes beyond the tree's hierarchy. Imagine you have work projects spread across different branches: with the `@work` context you see them all together at once without reorganizing anything.

### Assign a context to a node

Type `@` in any node. The picker opens with the available contexts. Select the one you want to assign. The node is tagged with a visible purple chip next to the text.

You can assign more than one context to the same node. It also works in unified capture (Space): type `@` and Fromly suggests contexts as ghost text.

### Create and manage contexts

**From the sidebar**: press `+` in the CONTEXTS section. Type the name and press Enter. The new context appears in the list and opens in the right panel ready to add content.

**From the context itself (right panel)**: when you select a context, it opens as an editable outliner in the right column. Add children to describe the context, store instructions for the AI or create sub-sections.

Contexts are special root nodes with `_tagDefinition` internally. They aren't system folders: they're normal tree nodes that Fromly assigns a tag function to.

### Filter by context from the sidebar

Click any context in the sidebar. The central tree filters to show all nodes with that context assigned, and the right panel shows the context content.

Press **Escape** to deactivate the filter and return to the agenda.

### Filter by @context in the filter field

In the filter bar (`⌘F`), type `@work` (or your context's name) to see all nodes with that context assigned. On iOS, the purple context chips in the Explore tab do the same with a tap.

### The AI Profile

Inside the **AI Profile** context you can write personal information that the AI always loads: who you are, what you do, your active projects, communication preferences. The AI uses it automatically in every conversation without you having to repeat it.

### Auto-classification with AI

Fromly can automatically suggest the most appropriate context for each note or task.

**Real-time badge:** when you create or edit a node without an assigned context, a small `✦ ContextName` badge appears next to the text. Click it to confirm the suggested context or pick another. Fromly learns from your corrections.

**"Unclassified" filter:** in the context list a special **"Unclassified"** entry appears with the number of pending nodes. Clicking it filters the tree to show only those nodes.

**Classify all at once:** under the "Unclassified" filter the **"✦ Classify all"** button appears. Press it to have Fromly analyze all historical nodes without a context in the background. Progress shows in a bar with "Classifying… X/Y". You can cancel at any time with the ✕ button.

Classification uses AI (Claude Haiku) without consuming your plan's tokens.

### Why use contexts

Contexts let you cross the tree by dimension. Your work tasks are spread across projects in different branches, but with `@work` you see them all together. Without moving anything, without duplicating anything.

---

## 10. Favorites

Favorites are a quick bookmark for the nodes you use frequently.

**Mark as favorite:** press `⌘⇧F` on any node to toggle favorite. The node is marked with a gold star.

**Access favorites:** open unified capture (Space) without typing anything. Favorites appear in the **Favorites** section of the modal's empty state.

**Filter favorites:** use the `favorite` operator in the filter field (`⌘F`) to see all your marked nodes.

**Use on iOS:** in the Search tab, the empty state shows favorites directly for immediate access.

---

## 11. The Agenda and the node system

### The Agenda — main view

Fromly's home view IS the Agenda. When you open the app you see the years directly (2026, 2027...). Navigating is as simple as expanding year → month → day.

The Agenda organizes time in the hierarchy: **Year → Month → Day**. Each day has its own note with:

- The tasks due that day (including overdue ones still pending).
- The day's events (synced with Google Calendar if connected).
- A free writing area for the day's notes, captures and ideas.

**Go to today:** press `H` or the calendar icon in the top bar.

**Navigate to another day:** expand the years/months/days tree. You can also navigate from the Planner (key `P`) by clicking any day in the Year view.

**Move tasks to another day:** slash menu → `/Move to today`, `/Move to tomorrow` or `/Move to date...`. Fromly places the node on the target day and leaves a mirror at the origin.

Nodes with pending tasks inside show the 📁 icon (live container) even when collapsed, indicating there's pending work inside.

### System nodes (··· menu)

The following items are system items, accessed from the `···` menu (top right):

**🤖 Agents** — autonomous AI agents. When you open an agent the controls appear: Active/Paused toggle and a ▶ Run button.

**📋 Templates** — reusable templates. To use one: slash menu → `/Template`.

**🗑 Trash** — deleted nodes. The hierarchy is preserved.
- Right-click → **Restore** — returns the node to its original location.
- Right-click → **Delete permanently**.

**⚙️ Settings**:
- **Account**: email, password, current plan.
- **AI**: active model, your own API keys (Pro/Lifetime), agent configuration.
- **Predictions**: keywords to recognize tasks and events.
- **Integrations**: Google Calendar, MCP connection with Claude.
- **Data / Backup**: snapshots, restore, export JSON or Markdown.
- **Appearance**: light/dark theme, density, accent color.

---

## 12. Smart filters

Filters let you see exactly what you need at any moment, without reorganizing the tree.

Filters are **fully reactive in real time**: if you move a task to tomorrow, change its status or assign it a date, the filter updates instantly without refreshing. Nodes that stop matching the filter leave the result with a slide-out animation to the right.

**Activate:** `⌘F` or the filter icon in the top bar (right panel).

### Natural language

You can write directly in natural language and Fromly translates your query into the technical operators automatically:

- "today's and past tasks" → `task today or overdue`
- "resources without a date" → `resource no-date`
- "everything this week" → `week`
- "pending favorites" → `favorite pending`

Fromly uses AI (Haiku, free for all users) to interpret the query. It does not consume your plan's tokens.

### Available operators

| Operator | Shows |
|---|---|
| `today` | Nodes dated today or today's diary note |
| `tomorrow` | Nodes dated tomorrow |
| `week` | Nodes dated within the current week |
| `month` | Nodes dated within the current month |
| `past` | Nodes dated before today |
| `future` | Nodes dated after today |
| `no-date` | Nodes without an assigned due date |
| `with-date` | Nodes with any date assigned |
| `task` | All nodes that are tasks |
| `pending` | Pending (uncompleted) tasks |
| `done` | Completed tasks |
| `overdue` | Tasks whose date has passed and aren't done |
| `loop` | Notes/nodes with pending tasks inside (📁 live container) |
| `note` | All note-type nodes |
| `event` | All events |
| `resource` | All resources |
| `file` | Nodes with attached files (PDF or others) |
| `link` | Link/URL-type nodes |
| `diary` | Diary-type nodes (day notes) |
| `favorite` | Nodes marked as favorite |
| `@context` | Nodes with that context assigned |
| `#tag` | Nodes containing that tag in the text |
| `[[name]]` | Nodes that reference that node by name (wiki-link) |
| `node:ID` | A specific node and all its descendants or references |

**Combinations:** operators are combinable. Separate several operators with a space (implicit AND) or use `or` for OR:

- `today pending` → pending tasks dated today.
- `@work pending` → pending tasks in the work context.
- `today pending @work` → pending tasks for today in the work context.
- `overdue @personal` → overdue tasks in the personal context.
- "today's or tomorrow's tasks" → `task today or task tomorrow`.

Search ignores accents and case.

### The `loop` operator — live containers

The `loop` operator filters nodes that have pending tasks inside. These nodes show the 📁 icon (live container) in the tree even when collapsed.

It's ideal for seeing which projects, areas or notes have unfinished work: filter by `loop` and you see all active containers at a glance. A node leaves the `loop` filter when all its internal tasks are marked done.

It doesn't apply to: events, resources, diary entries or temporary nodes.

### Filter from Magic Chat

If you open Magic Chat and describe what you want to see ("show me overdue tasks", "filter by this week's resources"), Magic detects the intent and applies the filter directly without you having to open `⌘F` or type operators.

### Suggestion chips

Below the filter field, quick-access chips appear: **Today**, **Tasks**, **Pending**, **This week**, **Overdue**, **Events**. Click to activate them directly.

### Result views

Results can be shown in four modes. Switch with the bar icons:

| View | When to use it |
|---|---|
| **List** | Inline-editable filtered tree. Standard view. |
| **Table** | Columns with properties (status, date, priority). Ideal for many nodes with metadata. |
| **Kanban** | Board with columns by status or priority. Drag & drop between columns. |
| **Calendar** | Monthly view with nodes distributed by due date. |

### Save a filter as a panel

When you have a useful filter, save it to the sidebar with the 📊 button in the results bar. It appears in your panels and is available with one click from any view.

---

## 13. Panels (📊)

Panels are dynamic views pinned in the PANELS section of the sidebar. They update automatically whenever you open them. There are two types:

**Node panel**: shows that node and all its descendants and references. Like zooming into that node but always accessible from the sidebar.

**Filter panel**: the result of a saved filter. For example: "my tasks for today", "@work pending", "#reading". Each time you open it, it shows the current state.

### How to create a panel

**From an active filter:** with the filter on screen, press the 📊 icon in the results bar.

**From a node:** right-click the node → "Add to panels". The panel shows that node and all its descendants together with any reference to the node.

### Manage panels

Hover over a panel in the PANELS section to see the action buttons:

- **✏ Rename**: inline name editing. Enter confirms, Escape cancels.
- **× Delete**: deletes the panel permanently.
- **Reorder**: drag with the `⠿` handle.
- **Activate**: clicking the panel applies it in the central tree. Escape deactivates it.

Panels sync across all your devices.

---

## 14. Inline views

Any node that has children can show those children in four different display modes. Inline views don't change how data is stored, only how you see it.

Activate the view from the slash menu (→ Views) or from the icons in the node's top bar.

### List (default)

The classic nested tree. Each child appears as a node with the ability to expand its own children. Inline editable.

### Table

Each child of the node is a row. The columns are the properties: status, due date, priority, and any custom column you create.

**Custom columns:** click "+" in the table header to add a column. Available types: text, number, select, multi-select, date, checkbox, URL, tag, task, reminder.

- Column headers are clickable to sort (ascending/descending/original).
- You can rename, reorder and delete columns.
- Columns are shared across all views of the same node (the table and the kanban see the same data).

### Kanban

Children appear as cards in columns. By default the columns are the statuses (To do, In progress, Done). You can group by:

- Status
- Priority
- Any select-type column

Drag cards between columns to update the value directly. Click "+" inside a column to create a new node with that status/value already assigned.

### Calendar

Children with a due date appear on the matching day of a monthly calendar. Click any day to create a new node with that date.

### Multi-views: save more than one view per node

You can create multiple views for the same node. Press the "+" next to the view tabs to add a new one. Each view independently saves its type, configuration and name. You can rename, duplicate and delete views.

---

## 15. Magic — Fromly's intelligence

Magic is Fromly's intelligence layer. The idea isn't "to have AI": it's for **Fromly to understand you**. You write the way you think and Fromly handles the rest — it understands what each thing is, orders it, remembers who you are and anticipates. All in the background, no menus, nothing for you to maintain. The goal is to remove the friction between what you think and what gets written down, and to do it fast.

Magic has three faces:

1. **It understands you as you write** — classifies, dates and detects the type of each note without you touching a menu (see below and section 9).
2. **It remembers you** — builds a profile of you and per-context knowledge from what you write ("What Fromly knows").
3. **It acts for you** — Magic Chat, recorder, scheduled agents.

### How Fromly understands you — the intelligence layer

**Automatic contexts with hierarchy.** As you write, Fromly classifies each note into the context it belongs to (work, family, a specific project), understanding the **hierarchy** of contexts and sub-contexts. A note about "La Isla" goes to "Work › La Isla", not to a flat tag. If a context that doesn't exist is needed, Fromly can create the sub-context in the right place. The context badge appears next to the node with the suggestion; one click confirms or changes it. Contexts and structural nodes (Agenda/Year/Month) never show a badge.

**"What Fromly knows" per context.** Each context accumulates its own living knowledge, in three sections: **Keywords**, **People** and **Frequent topics**. Fromly extracts it only from the notes you classify there and keeps it up to date: when you add something new, it **merges** the new information with what was already there, without duplicating, instead of rewriting everything. The update is proactive (when classifying nodes) and it learns again if you keep editing an already-classified node. It only stores new information: if there's nothing to add, it touches nothing. You open a context and Fromly already knows what it's about.

**Your profile — Fromly remembers you.** Fromly builds a profile of you from what you write: your projects, the stable people in your life, your long-term goals and assets. It filters the noise — **it only keeps what lasts**, not the day's tasks or temporary issues — and synthesizes instead of copying literally ("I'm getting married" → "Has marriage plans with their partner"). Learning is saved even if you leave the node, navigate to another page or the node is created by an agent. Open your profile from **CONTEXTS → My profile**.

**Classify everything old.** In the contexts panel, under "Unclassified", the **"Classify all"** button processes all old nodes without a context at once, with a progress bar and the option to cancel.

### Magic Chat — voice and text assistant

Magic Chat knows your tree, your tasks, your contexts and your personal profile.

**Open Magic:**
- ✦ icon in the top-right bar
- `M` key (with no active input)

Type in the field and press Enter to send.

**Record with voice:** hold `R` while you speak. On release, it transcribes and sends. The animated waveform shows it's listening.

**Where Magic creates things:**
- Reminders and generic tasks → go to **today's diary**
- If you're in a project note and ask to add something related → goes to **that note**
- If it's not the right destination: **"Move it to this note"** or **"Move it to today"** button next to Undo

**Navigate directly:** say "show tomorrow's tasks" or "open the projects note" — Magic navigates directly with no intermediate text.

### Prompts — conversation modes for Magic

**Prompts** (⚡ icon in the top bar) are conversation modes you create that change how Magic replies to you. A prompt is a node: its **content is its children**, where you write the instructions (you edit it like any note).

**Create and edit:** open the ⚡ Prompts panel, press "New prompt…" and write its instructions inside. Fromly ships two examples: **Daily diary** and **Brainstorming**.

**Variables** (Fromly fills them in when you use the prompt): `{{date}}`, `{{name}}`, `{{current_context}}`, `{{today_notes}}`, `{{profile}}`. In the prompt's properties panel, clicking a variable inserts it where your cursor is.

**How it activates in Magic (three ways):**
- **Manual**: type `/` in Magic and choose the prompt; or the ✨ button on iPhone.
- **Automatic by context**: in the prompt's properties you choose "activate in the daily note / in tasks / in a context". When you open Magic from there, it activates on its own (chip labeled "auto").
- **Suggestion**: as you write, if the text matches a prompt, Magic activates it on its own. You can always remove it with the **×** on the chip.

Example of the "Daily diary" prompt: when you open Magic from your note for today, Magic becomes your diary companion — it listens, replies calmly and, if you ask, summarizes your day.

**What it can do:**
- Create tasks, notes and events in your tree
- Navigate directly to any note or diary day
- Summarize the content of any node
- Search for information in your notes
- Organize, rewrite, prioritize
- Apply filters directly by describing what you want to see
- Run bulk actions

**Automatic context:** the AI automatically loads:
- The open node with its title, body and children.
- Today's diary with your tasks and events.
- Your pending tasks.
- The active contexts (@) with their instructions.
- Your AI profile.

### Teaching Magic — continuous learning

Magic learns from your corrections and adapts to you progressively.

**How to teach:** right-click any node → **Teach Magic**. Options depend on the node:
- "This isn't a task / event"
- "This should be a task / event"
- "The context is wrong"
- "This interpretation is correct ✓"
- Free field: "Magic, remember that..."

**See what it learned:** Settings → Magic → "What Magic has learned about you" section. Edit or delete any item individually.

### Ghost text — predictions while you write

While you write in any node, Fromly shows suggestions in light gray (ghost text):

- If it detects an **action verb** or an expression that sounds like a task → it suggests turning the node into a task. Press `Tab` to accept.
- If it detects a **date in natural language** (`tomorrow`, `on Monday`, `June 15`) → it suggests that date as the due date. Press `Tab` to accept. Pressing `Enter` afterwards creates a sibling node below.
- If the text looks like an **event** (time, meeting, call) → it suggests the event type.

Customize which words trigger these suggestions in **Settings → Predictions**.

### Variable codes in prompts

Inside any agent or prompt you can use variables that Fromly resolves before sending to the AI:

| Code | Replaced by |
|---|---|
| `{{date}}` | Full current date |
| `{{short_date}}` | Date in short format (06/04/2026) |
| `{{day}}` | Day name (Thursday) |
| `{{week}}` | Week number of the year |
| `{{month}}` | Month name |
| `{{year}}` | Current year |
| `{{time}}` | Current time |
| `{{note}}` | Current node content |
| `{{tag}}` | Current node's tags/contexts |

To insert a code in the editor: type `{{` and a picker opens with all available variables.

### Autonomous agents

Agents are Agent-type nodes that run on a schedule or manually. They can read your tree, create notes, run internet searches and modify nodes.

Agents are configured in their properties panel:

- **Prompt**: what it should do.
- **Schedule**: when it triggers (on app open, daily, weekly, specific time).
- **Allowed actions**: create nodes, modify nodes, search the internet.

**Agent examples:**

- Every night at 11:30 PM: "Summarize today's diary in 3 key points and add them as children".
- Every Monday: "List the coming week's tasks and create a summary in the Agenda".
- On app open: "Show overdue tasks and ask what to do with each one".

---

## 16. The Planner

The Planner is Fromly's calendar view. Press `P` (with no active input) or the planner icon in the top bar to open and close it. It takes over the right panel.

### Two views

**Day view**: a 24-hour timeline with your tasks and events split into two zones:

- **"All day" strip** (top): shows the day's tasks that have a date but no assigned time, and Google Calendar all-day events. It's the starting point for planning: here you have everything left to place in time.
- **Hours timeline** (bottom): shows tasks and events with a specific time. The blocks indicate their start time and can be resized to adjust the duration.

**Year view**: the 12 months of the year in a responsive grid. Days with tasks or events appear with a dot. Click any day to navigate to that day's note in the Agenda.

**Navigation**: ‹ › buttons to go forward or back. **Today** button to return to the current day.

### Data model — the node never moves

The Planner doesn't move or duplicate your tree nodes. **The node always stays in its original place in the tree.** Using the planner only assigns or changes the node's time.

### Planning a task — assigning a time

**From the tree to the timeline**: drag any node from the central tree onto the planner's timeline. It's assigned the time of the point where you drop it. The node stays in the same place in the tree — it has only gained a scheduled time.

**From the tree to "All day"**: drag a node to the top strip to assign it only a date (no time). It appears in the all-day strip until you assign it a time.

**From "All day" to the timeline**: drag an item from the all-day strip onto the timeline to assign it a specific time. From then on it appears in the hours grid.

**Click an empty hour**: creates a new node directly at that time. Type the title and press Enter.

**Resize**: drag the bottom edge of any block to change its duration.

**Move a block**: drag the block to another time. The purple line indicates the block's real start while positioning it.

### Google Calendar sync when planning

If you have Google Calendar connected, the planner creates and updates events automatically:

- **Assign a time** to a task → an event is created in Google Calendar.
- **Move or resize** the block → the Google Calendar event updates instantly.
- **Remove the time** (right-click → "Remove time") → the Google Calendar event is deleted.

Google Calendar events are also shown in the planner with their original color and can be moved and resized directly from Fromly.

### Right-click on a block

- **Go to node** — navigates to the node in the tree.
- **Remove time (→ all day)** — removes the time but keeps the date. The node returns to the all-day strip.
- **Remove from planner** — removes the date and time entirely.
- **Color** — changes the block's color in the planner.

### Zoom

- **Vertical zoom** (hours scale): drag the hours axis up to zoom in or down to zoom out. Also with Shift + mouse wheel.
- **Horizontal zoom** (day columns): drag the day header to see more or fewer days at once (between 2 and 7).
- **Reset zoom**: ↺ button in the planner bar.

Press **Escape** to close the planner.

---

## 17. Google Calendar

### Connect

Go to **Settings → Integrations → Google Calendar** and follow the authorization process. You only need to do it once.

### How it works

- Your Google Calendar events appear in the Planner with each calendar's color.
- Creating an event in Fromly also creates it in Google Calendar.
- Editing or deleting an event works in both directions: what you change in Fromly is reflected in Google Calendar, and vice versa.
- Your Google calendar colors are respected.
- Sync takes your local time zone into account.

### Events in the Agenda

If you have Google Calendar connected, the day's events appear on the day node in the Agenda, next to your tasks. In the Planner, Google events are shown with their original color.

---

## 18. Moving nodes

There are several ways to move a node elsewhere:

**Drag & drop:** drag from the `⋮⋮` handle (visible on hover) and drop on the destination.

**Slash menu:**

- `/Move to today` → moves to today's node in the Agenda.
- `/Move to tomorrow` → moves to tomorrow's node.
- `/Move to next week` → moves to the first day of next week.
- `/Move to date…` → type any date in natural language with predictive ghost text.

**Right-click → "Move to..."** → opens a search box to choose the destination.

**Keyboard shortcuts:**

- `⌘↑` / `⌘↓` → moves the node up or down among its siblings.

When you move a node to another day, the node physically moves to the destination and the system creates mirrors automatically so you don't lose track:

- At the **origin** a mirror of the moved node is left, with a visual reference to the destination day.
- At the **destination**, mirrors of the original context are created so the node arrives with its context preserved.
- Mirrors show the same icon as the original node with reduced opacity to distinguish them.

---

## 19. Fromly for iPhone

The iPhone app is available on the App Store. It's organized into five tabs accessible from the bottom bar:

### Tab 1 — Explore

Quick filtering view by multi-select chips. Select combinations of chips to see exactly what you need:

**Type:**
- Note, Task, Event, File, Link

**Date:**
- Today, This week, This month, Past, Future

**Status:**
- Pending, Done, No date, Loop

**Contexts** (purple chips): filter by the context assigned to each node.

**Saved filters** (blue chips with 🔖): your custom filters saved from web or Mac, available with a tap.

Below the chips the result appears with the number of nodes found and the full list. Tapping any result opens the **node detail view** (IOSNodeDetailView) with the "..." menu for actions: edit, move, mark done, etc.

### Tab 2 — Search

Real-time full-text search with keyboard auto-focus. Type any term and Fromly searches your whole tree instantly.

The empty state (before typing) shows your **Favorites** for immediate access to the nodes you use most.

### Tab 3 — Agenda

Daily and weekly view with the day's tasks and events. Navigate between days with a swipe or the header controls.

### Tab 4 — Planner

Task planner with a timeline. Shows the day's tasks with and without a time, and lets you reorganize the day.

### Tab 5 — Settings

Account management, AI model, integrations (Google Calendar), appearance and import.

### Sync

Everything you capture on iPhone appears on web and Mac in real time. Changes travel only as deltas (only what changes, not the entire database).

---

## 20. Backup and privacy

### Automatic backup on the server

Fromly creates a full snapshot of your data on the server every 2 hours (only when there are changes). The last **12 snapshots** are kept (~24 hours of continuous history).

You can create a manual snapshot whenever you want: **Settings → Data → Backups → "Create snapshot now"**.

### Restore a backup

In **Settings → Data → Backups**, choose any snapshot from the list and press "Restore". Before overwriting your data, the server automatically creates a safety snapshot (`pre-restore`) so you can undo if you make a mistake.

### Export your data

In **Settings → Export** you can download all your data at any time:

- **JSON**: structured format with all metadata (for programmatic use or migrations).
- **Markdown**: a folder of `.md` files, one per node with a body. Readable in any editor.

Your data isn't locked into Fromly. The export is complete, unrestricted and works on the free plan.

### Privacy

- The AI only accesses content that's in the active conversation's context: the open node, its children and the contexts you have active. It doesn't scan the whole tree automatically.
- The local backup on Mac is stored in `Application Support/Fromly/Backups/` on your own computer.

---

## 21. Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Unified capture / global search | `Space` |
| Global search (alternative) | `⌘K` |
| New sibling node | `Enter` |
| Indent node | `Tab` |
| Outdent node | `Shift+Tab` |
| Accept ghost text suggestion | `Tab` |
| Dismiss ghost text suggestion | `Esc` |
| Move node up among siblings | `⌘↑` |
| Move node down among siblings | `⌘↓` |
| Toggle node ↔ task | `⌘Enter` |
| Toggle favorite | `⌘⇧F` |
| Smart filter | `⌘F` |
| Open/close planner | `P` |
| Open/close Magic | `M` |
| Record with voice in Magic (hold) | `R` |
| Slash menu | `/` |
| Go to today | `H` |
| Deselect context / clear filter / close panel | `Escape` |
| Bold | `⌘B` |
| Italic | `⌘I` |
| Undo | `⌘Z` |
| Redo | `⌘⇧Z` |
| Select all visible nodes | `⌘A` |

---

## 22. Settings

### Account

- **Email**: read-only (changing it would break Google/Apple sign-in).
- **Password**: you can change it (asks for the current one).
- **Subscription**: your plan and, if you have an active subscription, renewal, «Cancel» and «Manage billing» (customer portal). On the free plan you'll only see «Upgrade»; on a lifetime license, nothing to manage.
- **Delete account**: protected — asks to confirm with your password (or your email if you sign in with Google).

### Language

Fromly is available in Spanish and English. The language is detected automatically from your browser or operating system settings.

To change it manually: **Settings → 🌐 Language** and choose between Español and English. The change applies immediately without reloading.

### Appearance

- **Theme**: light or dark.
- **Accent color**: 12 colors for the interface (purple by default).
- **Calendar and Planner**: start and end of the day (7:00–23:00 by default); hours outside the range are hidden in the calendar and the planner.

### AI

- **Included tokens**: your AI token balance.
- **Your own API keys**: only with a **lifetime license** can you use your own Anthropic/OpenAI/Google keys (usage goes to your account).
- AI **language**: Spanish, English or automatic.

### Magic

Everything Fromly knows about you lives in your **AI Profile** (an editable note). From here, «View and edit» opens what Fromly has learned on its own, and what it knows **per context** is listed. Cleanup is automatic. Magic is always active (there are no switches).

### Shortcuts

Keyboard shortcuts (the configurable ones are reassigned with a click) and text expansion.

### Google

Connect/disconnect Google Calendar and see the sync status.

### Accessories

API token, menu bar (Mac), Apple Shortcut, Raycast, Chrome and Claude. See §23b.

### Data / Backup

- Automatic snapshots every ~2h; create a manual snapshot; restore a previous one.
- **Export** a full copy in JSON or Markdown.

### Import

Fromly imports from other apps with a **step-by-step wizard**. Go to **Settings → Import** and choose the source:

- **Obsidian** — upload the vault folder (.md). The subfolder structure is preserved.
- **Notion** — export to «Markdown & CSV», unzip the .zip and upload the folder.
- **Apple Notes** — convert them to .txt/.md first and upload them.
- **Markdown / text** — one or more .md/.txt files, or a whole folder.
- **Fromly (JSON)** — a backup exported from Fromly.

Imported content is created in a **«📥 Imported [date]»** node (with headings → sections and nested bullets), so you can review and reorganize it without touching your current notes.

### Templates

A template is a **child node of 📋 Templates**: you edit it like any note. When you open it, in the right column you can:
- **Auto-apply in daily note**: every new day starts with its content.
- **Recurring note**: every X days/weeks/months (and on the day), Fromly inserts the template as a **section within that day's note** (ideal for weekly/monthly review).

---

## 23. Connecting with Claude (MCP)

Fromly is in the **official Claude connectors directory** (Anthropic). Once connected, Claude automatically saves documents, tasks and conversation summaries to your vault without you having to ask.

### How to connect — Claude directory (recommended)

Works from any device: claude.ai, iPhone, Android and Claude Desktop.

1. Open Claude (claude.ai, the iPhone/Android app or Claude Desktop).
2. Go to **Settings → Connectors**.
3. Search for **"Fromly"** in the directory.
4. Press **Connect** and sign in with your Fromly account via OAuth.
5. Done — Claude can save notes and tasks to your vault from that moment.

You don't need to install extensions, copy tokens or enter URLs manually.

### How to connect — Claude Code (CLI)

For Claude Code (the terminal CLI), set up the connection manually. First generate your token in **Fromly → Settings → Accessories**. Then add the `from` entry to `~/.claude.json` under the `mcpServers` key:

```json
"mcpServers": {
  "from": {
    "type": "http",
    "url": "https://from-server-production.up.railway.app/mcp",
    "headers": { "Authorization": "Bearer YOUR_TOKEN" }
  }
}
```

Restart Claude Code. Fromly works automatically from that moment.

### What Claude does with Fromly automatically

- **Saves documents and analyses** it generates during the conversation.
- **Creates tasks** when you mention pending actions.
- **Saves session summaries** when you say "fin".
- **Loads area context** if you mention projects configured in your AI Profile.
- **Searches your vault** before answering to give you real context.

**Examples:**

```
"What tasks do I have pending for today?"
"Add a task to call Adrián tomorrow at 10"
"Search my notes for everything related to project X"
fin  →  Claude saves the conversation summary to Fromly automatically
```

---

## 23b. Accessories — capture from anywhere

Fromly doesn't force you to have the app in front of you. These accessories send whatever you have to your **note for today**, and Fromly's intelligence classifies it (type, date, context). All of them — except the menu bar — connect with your account's **API token**.

### The API token
It's the key Raycast, Chrome and Claude Code (CLI) use to talk to your Fromly. It's generated and copied in **Settings → Accessories** (it's the same token for all three; regenerating it invalidates the previous one). It lives for 1 year. For Claude on web, iPhone, Android and Desktop, you don't need the token — use the connectors directory (see section 23).

### Menu bar (Mac)
Fromly lives in the Mac menu bar with its icon (the tree).
- **Click the icon** (or menu → *Quick capture*) → opens a Spotlight-style capture window: type a note, task or event and it drops into your note for today. Fromly detects the type, date and any `@contexts` you write.
- Closing the main window does **not** close Fromly: it stays available in the menu bar.
- **Hide it**: Settings → Accessories → turn off "Show icon in the menu bar", or right-click the icon → *Hide this icon*.

### Apple Shortcut (global key)
To capture from **any app** with a single key.
1. In **Settings → Accessories → Apple Shortcut** press **"Install Apple Shortcut"** (opens the ready-made shortcut in the Shortcuts app) and add it.
2. In the Shortcuts app, open the **shortcut's settings → Hotkey** and assign the combination you want (for example ⌃⌥Space).
3. When you press it, it asks for the text and saves it directly to your note for today.

Under the hood it uses the `from://capture?text=…&silent=1` link. If you prefer to build it by hand, create a Shortcut with the *"Open URL"* action using that link and replace `[Text]` with *"Ask for text"* or *"Clipboard"*.

### Raycast
Fromly extension for [Raycast](https://raycast.com):
- **Create in Fromly** — type and it drops into your note for today (Fromly decides whether it's a note, task or event).
- **Search Fromly** — searches your whole vault and opens the result in the app or on the web.
- **Open Today's Note** — opens your daily note.

Install it from the Raycast Store and paste your API token into its preferences (Settings → Accessories → Raycast → copy token).

### Chrome
Fromly extension for Chrome:
- **Click the icon** → saves the current tab's URL to your note for today (it becomes a link).
- **Select text → right-click → "Send selection to Fromly"** → saves it as a node.

Install it from the Chrome Web Store, open its **Options** and paste your API token.

### Connecting with Claude (MCP)
The integration with Claude Desktop/Code is described in the previous section — it uses the same API token.

---

## 24. Plans and pricing

| Plan | Price | Includes |
|---|---|---|
| **Free** | €0 | Up to 1,000 synced nodes, no AI, no files |
| **Trial** | 7 days free | Full Pro access for 7 days (card required) |
| **Pro Monthly** | €7/month | Unlimited nodes, full AI, file attachments, public notes |
| **Pro Annual** | €49/year (€4.08/month) | Everything in Pro Monthly, billed annually |
| **Lifetime** | €149 one-time | Everything in Pro forever + 3M AI tokens included |

### 7-day free trial

You can try all Pro features for 7 days at no cost. A credit card is required to start the trial; if you don't cancel before the period ends, the subscription automatically switches to Pro monthly.

During the trial you have full access to AI, unlimited nodes, file attachments and integrations. The top bar shows a **"Free trial · X days left"** badge so you know how much time remains.

To cancel at any time: **Settings → Account → Subscription → Cancel** or from [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing).

Manage your subscription in **Settings → Account → Subscription** or at [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing).

After completing payment, your plan updates automatically in the app within seconds. No need to reload or sign out.

If you have a beta code or coupon, enter it at checkout when buying. 100% coupons activate the plan just like a normal payment.

---

## 25. Telegram channel — @FromMagicBot

Subscribe to Fromly's official Telegram channel to get weekly tips on how to get the most out of the app: shortcuts, workflows, use cases with Magic and news.

**How to join:** search for **@FromMagicBot** on Telegram or use the link at fromly.app.

Tips are sent automatically with no interaction needed. It's a broadcast channel, ideal for learning Fromly gradually without flooding your inbox.

---

## Frequently asked questions

**Can I use Fromly offline?**
Yes. The Mac and iPhone apps work offline. Changes sync automatically when you regain connection.

**What happens if I go over 1,000 nodes on the free plan?**
You can keep reading your notes, but you can't create new ones until you delete nodes or upgrade to Pro.

**Where is my data stored?**
On Fromly's servers (Europe) and, on Mac, also in a local backup on your own computer. You can export everything in JSON or Markdown from Settings at any time.

**Does the AI read all my notes?**
No. The AI only accesses content that's in the active conversation's context: the open node, its children and the contexts you have active. It doesn't scan the whole tree automatically.

**Can I import my notes from Obsidian, Notion or other apps?**
Yes. Go to **Settings → Import**. Fromly accepts exports from Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes and Markdown folders in general.

**Do mirrors (⬡) sync in both directions?**
Yes. Editing the mirror edits the original, and any change to the original is reflected in all its mirrors immediately.

**Can I share a note with someone who doesn't have Fromly?**
Yes. Right-click the node → "Publish". Fromly generates a public URL like `fromly.app/p/...` with the rendered content. Only those who have the link can see it.

**How does sync between devices work?**
Changes sync in real time (delta: only the changes travel, not the whole database). Under normal conditions, changes appear within seconds on all your devices.

**Does automatic backup use up quota?**
No. Automatic snapshots are part of the service on all plans. The history keeps the last 12 snapshots.

**How do I cancel my subscription?**
From **Settings → Account → Subscription** or at [app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Your Pro access stays until the end of the paid period.

**Can I use my own AI API keys?**
Yes, on the Pro or Lifetime plan. Go to **Settings → AI** and add your Anthropic, OpenAI or Google keys. Usage goes to your account and doesn't draw from Fromly's tokens.

**What is the `loop` filter?**
The `loop` operator shows nodes (projects, areas, notes) that have pending tasks inside. Useful for seeing at a glance which containers have unfinished work. In the tree, these nodes show the 📁 icon even when collapsed.

**Are Space capture and ⌘K the same?**
Yes. `Space` opens the unified capture modal when the cursor isn't editing text. `⌘K` does the same and always works, even when text is being edited. They're synonyms for the same modal.

---

*fromly.app — Your second brain. On all your devices.*
