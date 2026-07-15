# Fromly — User Manual

> Web · Mac · iPhone · fromly.app · Last updated: July 16, 2026

---

## Fromly 2.0 — what you see when you open it today

Since July 2026, **Fromly opens in the chat** (Fromly 2.0). This manual documents that
experience, which is the only one available on web, Mac and iPhone.

When you open Fromly you have **three columns**:

- **Left — Contexts**: your Areas (always active, e.g. "Work", "Personal") and Projects
  (subcontexts that open and close), in a hierarchy. Click one to focus the conversation on it.
- **Center — the chat**: your main way of working. Type what you need in plain language —
  "remind me to call Ana on Monday", "summarize my day", "search my notes about X" — and the AI
  creates tasks, notes and events, dates them, files them in their context, or answers with what
  you've already saved. Drag a PDF, an image or a file straight into the chat to bring it into the
  conversation.
- **Right — five tabs**: **Context** (what Fromly knows about this topic — its "Memory" — plus its
  tasks and elements), **Details** (the card for whatever you have open — a note, task or specific
  conversation — independent from Context, so one doesn't cover the other), **Elements** (search
  across everything you've saved, including your conversations — filter by "💬 Conversations" to
  see them alone), **Today** (your day's agenda, draggable into the Planner) and **Agenda** (any
  day, yearly calendar).

**Files and RAG.** When you upload a file, Fromly indexes it: you can ask about its content at any
time, not just right after uploading. PDFs open with a real viewer (text highlighting + region
crop as an image).

**First time.** A guided 6-step tour appears automatically the first time you open it, explaining
these same pieces. You can skip it, or revisit it later by clearing your browser's localStorage if
you ever want to go through it again.

---

## What's new (July 2026, Fromly 2.0)

- **Undo on delete**: deleting any note, task or file (individually or in bulk from Elements) shows
  a confirmation with an "Undo" button — nothing disappears without giving you a few seconds to
  recover it before it silently moves to trash.
- **Files and PDFs**: drag a PDF or image anywhere (chat or the contexts column) — if you have a
  conversation open it's added to it, otherwise it's imported directly. PDFs open with a real
  viewer: you can **select text and highlight it** (the highlight shows in yellow right on the
  page) and **crop any region as an image** with the crop tool in the toolbar. Every PDF shows a
  thumbnail of its first page. You can **remove a file from a conversation** without deleting it —
  it stays saved and searchable.
- **Claude connector (MCP)**: Claude can search, create, edit, **delete and move** your notes,
  upload real files and run batch cleanups. Notes Claude creates are normal documents (not bullet
  lists).
- **Agenda = Today**: opening any day from the yearly calendar shows exactly the same view as the
  "Today" column (events, to-dos, follow-up, to be scheduled), with direct "+" buttons on each
  block to create an event or task for that day.
- **"Notes" in any context, conversation or task**: a full note editor (the same one you use for
  any note — formatting, favorite, export, publish) to jot down whatever you want, separate from
  that place's tasks and elements. Note and Canvas are two separate types from the moment you
  create them ("+Note"/"+Canvas" in the chat header) — one no longer turns into the other
  afterward.
- **Parent context**: you can assign or change any context's parent context directly from the
  right column.
- **A more compact "Today" column**: each task on a single line, with time, date (colored by
  whether it's overdue, today, or upcoming) and repeat chips, plus its context alongside.
- **Context on every element**: always visible and editable — note, task, PDF, image or link —
  with a chip and a button to change it, and a click to jump straight to that context.
- **The History tab merged into Elements** (July 14, 2026): it was the same search with the
  "conversation" filter implied and its nested elements listed below — and those elements already
  show up when you open the conversation itself. Filter Elements by "💬 Conversations" for the same
  result.
- **Agents and Prompts, now in any context**: you can create an Agent (an automation that runs on
  its own in the cloud every day) or a Prompt (a reusable instruction template) hanging off any
  context or project, just like a note or a task — ask the AI for it in chat ("I want a daily
  report on X") or create it with the corresponding button. They start disabled until you review
  and enable the prompt yourself. They appear alongside the rest of the context's elements, with
  their own icon.
- **Prompts in the chat**: the "⚡ Prompt" button next to the text field lists your saved
  templates — picking one sends it directly, with its variables already filled in.
- **Voice dictation in the chat**: the microphone next to the text field transcribes live what you
  say (shortcut Alt+Space) — different from "Record audio", which saves a separate voice note.
- **Elements: Conversations and Canvases, separately**: conversations now show up as an element in
  their own right (with their own filter), and canvases have their own filter with real visual
  thumbnails of each drawing, instead of being listed as text.
- **A new context already knows what it's about**: when you ask the AI to create a context for
  something specific ("I want to track the daily market analysis"), the first conversation you
  open there picks up naturally right away — it used to start with a generic greeting.

---

## 1. What is Fromly?

Fromly is your personal second brain, chat-first: you write in plain language, the way you'd talk
to a trusted assistant, and Fromly creates, files and remembers things for you. No need to
navigate a folder tree or learn a special syntax — the chat box in the center is the door to
everything.

It exists for people who have too much on their mind, too many apps to manage it all, and don't
want to spend hours setting up complex systems. In Fromly, you capture, organize and act from a
single conversation, available on Web, Mac and iPhone with the same account.

---

## 2. Getting started

### Create an account

Go to [fromly.app](https://fromly.app) and press **Create account**. You can sign up with:

- Email and password
- Google account
- Apple ID

With the same account you sign in from the browser, Mac and iPhone. Everything syncs **in real
time**: start an idea on your phone and it appears instantly on your computer. Sync records every
change as an operation, so it never loses or deletes anything by mistake — including whatever you
create from Claude or your agents, which also shows up instantly.

### Access from the browser

Go to [fromly.app/app](https://fromly.app/app) from any modern browser. Nothing to install.

You can also install it as a lightweight desktop app: in Chrome or Edge, press the install icon in
the address bar. In Safari on iOS: Share → "Add to Home Screen".

### Install on Mac

1. Go to [fromly.app](https://fromly.app) and download the `From.dmg` file.
2. Open the DMG and drag the Fromly icon into the **Applications** folder.
3. Open Fromly from Launchpad or the Applications folder.
4. If macOS warns it can't verify the developer, go to **System Settings → Privacy & Security**
   and press "Open anyway".
5. Sign in with your account.

**Automatic updates:** when a new version is available, `✦ New version — Update` appears in
Fromly's bottom bar. One click installs the update without leaving the app. No need to download
anything manually.

### Install on iPhone

Search for **Fromly: infinite canvas** in the App Store, or go to
[fromly.app/ios](https://fromly.app/ios). Install the app and sign in with the same account. Your
notes appear within seconds.

### First launch: what you see

The first time you open Fromly you land directly in the chat, with the three columns described at
the start of this manual (Contexts on the left, chat in the center, five tabs on the right). A
**guided 6-step tour** points out each piece — you can skip it at any time.

No setup needed before you start: type your first message in the chat ("I need to prep for
Thursday's meeting", "note that Marina arrives in Madrid on Friday"...) and Fromly creates the
matching task or note, filed in its right context.

---

## 3. The chat — your way of working

The central chat is where you spend most of your time in Fromly. There's no syntax to learn: you
write the way you think.

### What you can ask it

- **Create**: "remind me to call Ana on Monday", "note that project X is delayed a week", "create
  an event with Marina Friday at 6pm". Fromly creates the matching task, note or event, dates it
  if you mention one, and files it in its context.
- **Recall and search**: "what tasks do I have pending today?", "search my notes for everything
  related to project X", "summarize my day". Fromly answers with what you've already saved.
- **Attach content**: drag a PDF, an image or a text file straight into the chat — it's added to
  the conversation and indexed so you can ask about its content whenever you want (see "Files and
  RAG" below).

### The chat header

At the top of the chat you have quick buttons always at hand:

- **+Note** — creates a new document (rich-text editor).
- **+Canvas** — creates a drawing canvas inside the active context.
- **+Task** — creates a task directly, without going through the chat.
- **+Event** — creates an event with a date and time.
- **Planner** — opens the calendar view (day/week/month/year) in the right column.
- **Record** — opens the audio recorder (see "Voice note" in the element types section).
- **📎 Drive** — opens the Google Drive picker to attach a file directly to the conversation
  (requires connecting Google in Settings).

Next to the text field, in the composer itself, you also have:

- **⚡ Prompt** — expands your saved templates; picking one sends it directly to the chat, with
  its variables already resolved.
- **🎙️ Dictation** — the microphone icon transcribes live what you say as you speak (shortcut
  **Alt+Space**). It's different from the header's **Record** button: dictation writes directly
  into the chat, while Record saves a separate voice note with its own transcription.

### Files and RAG

Everything you upload or write in Fromly gets indexed automatically (semantic embeddings on
Postgres). That means you can ask Fromly about the content of a PDF or a note at any time — not
just right after uploading it, the way you would in a regular chat with temporary attachments.
PDFs, on top of that, open with a real viewer where you can highlight text and crop any region as
an image.

---

## 4. Contexts — Areas and Projects

Contexts are how Fromly organizes your life: every note, task or event belongs to a **single
context**. The left column shows your context tree.

### Areas and Projects

- **Areas**: top-level contexts, always active (e.g. "Work", "Personal", "Family"). They're the
  big drawers of your life.
- **Projects**: subcontexts within an Area, meant for things that **open and close** (a launch, a
  move, a trip). You can archive them when they're done without losing their content.

Click any context in the left column to focus the conversation on it — the chat, the Context tab
and the Elements tab all switch to show what's related to that context.

### Assigning a context

Every note or task has a single context, and you can assign it in two equivalent ways:

- **`#` in the chat or in an element's title**: type `#` and a picker appears; confirm to assign
  it (or create a new one if it doesn't exist yet).
- **The context chip** on any element's card: if it has no context you'll see an indicator to
  assign one; if it already has one, the chip shows its name and lets you change it with a click.
  The same chip takes you straight to that context.

When you create something from the chat in plain language, Fromly picks the most fitting context
on its own based on what you write — you can always correct it later with the chip.

### Parent context

You can assign or change any context's parent context directly from the right column, to
reorganize your Areas-and-Projects hierarchy without losing anything.

### "Memory" — each context's recall

Every context builds up its own memory: a living document, "Memory", that updates itself as you
save relevant things there. No need to tell it separately — Fromly decides whether something is
significant enough to remember and how to fold it in (it can rewrite or merge existing
information, not just append to the end). Open the **Context** tab of any conversation to see it.

### Profile — who you are, not tied to one context

The Profile is different from a context's Memory: it's what Fromly knows about you in general, and
it's used in every conversation regardless of the active context (your name, how you like to be
addressed, stable personal facts). Open it from your account menu ("Profile"). Like context Memory,
it updates itself as you talk with Fromly — but you can also open and edit it yourself as a regular
document at any time.

---

## 5. The right column — five tabs

The right column changes content depending on the tab you pick at the top:

- **Context** — what Fromly knows about the topic you're working on ("Memory"), plus the tasks and
  elements hanging off that context.
- **Details** — the card for whatever you have open (a specific note, task or conversation),
  independent from Context: opening an element doesn't make you lose sight of the topic's memory.
- **Elements** — the search across everything you've saved: notes, tasks, events, files, canvases,
  conversations, agents and prompts (click a conversation to pick it up where you left off; filter
  by "💬 Conversations" to see them alone). Filter by type, context, date or status, and switch
  between list, table, kanban or calendar view (table/kanban/calendar views available on the Pro
  plan).
- **Today** — your day's agenda: events, to-do tasks, follow-up items and what's still to be
  scheduled. You can drag any task from here straight into the Planner to give it a time.
- **Agenda** — the yearly calendar: navigate to any day and you'll see exactly the same view as
  the Today tab, with "+" buttons to create events or tasks for that day.

---

## 6. Element types

Within each context you can have different types of elements. They all share the same context
chip (always visible and editable) and are indexed for chat and search.

### Document

A document is a rich-text note — the same Notion-style editor everywhere you write a long note:
formatting, favorites, export and publish with a public URL. Create one with **+Note** in the chat
header, or ask the AI ("write this down as a note for me"). Pasting long prose into a conversation
can also turn into a document.

### Canvas (Whiteboard)

A canvas is a free drawing space inside a context — separate from a document from the moment you
create it ("+Canvas" in the header); one doesn't turn into the other afterward. Useful for
sketching, taking handwritten notes, or organizing ideas visually.

**Basic tools:** pencil, shapes (line, arrow, rectangle, ellipse), free text, eraser and selection
— with a color palette and several stroke widths. What you draw or write syncs across your
devices, including the iPad.

**Every day is also its own canvas.** Inside the Planner and the Agenda, each day has its own
blank space where you can write or draw directly on that day, alongside its tasks and events.

### Task

Tasks have a ☐/☑ checkbox. Check it off to archive it and update its status.

**How to create a task:** with the **+Task** button in the chat header, or by asking the AI in
plain language ("remind me to call Ana on Monday"). Fromly reads the date, priority and context
straight out of what you write.

**Task properties (right panel):**

- **Status**: Pending / In progress / Done / Overdue.
- **Due date**: write it in plain language (`today`, `tomorrow`, `next Friday`, `in 3 days`, `June
  15`) and Fromly parses the date.
- **Priority**: high, medium or low.
- **Repeat**: daily, weekly, monthly, or custom (every N days/weeks/months/years).

**Undated tasks — follow-up.** There's no separate type for "things you have in progress": it's
simply a task with no date. It stays visible in the **"Follow-up"** section of the Today tab until
you mark it done or give it a date. That section starts collapsed with a counter, since there tend
to be a lot of them.

### Event

Events have a start time and an end time. They show up in the Planner and in the Agenda for the
corresponding day. If you have Google Calendar connected, they sync automatically in both
directions.

**How to create an event:** with the **+Event** button in the chat header, or by asking the AI
("create an event with Marina on Friday at 6pm"). The creation modal lets you set a title, date
(required), start and end time (optional — no time means an all-day event), and repeat.

**Editing an event (any device).** From the event's detail view you can adjust the start and end
time and the location. If you have Google Calendar connected, saving creates or updates it there
too, and "Delete event" removes it from Google Calendar as well.

### Files: PDFs, images and others

Drag a PDF, an image or a file straight into the chat or the contexts column. If you have a
conversation open it's added to it; if not, it's imported directly.

**PDF with a real viewer:** opening a PDF lets you **select text and highlight it** (it shows in
yellow right on the page) and **crop any region as an image** with the crop tool in the toolbar.
Every PDF shows a thumbnail of its first page.

**Remove without deleting:** you can remove a file from a conversation without deleting it — it
stays saved and searchable from the Elements tab.

### Voice note (Recorder)

The **Record** button in the header opens the audio recorder, built for a meeting or a long voice
note:

1. Pressing **Record** starts recording: you'll see an animated icon, a timer, and — when the
   browser supports it — a live transcription.
2. When you finish, you'll see "Processing…" while Whisper transcribes the full audio.
3. The result becomes a note with the transcription, ready for you to ask the chat to summarize it
   or pull tasks out of it.

### Conversations

Every conversation you have with the chat is itself an element: it shows up in Elements (filter by
"💬 Conversations") alongside notes, tasks and canvases — click it to resume where you left off.

### AI Agent

An agent is an automation with its own instructions, sources and schedule, hanging off any context
(not a single root). Create one by asking the AI in chat ("I want a daily report on X") or with
the corresponding button in the context.

**They start disabled.** You have to review the generated prompt and turn it on yourself before it
runs. The result of each run is a real document, hanging off the agent's context.

**Schedule:** on app open, daily, weekly, or manual (you run it yourself whenever you want with
the ▶ button).

**Common use cases:**

- Summarize today's daily note every night.
- Pull tasks out of a long note when you finish it.
- Search the web on a topic and save the summary as a note.

### Prompt

A prompt is a reusable instruction template, with variables, that hangs off any context just like
a note or a task. Create one by asking the AI or with the corresponding button in the context.

**How to use it:** the **⚡ Prompt** button next to the text field lists your saved templates;
picking one resolves its variables (date, current context, etc.) and sends it right away.

Handy for: "summarize this in 3 bullets", "extract the tasks", "make the tone more formal", a
daily report with the same format every time.

---

## 7. The Planner

The Planner is Fromly's calendar view. Open it with the **Planner** button in the chat header — it
takes over the right column, which stays pinned to the **Today** tab so you can drag tasks
straight into the calendar while you plan.

### Four views: Day · Week · Month · Year

- **Day**: an hourly timeline with your timed tasks and events; blocks show their start time and
  can be resized to adjust the duration.
- **Week**: several days in columns. At the top, an "all day" strip for tasks with a date but no
  time.
- **Month**: the month grid, with each day's tasks and events.
- **Year**: all 12 months in a grid. Days with content carry a dot; click any day to open its Day
  view.

**Tasks vs events at a glance:** tasks show with no fill (a thin border with a touch of color);
Google events show with their background color.

### Giving a task a time

Drag any task from the **Today** tab onto the Planner's timeline to give it a time — the task
stays in its context, it just gains a chip with the assigned time. You can also click an empty
time slot to create a new task right there.

### Google Calendar sync while planning

If you have Google Calendar connected, the Planner creates and updates events automatically:

- **Giving a task a time** → creates an event in Google Calendar.
- **Moving or resizing the block** → the Google Calendar event updates instantly.
- **Removing the time** → the Google Calendar event is deleted.

Events that already exist in Google live only in Google (they're not copied as notes in Fromly):
they show up in the Planner and the Agenda with their original color, and clicking one opens its
editor with a **"➕ Create node in Fromly"** button — a note is only created if you press it.

---

## 8. Google Calendar

### Connect

Go to **Settings → Integrations → Google Calendar** and follow the authorization flow. You only
need to do it once.

### How it works

- Your Google Calendar events show up in the Planner and the Agenda with each calendar's color.
- Creating an event in Fromly creates it in Google Calendar too.
- Editing or deleting an event works in both directions.
- Sync accounts for your local timezone.

Fromly syncs with **Google Calendar**, not Apple Calendar/EventKit.

---

## 9. Share to Fromly (iPhone)

When you see a video on social media and want to keep **what it says, not the video itself**:
press **Share → Fromly**.

- A **capture** is saved to today's note with the link, the author, an automatic title and summary
  (in the video's language), and the full **transcript**.
- It happens **in the background**: the note appears instantly and the transcript fills in on its
  own within seconds. You don't have to wait.
- Works with **TikTok, YouTube, Instagram, X and many more**. If you share a regular link or plain
  text, it's saved as-is (no transcription).
- **The first time**, enable Fromly in the share sheet: swipe the app row all the way → **More /
  Edit** → turn on **Fromly**.
- Transcription uses your **AI tokens** (Pro plan or trial).

---

## 10. Fromly for iPhone

The iPhone app is available on the App Store with the same account as web and Mac. Everything you
capture on iPhone shows up synced in real time on your other devices, and vice versa.

What you can count on today on iPhone:

- **Notes, tasks and events**: creating, editing, marking done, assigning dates.
- **Real-time sync** with the same account as web and Mac, sending only the changes (deltas), not
  the whole database.
- **Share to Fromly** from other apps (see previous section).
- **Google Calendar**, if you have it connected.

The iPhone app is in the process of gradually catching up to the web and Mac chat interface: if
you're specifically looking for the three-column experience (Contexts / Chat / five tabs)
described at the start of this manual, check in the app itself which parts are already available
in your version before assuming it fully matches the web.

---

## 11. Connecting Claude (MCP)

Fromly connects to Claude as a **custom connector** (MCP with OAuth) — it doesn't depend on
Anthropic listing it in any directory. Once connected, Claude can search, create, edit,
**delete and move** your notes and tasks, upload real files and run batch cleanups — without you
having to ask each time.

### How to connect — custom connector (recommended)

Set it up once in claude.ai or Claude Desktop; it becomes available on iPhone and Android too with
the same account.

1. Open Claude (claude.ai or Claude Desktop).
2. Go to **Settings → Connectors → Add custom connector**.
3. Paste this URL: `https://from-server-production.up.railway.app/mcp`
4. A window opens to sign in with your Fromly account via OAuth.
5. Done — Claude can save notes and tasks to your vault from that point on.

No need to install extensions or copy tokens.

### How to connect — Claude Code (CLI)

For Claude Code (the terminal CLI), set up the connection manually. First generate your token in
**Fromly → Settings → Accessories**. Then add the `from` entry to `~/.claude.json` under the
`mcpServers` key:

```json
"mcpServers": {
  "from": {
    "type": "http",
    "url": "https://from-server-production.up.railway.app/mcp",
    "headers": { "Authorization": "Bearer YOUR_TOKEN" }
  }
}
```

Restart Claude Code. Fromly works automatically from that point on.

### What Claude does with Fromly automatically

- **Saves documents and analysis** it generates during the conversation, as normal notes (not
  bullet lists).
- **Creates tasks** when you mention pending actions.
- **Saves session summaries** when you say "fin".
- **Searches your vault** before answering, to give you real context.
- **Can delete and move** notes and tasks when you ask it to, in addition to creating and editing.

**Examples:**

```
"What tasks do I have pending today?"
"Add a task to call Adrián tomorrow at 10"
"Search my notes for everything related to project X"
fin  →  Claude automatically saves the conversation summary to Fromly
```

---

## 12. Accessories — capture from anywhere

Fromly doesn't require you to have the app open. These accessories send whatever you capture to
today's note, and Fromly's intelligence takes care of classifying it (type, date, context). All of
them — except the menu bar — connect using your account's **API token**.

### The API token

It's the key that Raycast, Chrome and Claude Code (CLI) use to talk to your Fromly. Generate and
copy it in **Settings → Accessories** (it's the same token for all three; regenerating it
invalidates the previous one). It's valid for 1 year. For Claude on web and Desktop you don't need
the token — add Fromly as a custom connector instead (see section 11).

### Menu bar (Mac)

Fromly lives in the Mac menu bar with its own icon.

- **Clicking the icon** (or menu → *Quick capture*) → opens a Spotlight-style capture window: type
  a note, task or event and it lands in today's note. Fromly detects the type, date and context.
- Closing the main window does **not** close Fromly: it stays available in the menu bar.
- **Hiding it:** Settings → Accessories → turn off "Show icon in menu bar", or right-click the
  icon → *Hide this icon*.

### Apple Shortcut (global hotkey)

For capturing from **any app** with a single keystroke.

1. In **Settings → Accessories → Apple Shortcut** press **"Install Apple Shortcut"** (opens the
   ready-made shortcut in the Shortcuts app) and add it.
2. In the Shortcuts app, open the shortcut's **Settings → Keyboard Shortcut** and assign whatever
   combination you want (e.g. ⌃⌥Space).
3. Pressing it prompts you for text and saves it directly to today's note.

Under the hood it uses the `from://capture?text=…&silent=1` link. If you'd rather build it
yourself, create a Shortcut with the **"Open URL"** action using that link, and replace `[Text]`
with **"Ask for Text"** or **"Clipboard"**.

### Raycast

Fromly's extension for [Raycast](https://raycast.com):

- **Create in Fromly** — type and it lands in today's note (Fromly decides if it's a note, task or
  event).
- **Search Fromly** — search your whole vault and open the result in the app or on the web.
- **Open Today's Note** — opens today's agenda.

Install it from the Raycast Store and paste your API token into its preferences (Settings →
Accessories → Raycast → copy token).

### Chrome

Fromly's extension for Chrome:

- **Click the icon** → saves the current tab's URL to today's note (turned into a link).
- **Select text → right-click → "Send selection to Fromly"** → saves it as a note.

Install it from the Chrome Web Store, open its Options and paste your API token.

### Claude connection (MCP)

The Claude Desktop/Code integration is described in the previous section — it uses the same API
token as Claude Code.

---

## 13. Backup and privacy

### Automatic server backup

Fromly takes a full snapshot of your data on the server every 2 hours (only when there are
changes). The last **12 snapshots** are kept (~24 hours of continuous history).

You can create a manual snapshot whenever you want: **Settings → Data → Backups → "Create snapshot
now"**.

### Restoring a backup

In **Settings → Data → Backups**, pick any snapshot from the list and press "Restore". Before
overwriting your data, the server automatically creates a safety snapshot (`pre-restore`) so you
can undo it if something goes wrong.

### Exporting your data

In **Settings → Export** you can download all your data at any time:

- **JSON**: a structured format with all the metadata (for programmatic use or migrations).
- **Markdown**: a folder of `.md` files, one per element with content. Readable in any editor.

Your data isn't locked into Fromly. The export is complete, with no restrictions, and it works on
the free plan.

### Privacy

- The AI only accesses content that's in the active conversation's context: the open conversation,
  its attached files, and whatever contexts you have active. It doesn't scan your whole vault
  automatically unless you explicitly ask it to search your notes.
- The local Mac backup is stored in `Application Support/Fromly/Backups/` on your own computer.
- Fromly uses an operation-based sync system (op-log): it records every change instead of
  inferring deletions, so it never loses or deletes anything by mistake — including changes made
  from Claude or your agents.

---

## 14. Settings

### Account

- **Email**: read-only (changing it would break Google/Apple sign-in).
- **Password**: you can change it (requires the current one).
- **Subscription**: your plan and, if you have an active subscription, renewal date, "Cancel" and
  "Manage billing" (customer portal). On the free plan you'll only see "Upgrade".
- **Delete account**: protected — asks you to confirm with your password (or your email if you
  sign in with Google).

### Language

Fromly is available in **12 interface languages**: Spanish, English, German, French, Italian,
Portuguese, Greek, Dutch, Polish, Russian, Turkish and Swedish. The language is detected
automatically from your browser or operating system settings (falling back to English if yours
isn't available — it never defaults to Spanish).

To change it manually: **Settings → 🌐 Language** and pick your language. The change applies
immediately, no reload needed. The AI and voice follow the same language as the interface.

### Appearance

- **Theme**: light or dark.
- **Accent color**: several colors for the interface.
- **Calendar and Planner**: visible start and end time of the day (default 7:00-23:00).

### AI

- **Included tokens**: your monthly AI token balance, plus the option to buy a top-up.
- **Your own API keys**: with a perpetual license you can use your own Anthropic/OpenAI/Google
  keys (usage is billed to your account).
- **AI language**: Spanish, English, or automatic.

### Integrations

Connect/disconnect Google Calendar and check sync status, and manage the MCP connection with
Claude.

### Accessories

API token, menu bar (Mac), Apple Shortcut, Raycast, Chrome and Claude. See section 12.

### Data / Backup

- Automatic snapshots every ~2h; create a manual snapshot; restore a previous one.
- **Export** a complete copy in JSON or Markdown.

### Import

Fromly imports from other apps with a step-by-step wizard. Go to **Settings → Import** and pick
the source:

- **Obsidian** — upload the vault folder (.md). Subfolder structure is preserved.
- **Notion** — export as "Markdown & CSV", unzip the .zip and upload the folder.
- **Apple Notes** — convert them to .txt/.md first and upload them.
- **Markdown / text** — one or more .md/.txt files, or a whole folder.
- **Fromly (JSON)** — a backup exported from Fromly.

Imported content is organized into its own context (with the import date) so you can review and
reorganize it without touching your existing notes.

---

## 15. Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Voice dictation in the chat | `Alt+Space` |
| Bold (in the document editor) | `⌘B` |
| Italic (in the document editor) | `⌘I` |
| Undo | `⌘Z` |
| Redo | `⌘⇧Z` |

Fromly keeps adding keyboard shortcuts to the chat interface; check **Settings → Shortcuts** to
see what's available in your version.

---

## 16. Plans and pricing

| Plan | Price | Includes |
|---|---|---|
| **Free** | €0 | Up to 1,000 synced nodes. Outliner + daily note, advanced search, Mac + iPhone + web, real-time sync. No AI, no file attachments, no publishing notes. |
| **Pro Monthly** | €7/month | Everything in Free + unlimited nodes + full AI (Claude) + Agents + Prompts + table/kanban/calendar views + file attachments + publish notes with a URL + priority support + 2,000,000 AI tokens per month included. |
| **Pro Annual** | €49/year (~€4.08/month) | Everything in Pro Monthly, billed annually. You save close to **42%** versus monthly (7×12 = €84 → €49). |
| **Lifetime** | €149 one-time | Everything in Pro, forever, no subscriptions, + 3,000,000 AI tokens included upfront. |

**Token top-up:** if you run out of the tokens included in your Pro or Lifetime plan, you can buy
an extra one-time package of 5,000,000 tokens.

**About the Lifetime plan:** it's a one-time payment that gives you everything in Pro indefinitely,
plus 3,000,000 AI tokens as a welcome grant. Checkout is available both inside the app (**Settings
→ Account → Plans**) and at [fromly.app/pricing.html](https://fromly.app/pricing.html).

### Free trial

Trial access to Pro features is activated by invitation (a link you receive by email) or through a
checkout with a trial period set up specifically for you — there's no self-serve "start your free
trial" button on the app's pricing screen. If you've received a trial invitation, the top bar will
show a badge with the days remaining for as long as it lasts.

### Manage your subscription

Manage your plan in **Settings → Account → Subscription** or at
[app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). After completing payment,
your plan updates automatically in the app within seconds — no need to reload or sign out.

If you have a beta code or coupon, enter it at checkout when you buy. 100% coupons activate the
plan just like a regular payment.

---

## 17. Telegram channel — @FromMagicBot

Subscribe to Fromly's official Telegram channel for weekly tips on getting the most out of the
app: workflows, AI use cases and what's new.

**How to join:** search for **@FromMagicBot** on Telegram, or follow the link on fromly.app.

Tips are sent automatically, no interaction needed. It's a broadcast channel, ideal for learning
Fromly gradually without cluttering your inbox.

---

## Frequently asked questions

**Can I use Fromly offline?**
Yes. The Mac and iPhone apps work offline. Changes sync automatically once you're back online.

**What happens if I go over 1,000 nodes on the free plan?**
You can keep reading your notes, but you can't create new ones until you delete content or upgrade
to Pro.

**Where is my data stored?**
On Fromly's servers (Europe) and, on Mac, also in a local backup on your own computer. You can
export everything as JSON or Markdown from Settings at any time.

**Does the AI read all my notes?**
No, unless you explicitly ask it to ("search my notes..."). By default, the AI only accesses the
active conversation's content: what you've written or attached there, and whatever contexts you
have active.

**Can I import my notes from Obsidian, Notion or other apps?**
Yes. Go to **Settings → Import**. Fromly accepts exports from Obsidian, Notion, Apple Notes, and
Markdown folders in general.

**Can I share a note with someone who doesn't have Fromly?**
Yes, on the Pro plan. From the note's detail view, "Publish" generates a public URL like
`fromly.app/p/...` with the rendered content. Only people with the link can see it.

**How does sync between devices work?**
Changes sync in real time via operations (op-log): only the changes travel, not the whole
database, and a deletion is never inferred. Under normal conditions, changes show up within
seconds on all your devices.

**Does the automatic backup use up quota?**
No. Automatic snapshots are part of the service on every plan. History keeps the last 12
snapshots.

**How do I cancel my subscription?**
From **Settings → Account → Subscription** or at
[app.lemonsqueezy.com/billing](https://app.lemonsqueezy.com/billing). Your Pro access remains
active until the end of the paid period.

**Can I use my own AI API keys?**
Yes, with a perpetual license (Lifetime). Go to **Settings → AI** and add your Anthropic, OpenAI
or Google keys. Usage will be billed to your account and won't be deducted from Fromly's tokens.

**What happens if I run out of my monthly AI tokens?**
You can buy a one-time top-up of 5,000,000 extra tokens from **Settings → AI**, or wait for them
to renew with your next billing cycle.

---

*fromly.app — Your second brain. That understands you.*
