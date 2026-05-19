# From — User Manual

> Version 3.8 · macOS 14+ · iOS 17+

---

## 1. What is From?

From is a native app for Mac and iPhone that acts as your second brain. All your information — notes, tasks, projects, diary, files — lives in a bullet tree that syncs in real time across devices. No folders to organize, no .md files to manage: everything is in one system, always accessible, with built-in AI.

---

## 2. Today's diary

When you open From for the first time, you land on **today's diary entry**. This is your daily starting point.

**The three sections of the day:**

| Section | What it contains |
|---|---|
| Tasks | Overdue tasks, due today, and upcoming |
| Events | Today's events synced from Apple Calendar |
| 24h Timeline | Visual hour-by-hour view of events and day blocks |

**How to use it:**
- Type directly in the diary: any line becomes a bullet.
- Use `-t` at the end of a line to mark it as a task, or press ⌘T from any bullet.
- Today's diary is always accessible from the left sidebar.
- Each day creates its own entry. Navigate to previous days from the temporal tree (Year → Month → Week → Day).

---

## 3. Notes and nodes

In From, everything is a **node**: a line of text with a title, body (free markdown), and children. There is no distinction between a note and a task — a node can be both at the same time.

**Create a node:**
- Press `Enter` on any bullet to create a new one at the same level.
- Press `Tab` to make that node a child of the one above.
- Press `Backspace` at the start of an empty bullet to move it up one level.

**Open node detail:**
- Click the bullet's title to open it in the right panel.
- There you can edit the markdown body, view properties (status, date, priority, types), and manage children.

**Organizing with hierarchy:**
- Nest nodes to any depth. For example: `Project X → Phase 1 → Pending task`.
- Click the dot (●) of a bullet to zoom in and see only that node as the root.
- Drag bullets to reorganize them within the tree.

**Diary nodes:**
- Nodes marked as diary entries (`isDiaryEntry`) form the temporal hierarchy.
- From creates them automatically on startup — you don't have to.

---

## 4. Essential keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` | Global quick search (nodes, files, agents) |
| `⌘T` | Mark/unmark bullet as task |
| `⌘E` | Open/close node properties panel |
| `⌘N` | New node at current level |
| `⌘F` | Inline search in the current tree |
| `Tab` | Indent (make child of the node above) |
| `Shift+Tab` | De-indent (move up one level) |
| `Enter` | Create new bullet at the same level |
| `/` | Open command menu on the current bullet |
| `@` | Open mention picker to link another note |

Shortcuts are configurable in **Settings → Keyboard Shortcuts**.

---

## 5. Tags (#objects)

**Supertags** let you label any node with a semantic type. Type `#` anywhere in the text to open the type selector.

**Predefined types:**

| Tag | Use |
|---|---|
| `#task` | Action item with status and date |
| `#project` | Container for tasks and resources |
| `#event` | Appointment or commitment with a time |
| `#agent` | AI automation with a schedule |
| `#prompt` | Reusable instruction for the chat |

**Custom types:**
- Type `#client`, `#meeting`, `#idea` or any word: From creates the type instantly.
- Each type gets an automatic color. Change it by right-clicking the chip in the tree.
- Tags are visible in the bullet, the panel title, and the sidebar tree.

**Delete a tag:** `Backspace` on the chip removes it as a whole unit.

---

## 6. @Mentions

Type `@` anywhere in a bullet to open the **mention picker**. Search by name and select the note you want to link. The node is referenced: a chip with the target note's name appears, and you can navigate to it with a click.

- Mentions are bidirectional: the target note shows in its properties panel which nodes reference it.
- Useful for linking tasks to projects, connecting related ideas, or building a knowledge graph within the tree.

---

## 7. Tasks

**Create a task:**
- Type the bullet text and press `⌘T`, or use the inline shortcut `-t` at the end of the line.
- You can also type `#task` to turn any node into a task.

**Mark as done:**
- Click the checkbox on the bullet, or press `⌘T` again.
- On iOS: swipe the bullet to the right.

**Assign a date with natural language:**
- In the properties panel, type in the date field: `today`, `tomorrow`, `monday`, `may 15`.
- Or use the inline shortcut: type `-d:today` or `-d:2026-05-20` directly in the bullet.

**Priority:**
- Three levels: high, medium, low. Set from the properties panel or with `-p:high`.

**Open loops:**
- In the global dashboard (grid icon), the **Tasks** tab shows all overdue and unresolved tasks grouped by status.
- Use `status:pending` in the inline search bar to filter only open items.

---

## 8. Events and calendar

**Create an event:**
- In any block, type `-e ` or use the slash command `/event`
- The new event modal opens with the block's title pre-filled
- Set start and end time → the event is created in Apple Calendar and the node shows a 📅 icon + date/time badge
- Global shortcut: `⌘E` opens the new event modal from anywhere

**Date badge:**
- Task and event nodes show their date/time as a badge to the right of the text (and title if the node is open)
- The badge turns orange when the date is past due

**Apple Calendar sync:**
- From automatically imports events from your Apple calendars.
- The sync is bidirectional: events appear in the day timeline and in the calendar view.
- Enable it in **Settings → Calendar** and choose which calendars to include.

**24h timeline:**
- Visible in the right column when a diary node is open.
- Shows hour-by-hour blocks with the day's events.
- Overlapping events share the width (like Apple Calendar).
- Height scales automatically to fill the panel.

**Organize your day with drag & drop:**
- Tap the `clock` icon in the right column → opens a split panel (tasks left + timeline right)
- Drag any task to the desired time slot
- The timeline shows **15-minute slots** — each highlights as you hover with the exact `HH:MM` label
- The task's `due` is updated with that time when you drop
- Tasks already on the timeline snap to 15-min intervals during drag — the block shows its final position before you release
- Tap `clock` again to collapse back to the single tasks panel

---

## 9. Views

From offers five display modes for nodes at any level. Switch views from the buttons in the top bar.

| View | When to use it |
|---|---|
| **List** | General tree navigation, writing, hierarchy |
| **Kanban** | Project management with statuses (pending, in progress, done) |
| **Table** | Compare properties of multiple nodes at once |
| **Gallery** | Review visual content or resource cards |
| **Canvas** | Free visual organization on an infinite board |

- **Kanban** groups child nodes by their `status` field. Drag cards between columns to change status.
- **Table** shows fields like date, priority, and types in editable columns.
- The last selected view is remembered per node.

### Canvas

The **Canvas** is an infinite board where you can place notes, tasks, and text freely and connect them with lines. Use it when the linear tree doesn't capture the relationships between ideas well enough.

- **Add elements:** drag any existing node onto the canvas, or create a new one directly on the board by double-clicking.
- **Connect elements:** drag from the edge of one node to the edge of another to create a connection line.
- **Navigate:** use scroll or trackpad to pan and zoom across the board.
- Changes on the canvas are reflected in the tree and vice versa: the nodes are the same, only the visual presentation changes.

---

## 10. Search

**Inline search (`⌘F`):**
Filters the tree you're viewing without leaving it. Supports commands:

| Command | Example | Result |
|---|---|---|
| `status:` | `status:pending` | Only pending tasks |
| `date:` | `date:today` | Nodes due today |
| `type:` | `type:project` | Only project nodes |
| `priority:` | `priority:high` | Only high-priority nodes |
| Free text | `client meeting` | Search by title and body |

**Global search (`⌘K`):**
- Searches across all nodes, files, and agents at once.
- Instant, no server needed. Results update in real time as you type.

**Semantic search (AI):**
- Beyond exact text matching, From includes a **magic search** mode that answers questions about your vault's content.
- Activate it by typing a natural language question in the global search bar: "What tasks do I have pending for client X?" or "What did we decide in Tuesday's meeting?"
- The AI analyzes your notes and returns an answer with references to the relevant nodes.

**Spotlight:**
- From indexes your content in macOS search so you can find notes from Spotlight without opening the app.
- The integration activates automatically when From is installed. You can disable it in **Settings → Search**.

**Saved search panels:**
- Pin frequent searches as panels in the sidebar.
- Useful for "my tasks today", "active projects", "notes with #client".

---

## 11. Quick capture

From offers several ways to capture information without interrupting your flow.

| Shortcut | What it does |
|---|---|
| `⌘K` | Global search and capture (nodes, files, agents) |
| `⌘T` | Create quick task in the current node |
| `⌘E` | Open properties panel to capture metadata |
| `⌘N` | New node at the current level |

**Capture from any app (macOS):**
- From the macOS menu bar you can open a floating quick-capture window without switching apps.
- The bullet is added to the selected node, or to today's diary if nothing is selected.

**File capture:**
- Drag any file from Finder to the bullet tree to attach it to a node.
- You can also paste images directly from the clipboard.

**Linked note:**
- From the `···` menu of any node you can create a new linked child note with one click, without losing the context of the parent node.

---

## 12. Voice recording

From includes a **persistent recording bar** at the bottom of the left column. It captures audio and converts it into structured bullets using AI.

**How to record:**
1. Select the source: **Microphone**, **System**, or **Mixed** in the bottom bar.
2. Press **Record** — the left column transforms into the recording panel (slides up with animation).
3. The top half shows the live transcription; the bottom half has a manual notes field.
4. Press **Save** (stops and processes with AI) or the chevron `⌄` to minimize without stopping.

**Minimized panel:**
- Recording and transcription continue in the background.
- The navigation tree reappears with an active waveform indicator.
- Press `⌃` to re-expand the full panel at any time.

**Transcription and structuring:**
- The AI transcribes the audio and structures it into bullets.
- Manual notes are combined with the transcription on save.
- Bullets are inserted into today's diary.

**Typical use cases:**
- Capturing ideas while walking or driving.
- Transcribing meetings or calls.
- Dictating a long note draft without touching the keyboard.

---

## 13. Integrated AI

**Opening the chat:**
- Open any node and go to the **Chat** tab in the right panel.
- The assistant has full context of the node: title, body, and children.

**How to use it:**
- Ask questions or give instructions in natural language. Examples:
  - "Summarize the open points in this project."
  - "Create 5 subtasks for this phase."
  - "Draft an email with the content of this note."
- The assistant can read and write to the node directly.

**Adding results to the note:**
- Chat responses include action buttons to insert the generated content into the node's body with one click.

**History:**
- Chat history is specific to each note. Switching nodes resets the chat.

---

## 14. Agents

**Agents** are AI automations that run with or without manual intervention. They are created as regular nodes inside the **Agents/** folder in the tree.

**Create an agent:**
1. Create a node inside `Agents/` or tag any node with `#agent`.
2. Write the instruction in the body: what the agent should do, which notes it should read, what it should generate.
3. In the properties panel, configure the **schedule**: on app open, daily, weekly, or at a specific time.
4. Optionally, add **context nodes**: drag other notes into the agent's context field for it to read before executing.

**What an agent can do:**
- Read and summarize nodes from the vault.
- Create or update notes with generated content.
- Search the web and bring results into the tree.
- Send notifications or generate periodic reports.

**Manual execution:**
- Press the **Run** button in the agent's panel to trigger it at any time, regardless of the schedule.

**Execution history:**
- Each run is logged in the agent's node with the date, result, and any errors produced.

---

## 15. Areas

An **area** is a label that groups related nodes under a shared context: work, personal, health, a specific client.

**Create an area:**
- In any node's properties panel, find the **Area** field and type the name.
- From creates the area instantly if it doesn't exist.

**Area AI context:**
- Each area can have a special context node (`_areaCtx`).
- That node's body is automatically included in the chat system prompt when working with nodes in that area.
- To edit it: open the chat in any node of the area and use the area tag button.
- Example: in the "Clients" area, write "We work with B2B companies in healthcare, formal tone."

---

## 16. Sharing notes

**Publish a note:**
- Open the `···` menu of any node and select **Publish**.
- From generates a public URL of the form `getfrom.app/p/...` with the note's content rendered in markdown.
- The URL is saved in the node's properties panel.

**Update a published note:**
- Edit the node normally and select **Publish** again from the `···` menu. The URL's content updates instantly.

**Unpublish:**
- Select **Unpublish** from the `···` menu. The URL becomes inaccessible immediately.

**Typical uses:** sharing a report with someone who doesn't have From, publishing project documentation, sending a brief to a client.

---

## 17. Google Docs

From can sync any note's content with a Google Docs document.

**Initial setup:**
1. Go to **Settings → Integrations** and connect your Google account.
2. Authorize Google Drive access when prompted.

**Sync a note:**
- Open the node you want to sync.
- In the note's action bar (top bar of the right panel), click the **Google Docs** button.
- Choose whether to link to an existing document or create a new one.
- From keeps the content in sync: changes in From are reflected in the document and vice versa.

**Notes:**
- Sync is per node, not for the whole vault.
- Markdown formatting is automatically converted to Google Docs format on export.

---

## 18. Sync and account

**Without an account (free mode):**
- Unlimited bullets, nodes, and files stored locally.
- No sync across devices, no AI.

**With an account:**
- Changes sync automatically between Mac and iPhone every few minutes.
- Delta sync: only changes travel, not the whole database.

**Plans:**

| Plan | Price | Includes |
|---|---|---|
| Free | €0 | Local nodes and files, no sync |
| Subscription | €7/month | Sync + managed AI tokens |
| License | €59 one-time | Sync + AI with your own API key |

**AI tokens (subscription plan):**
- Chat usage consumes prepaid tokens included in your subscription.
- Buy additional top-ups from **Settings → Account**.

**Local backup:**
- From automatically exports all your nodes to Markdown every 2 hours to:
  `~/Library/Application Support/From/Backups/`

### Automatic local backup

From saves a complete snapshot of your notes every 2 hours to `~/Documents/From Backup/{Workspace}/`. Each snapshot includes:
- All your nodes as standard Markdown (compatible with Obsidian and any editor)
- A copy of the database file for instant restoration

**History**: the last 6 snapshots per workspace are kept (12 hours of history).

**Restore**: Settings → Data → Backup → choose the snapshot → press "Restore". The app reloads automatically.

Your notes don't depend on any server. Even without an internet connection, backups keep running.

---

## 19. Useful settings

Access from the **From → Settings** menu or with `⌘,`.

| Section | What you configure |
|---|---|
| **Account** | Login, subscription, AI tokens, own API key |
| **Appearance** | Light/dark theme, font size |
| **Keyboard Shortcuts** | Reassign any shortcut in the app |
| **Inline shortcuts** | Define your own text expansions (abbreviation → full text) |
| **Calendar** | Enable Apple Calendar sync, select calendars |
| **Types & Statuses** | Create, edit, or delete custom node types and statuses |
| **AI** | Agents, saved prompts, assistant configuration |
| **Integrations** | Connect your Google account for Google Docs |
| **Search** | Enable/disable Spotlight integration |
| **Backup** | Local backup status, export path |
| **Space** | Local directory for files and agents |

**Inline shortcuts (text expansions):**
- In **Settings → Inline shortcuts** you define your own abbreviations: type a short key and From expands it automatically to the text you configured.
- Example: type `;sig` and it expands to your full email signature.
- Useful for recurring text blocks, templates, or anything you type repeatedly.

**Voice transcription (iOS):**
- In the iPhone app, the microphone button in quick capture transcribes your voice to text.
- The transcribed text is inserted as a bullet ready to edit.

---

## 20. Importing from other apps

From can import notes from Obsidian, Notion, LogSeq, NotePlan, Bear, Apple Notes, and any folder of Markdown files.

Access via **Settings → Import**.

### How From organises imported notes

From works with a temporal hierarchy: every note and task lives inside a specific day. When importing, this is what happens:

| What you import | Where it goes in From |
|---|---|
| Notes and tasks without a date | **Yesterday's** diary (so today stays clean) |
| Tasks with a date (`due: 2024-07-01`) | The diary for the **date specified**, creating that day if needed |
| Source diaries (LogSeq, NotePlan, `YYYY-MM-DD.md` files) | The diary for their **real date**, preserving your history |
| Vault folders | Grouping nodes inside yesterday's diary |

After importing, you can move any node to any other day by dragging it in the tree or editing its parent.

---

### Importing from Notion

**How to export from Notion:**

1. In Notion, open **Settings** (⚙ top left) → **Workspace** → **Settings**.
2. Scroll to **Export workspace content**.
3. Click **Export all content**.
4. Export format: choose **Markdown & CSV**.
5. Download the ZIP file Notion generates.

**How to import into From:**

1. In From, go to **Settings → Import**.
2. Click **Import ZIP** and select the downloaded file.
3. From automatically detects the Notion format and processes it.

**What From does with your Notion content:**
- **Page titles**: automatically removes the 32-character IDs Notion appends to names (`My page abc123def456...` → `My page`).
- **Nested pages**: Notion subfolders become parent nodes, preserving hierarchy.
- **Databases**: CSV files are skipped; Markdown pages are imported normally.
- **Frontmatter properties**: if a page has `due:` or `date:`, the task is placed on that day.

---

### Importing from Obsidian

**How to export from Obsidian:**

No export needed. Obsidian stores your notes as `.md` files in a regular folder on your disk.

**How to import into From:**

1. In From, go to **Settings → Import**.
2. Click **Import folder** and select your Obsidian vault's main folder (the one containing the `.obsidian/` folder).
3. From automatically detects it as an Obsidian vault.

**What From does with your Obsidian vault:**
- **Folder structure**: each root folder becomes a grouping node inside yesterday's diary.
- **Callouts** (`> [!NOTE]`): converted to standard Markdown blockquotes.
- **Frontmatter**: `due:`, `date:`, `tipo:`, `estado:` fields are mapped to From node fields.
- **Ignored folders**: `.obsidian/`, `.trash/`, `Templates/`, `assets/`, `Attachments/`.
- **Tasks** (`- [ ]` and `- [x]`): extracted as child nodes with Active or Done status.

---

### Importing from LogSeq

**How to export from LogSeq:**

No export needed. LogSeq stores your graph as `.md` files on your disk.

**How to import into From:**

1. In From, go to **Settings → Import**.
2. Click **Import folder** and select your graph's main folder (the one containing the `logseq/` folder).
3. From automatically detects the LogSeq format.

**What From does with your LogSeq graph:**
- **Journals** (`journals/`): each dated LogSeq journal file is imported to the corresponding diary in From.
- **Pages** (`pages/`): imported as notes under yesterday's diary.
- **Bullet format**: LogSeq uses bullets for all content, even prose. From converts them to normal Markdown paragraphs.
- **Block references** (`((uuid))`): removed, as they have no equivalent in From.
- **Ignored folders**: `logseq/`, `.recycle/`, `assets/`.

---

### Importing from NotePlan

**How to export from NotePlan:**

No export needed. NotePlan stores notes as `.md` files on your disk.

**How to import into From:**

1. In From, go to **Settings → Import**.
2. Click **Import folder** and select your NotePlan vault folder.
3. From automatically detects the NotePlan format (by the presence of dated files in the root).

**What From does with your NotePlan content:**
- **Calendar Notes**: NotePlan diary files (`YYYY-MM-DD.md`) are imported to the matching diary in From.
- **Project notes**: imported as regular notes under yesterday's diary.
- **Tasks**: `- [ ]` and `- [x]` lines are extracted as child nodes with Active or Done status.

---

### Importing from Bear

**How to export from Bear:**

1. In Bear, go to **File → Export Notes**.
2. Select **All files** and the **Markdown** format.
3. Choose a destination folder and save.

**How to import into From:**

1. In From, go to **Settings → Import**.
2. Click **Import folder** and select the folder you just saved.
3. From imports all `.md` files as notes under yesterday's diary.

---

### Importing from Apple Notes

Apple Notes doesn't export directly to Markdown, but there's a simple solution:

**Steps:**

1. Download the free **Exporter** app from the Mac App Store.
2. Open Exporter and select your Apple Notes.
3. Export in **Markdown** format to a folder on your disk.
4. In From, go to **Settings → Import → Import folder** and select that folder.

---

### Importing a generic Markdown folder

Any folder with `.md` or `.txt` files can be imported into From, regardless of origin.

**How to import:**

1. In From, go to **Settings → Import**.
2. Click **Import folder** and select the folder. Or use **Import ZIP** if your files are zipped.

**General rules:**
- Each `.md` or `.txt` file becomes a node.
- Folders become grouping nodes.
- Files named `YYYY-MM-DD.md` are treated as diary entries.
- Images, PDFs, and other binary files are skipped.
- Standard YAML frontmatter (`due:`, `date:`, `tipo:`, `estado:`) is respected.

---

*getfrom.app*
