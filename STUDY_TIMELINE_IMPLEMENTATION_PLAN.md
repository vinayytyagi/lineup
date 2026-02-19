# Lineup — Implementation Plan

This document is the precise build plan for the **Lineup** UI and behavior described in the spec.

## Product goal (what “done” means)

- **Full-width horizontal rows (“strips”)** where **each row = one date**
- **Left fixed-width date column** and a **right flexible content area** for cards
- **Hover row**: very light blue highlight + subtle **“+” add icon** appears
- **Click row**: opens **Add Task modal** for that specific date
- **Add Task** fields:
  - **YouTube link** (optional)
  - **Notes** (optional)
  - **Time to complete** (required; preset options + custom minutes)
- **Card rules**:
  - **Link exists** → **Video card**
  - **Only notes** → **Note card**
  - **Both** → **Video card** + **note icon** (opens note popover)
- **Vertical timeline**:
  - **Today centered** on first load
  - Past above, future below
  - **Infinite scroll upward + downward** (prepend older dates, append future dates)
  - Maintain scroll position when prepending dates
- **Data model**: a single MongoDB collection `tasks`; dates are generated in frontend.

---

## Assumptions / constraints (explicit)

- Tech stack: **Next.js (App Router)** + **React 19** + **Tailwind v4** (already set up).
- Backend: implemented via **Next.js Route Handlers** under `src/app/api/...`.
- Database: **MongoDB** (as requested); we will use the official `mongodb` driver.
- Video metadata:
  - We must show **thumbnail, title, and video duration** for YouTube links.
  - We’ll fetch metadata server-side on task creation and store it on the task document (so the UI can render fast without re-fetching YouTube every time).

---

## Visual system (tokens)

- **Page background**: `#f5f7fb`
- **Card background**: `#ffffff`
- **Accent**: soft blue (Tailwind `blue-500`-ish; `#3b82f6`)
- **Row hover**: `#eaf2ff` (very light)
- **Radius**: `16px` (rounded-xl)
- **Shadow**: soft, subtle (no heavy borders)
- **Spacing**: breathable (cards wrap, `16px` gaps, row padding `24px` vertically)

Implementation note: Keep most styling in Tailwind classes, and define a couple of CSS variables in `globals.css` for background/accent if needed.

---

## Data model (MongoDB)

Single collection: `tasks`

```js
{
  _id,
  type: "video" | "note",
  title,                     // required for video; for notes can be derived or omitted
  videoUrl: string?,         // if provided → type="video"
  thumbnailUrl: string?,     // fetched from YouTube for video
  videoDuration: string?,    // "mm:ss" or "hh:mm:ss" (fetched) for video
  notes: string?,            // optional
  scheduledDate: string,     // ISO string; normalized to start-of-day UTC
  timeToComplete: number,    // minutes (required)
  createdAt: string          // ISO string
}
```

### Date normalization (critical for grouping)

- Store `scheduledDate` as **start-of-day UTC** (e.g. `2026-02-18T00:00:00.000Z`).
- In the UI, treat a “row date” as a **day key** in the user’s local timezone, but when querying/persisting, convert to/from this normalized UTC ISO string.
- Group tasks by day using the same normalization function on both client and server.

---

## API design (Next.js Route Handlers)

### 1) `POST /api/tasks`

Creates one task for a given `scheduledDate`.

Request body:

```json
{
  "scheduledDate": "2026-02-18T00:00:00.000Z",
  "videoUrl": "https://www.youtube.com/watch?v=...",
  "notes": "optional",
  "timeToComplete": 45
}
```

Server logic:

- Validate:
  - `scheduledDate` present and valid
  - `timeToComplete` required; integer minutes; enforce min/max (e.g. 1–1440)
  - At least one of (`videoUrl`, `notes`) must exist
- Determine `type`:
  - if `videoUrl` exists → `type="video"`
  - else → `type="note"`
- If `videoUrl` exists:
  - Extract video id
  - Fetch:
    - `title`
    - `thumbnailUrl`
    - `videoDuration`
  - Store these fields on the document
- Insert into MongoDB and return created task.

### 2) `GET /api/tasks?start=<iso>&end=<iso>`

Fetches tasks in a date range (inclusive start, exclusive end recommended).

- `start`: normalized ISO start-of-day UTC
- `end`: normalized ISO start-of-day UTC + 1 day for last date, or use exclusive boundary

Response:

```json
{ "tasks": [ /* task docs */ ] }
```

Indexing:

- Add an index on `scheduledDate` for range queries.

---

## YouTube metadata strategy (duration + title + thumbnail)

Goal: show the **thumbnail**, **title** (2 lines), and **video duration**.

Preferred approach (no API key):

- Add a small server utility (e.g. `src/lib/youtube.ts`) that:
  - extracts video id from common YouTube URL formats
  - fetches metadata + duration via a lightweight library or HTML/oEmbed fallback
- Store:
  - `thumbnailUrl` (standard `https://i.ytimg.com/vi/<id>/hqdefault.jpg` works reliably)
  - `title` (from oEmbed or metadata endpoint)
  - `videoDuration` (best-effort; if duration fetch fails, store `null` and render “—” until backfilled)

Reliability plan:

- On create: do best-effort fetch with timeout.
- If duration fails: still create the task; mark `videoDuration` null; optionally queue a background re-fetch later (future enhancement).

---

## UI architecture (components + responsibilities)

### Page + layout

- `src/app/page.js`
  - renders the timeline page:
    - Header
    - Scroll container (infinite timeline)

### Core components

- `TimelineHeader`
  - title “Study Timeline”
  - optional “+ Today” shortcut:
    - scroll to today row and briefly highlight

- `TimelineScroller`
  - owns:
    - list of visible date keys
    - current anchor (today)
    - scroll restore logic when prepending
    - range fetching for tasks
  - renders `DateRow` for each date

- `DateRow`
  - full-width row strip
  - layout:
    - left column fixed width (180–220px)
    - right column flexible content area
  - interactions:
    - hover → content area shows `#eaf2ff` + “+” icon center-right
    - click → open `AddTaskModal` for that date
  - content:
    - if tasks exist for that date: show cards (wrapped)
    - else: show empty state (only visible on hover)

- `AddTaskModal`
  - controlled by selected date
  - fields:
    - YouTube link (optional)
    - Notes (optional)
    - Time to complete (required)
      - presets: 30m, 1h, 2h, 1 day
      - custom: numeric minutes
  - submit:
    - calls `POST /api/tasks`
    - optimistic insert into local grouped state (or refetch range)

### Cards

- `VideoCard`
  - width 280–320px; wraps
  - UI:
    - 16:9 thumbnail
    - title max 2 lines
    - meta line:
      - `videoDuration • <timeToComplete label>`
      - note icon if notes exist
  - interactions:
    - click title → open video in new tab
    - click note icon → open `NotePopover` (small modal / popover) with full notes
  - hover:
    - subtle lift + shadow increase

- `NoteCard`
  - same size as VideoCard (no thumbnail)
  - UI:
    - notes text max 4 lines with fade/truncation
    - bottom meta: `<timeToComplete label>`
  - optional accent:
    - subtle left border in accent color

- `NotePopover`
  - small overlay anchored to icon (or centered modal on mobile)
  - displays full notes and close action

---

## Layout spec (exact)

### Row container

- Full width row strip
- Vertical padding: **24px** (top + bottom)
- Row height: **auto** (depends on wrapped cards)

### Row internal structure

| `DATE COLUMN` (fixed) | `CONTENT AREA` (flex) |

- Date column width: **180–220px** (choose 200px as default)
- Content area: flexible, left aligned
- Cards:
  - width: **280–320px** (choose 300px default)
  - gap: **16px**
  - wrap to next line if needed

### Date column content

Display:

- `15 Feb` (bold)
- `Thu` (smaller)

Today styling:

- subtle tint background in date column
- accent border on left
- optional dot indicator
- vertically centered alignment

---

## Infinite timeline behavior (exact)

### Initial load

- Generate visible dates:
  - `today - 5 days` … `today` … `today + 5 days`
  - Total: **11 rows**
- Fetch tasks for that full range in one request:
  - `GET /api/tasks?start=<today-5>&end=<today+6>` (end exclusive)
- After first render:
  - scroll container auto-scrolls so **today row is centered**

### Scroll up (prepend)

When user scrolls near top (threshold ~200–400px):

- Generate **10 more** older dates
- **Prepend** to date list
- **Maintain scroll position**:
  - capture `prevScrollHeight` and `prevScrollTop`
  - after DOM update, set `scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)`
- Fetch tasks for newly added date range only and merge into grouped state.

### Scroll down (append)

When user scrolls near bottom (threshold ~200–400px):

- Append **10 more** future dates
- Fetch tasks for appended date range and merge.

### Performance note

If the list grows large, consider light virtualization later. First pass: infinite dates with pragmatic DOM size (e.g., cap to last ~120 days rendered and drop off-screen ranges as enhancement).

---

## State management strategy

- Store tasks in memory grouped by date key:
  - `Record<dateKey, Task[]>`
- Derive `dateKey` from `scheduledDate` using a single shared helper.
- When adding a task:
  - insert into `tasksByDate[dateKey]`
  - keep cards stable (avoid full refetch unless needed)

---

## Time-to-complete formatting

Store: minutes (number)

Display:

- 30 → `30m`
- 60 → `1h`
- 120 → `2h`
- 1440 → `1 day`
- otherwise:
  - if divisible by 60 → `Nh`
  - else → `Nh Mm` (optional) or `Xm`

Video meta line:

- `videoDuration • 45m`

Note card meta line:

- `45m`

---

## Detailed build steps (phase-by-phase)

### Phase 0 — Project prep

- Add environment variables:
  - `MONGODB_URI`
- Add `src/lib/mongodb.ts`:
  - memoized connection in dev
- Add `src/lib/date.ts`:
  - normalize to start-of-day UTC ISO
  - date key formatting for UI (`15 Feb`, `Thu`)
- Add `src/lib/time.ts`:
  - minutes → label (`45m`, `1h`, `1 day`)

### Phase 1 — Layout system (rows + header)

- Replace `src/app/page.js` template with Study Timeline page shell:
- Header row: title + optional `Today` action
  - Scroll container full height
  - Timeline list rendering 11 dates (static first, then dynamic)
- Implement `DateRow` layout:
  - date column fixed width
  - content area flex + wrapping cards container
- Add Today styling in date column.

Acceptance criteria:

- Rows stretch full width.
- Date column stays fixed width.
- Content area expands and wraps.
- Spacing matches spec (24px vertical row padding, 16px card gaps).

### Phase 2 — Hover + modal system

- Add row hover behavior:
  - apply `#eaf2ff` background to content area on hover
  - render a subtle “+” icon center-right when row has no cards (and optionally always on hover)
- Row click:
  - sets selected date
  - opens `AddTaskModal`
- Build modal UI:
  - YouTube link input (optional)
  - Notes textarea (optional)
  - Time-to-complete selector (required):
    - quick chips for presets
    - custom minutes input
  - submit and cancel
- Hook submit to `POST /api/tasks` and update UI.

Acceptance criteria:

- Hover anywhere on row triggers highlight + plus icon.
- Clicking row opens modal for that exact date.
- Validation blocks submit unless time-to-complete exists and at least one of link/notes exists.

### Phase 3 — Cards (video + note) + note popover

- Implement `VideoCard`:
  - thumbnail 16:9
  - title 2 lines
  - meta line: `videoDuration • timeToComplete`
  - note icon if notes exist
  - title click opens YouTube in new tab
  - note icon click opens `NotePopover`
- Implement `NoteCard`:
  - notes 4 lines max with fade/truncation
  - bottom meta: `timeToComplete`
- Implement consistent sizing:
  - 300px width default (responsive down on small screens)

Acceptance criteria:

- Cards match spec and wrap properly.
- Note icon appears only when notes exist on a video task.
- Note card is used only when no YouTube link exists.

### Phase 4 — Infinite timeline (today centered + prepend/append)

- Build `TimelineScroller` with:
  - initial date generation (today ±5)
  - auto-scroll to center today row on mount
  - scroll listener or IntersectionObservers for:
    - near-top prepend 10 days
    - near-bottom append 10 days
  - scroll position preservation on prepend
- Fetch tasks by date range:
  - initial range fetch
  - incremental fetch for newly added ranges

Acceptance criteria:

- Today is centered on initial load.
- Scrolling up adds older days without “jumping.”
- Scrolling down adds future days.

### Phase 5 — Polish

- Empty state:
  - on hover, show “+ Add Task” affordance in empty rows
- Loading:
  - lightweight shimmer/skeleton for cards while fetching range
- Accessibility:
  - focus trap in modal
  - ESC closes modal/popover
  - keyboard activation for row click
- Mobile:
  - date column can shrink to 160px
  - note popover becomes centered modal

---

## Testing plan (practical)

- **Unit-ish helpers**:
  - date normalization: grouping stable across timezone
  - minutes formatter
  - YouTube URL parsing
- **Integration**:
  - create note-only task
  - create video task with notes
  - ensure correct card type and icons
- **Timeline**:
  - verify prepend keeps scroll position
  - verify today centering on first load

---

## Delivery checklist (must match spec)

- [ ] Full-width strips, each strip is one date
- [ ] Date column fixed width; content area flexible
- [ ] Hover row = light blue highlight + “+” appears
- [ ] Click row opens modal scoped to date
- [ ] Required: time to complete; optional link/notes
- [ ] Card rules: link→video, notes-only→note, both→video+note icon
- [ ] Video card shows thumbnail, 2-line title, `duration • completeTime`, note icon
- [ ] Note card shows truncated notes + completeTime
- [ ] Today row visually highlighted (tint + left accent border + indicator)
- [ ] Today centered on load
- [ ] Infinite scroll up/down with smooth prepend/append and preserved scroll position
