---
title: "feat: Admin emotion editor"
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-001-admin-emotion-editor-requirements.md
type: feat
status: ready
---

# feat: Admin emotion editor

## Summary

A dev-only admin panel at `/emotions-wheel/admin` with a split 2D draggable map and synchronized inline-editable table. Changes write through to both emotion source files via a Vite dev-server plugin. The tool uses the existing Oura CSS tokens for a coherent dark utility aesthetic, inheriting the app's visual language without trying to replicate the end-user experience.

---

## Problem Frame

Emotion word density is uneven across the field — some regions are illegible clusters, others are sparse. Hand-editing `src/data/emotions.ts` offers no spatial feedback across 242 entries. The admin tool makes coordinate tuning iterative: drag a dot on the map, see the label move, save to disk, HMR reloads the main app.

*(see origin: docs/brainstorms/2026-07-05-001-admin-emotion-editor-requirements.md)*

---

## Requirements

From the origin document:

- **F1** — Drag a dot on the map → x/y update live in the table row (no save required)
- **F2** — Click a table row → inline editing of label, x, y, depth, cluster, description; id is read-only
- **F3** — Add emotion → new row with generated id, dot appears at (0, 0)
- **F4** — Remove emotion → brief inline confirmation, then dot and row disappear
- **F5** — Save → POST to Vite dev plugin → rewrites `src/data/emotions.ts` and `src/data/descriptions.ts` → HMR fires

Acceptance criteria carried from origin:
- Map coordinate space matches EmotionField exactly: x = valence (−1 left → +1 right), y = arousal (−1 bottom → +1 top)
- `id` is displayed but cannot be edited anywhere in the UI
- Saving writes well-formed TypeScript to both source files
- If the save endpoint is unreachable, a clear error is shown and no data is lost

---

## Key Technical Decisions

**KTD-1: Merged `AdminEmotion` type**
The admin holds a single `AdminEmotion[]` that merges the `Emotion` fields (`id`, `label`, `x`, `y`, `depth`, `cluster`) with the description fields (`description: string`, `relatedIds: string[]`). This avoids parallel arrays and simplifies state. `relatedIds` is loaded from the existing `descriptions` record at startup and written back on save, but is not exposed for editing in this iteration.

**KTD-2: `@use-gesture/react` for drag**
Already a project dependency. The admin map uses `useDrag` from `@use-gesture/react` per dot, with `pointer: { capture: true }` to lock drag to the dot even when the pointer leaves its bounds. The existing `useGesturePin.ts` is the closest pattern to mirror.

**KTD-3: Y-axis inversion**
The coordinate system places y=+1 at the top. The rendering formula is `toPercent(-emotion.y)` — the same function used in `EmotionWord.tsx`. Drag deltas invert Y: dragging up increases `emotion.y`. The pixel-to-coordinate inverse is `x = ((px/W − 0.05)/0.9)×2 − 1`, `y = −(((py/H − 0.05)/0.9)×2 − 1)`.

**KTD-4: Comment-free TypeScript serialization**
The save endpoint regenerates both source files from scratch using a canonical template. The cosmetic quadrant/cluster comments in the current `emotions.ts` are not preserved — the data is flat and the comments are not load-bearing. `git diff` makes any structural change visible.

**KTD-5: Dev-only Vite plugin via `configureServer`**
The `vite.config.ts` uses `defineConfig(({ mode }) => ...)` form. The save plugin is only registered when `mode !== 'production'`. The `admin.html` entry point is similarly gated out of the production build via `build.rollupOptions.input`.

**KTD-6: New emotion ID generation**
New emotions receive `id = slugify(label) + '-' + uuid().slice(0, 6)`. Slugify: lowercase, replace spaces and non-alphanumeric with hyphens. UUID v4 is already a project dependency.

**KTD-7: Admin visual language**
The admin page inherits the existing Oura CSS custom properties from `src/index.css` (`--oura-bg`, `--oura-surface`, `--oura-border`, `--oura-gold`, `--oura-text-1/2/3`). Layout is data-dense and utility-oriented — not the end-user product's aesthetic. Per the `/ce-frontend-design` signal and Module C (existing codebase): match the existing visual language, not a new one.

---

## High-Level Technical Design

### Component hierarchy

```
AdminApp  (state: AdminEmotion[], selectedId, dirty, saveStatus)
├── AdminHeader  (Save button, dirty indicator, emotion count)
├── AdminMap  (fires: onMove(id,x,y), onSelect(id))
│     └── AdminDot × N  (useDrag → coordinate delta → onMove)
└── AdminTable  (fires: onEdit, onAdd, onDelete, onSelect)
      └── AdminRow × N  (inline inputs, delete confirmation)
```

State lives entirely in `AdminApp`. Both panels read from and write to the same `AdminEmotion[]` via callbacks. There is no separate table or map state — a drag on the map and a numeric edit in the table both call the same `handleEdit(id, patch)` function.

### Save flow

```
AdminHeader [Save]
  │
  ▼
POST /admin-api/save
  body: { emotions: AdminEmotion[] }
  │
  ▼ (Vite dev plugin — configureServer middleware)
serialize.ts
  ├─ serializeEmotions() → src/data/emotions.ts  (fs.writeFileSync)
  └─ serializeDescriptions() → src/data/descriptions.ts  (fs.writeFileSync)
  │
  ◄─ 200 OK  (or non-2xx + { error: string })
  │
Vite file watcher detects change in src/data/
  → module graph invalidated
  → HMR pushes update to main app tab
```

The admin UI transitions the Save button: idle → "Saving…" → "Saved ✓" (3 s) / error message. On error, the admin state is not cleared and the user can retry.

### Coordinate space mapping

```
Emotion coord  [-1, 1]  →  CSS position  [5%, 95%]
toPercent(v) = 5 + ((v + 1) / 2) * 90

Render:
  left = toPercent(e.x)  %
  top  = toPercent(-e.y) %   ← Y inverted

Drag (pixel delta → coord delta):
  Δx_coord =  (Δpx / W) * (1 / 0.9) * 2
  Δy_coord = -(Δpy / H) * (1 / 0.9) * 2   ← negate Y
  new_x = clamp(old_x + Δx_coord, -1, 1)
  new_y = clamp(old_y + Δy_coord, -1, 1)
```

---

## Output Structure

```
admin.html                            ← second Vite entry point (repo root)
src/
  admin/
    main.tsx                          ← React root for admin page
    App.tsx                           ← top-level layout and state
    types.ts                          ← AdminEmotion type
    lib/
      serialize.ts                    ← TypeScript source serializers
      idgen.ts                        ← new emotion ID generator
    components/
      AdminHeader.tsx
      AdminMap.tsx
      AdminDot.tsx
      AdminTable.tsx
      AdminRow.tsx
  plugins/
    admin-save.ts                     ← Vite plugin (configureServer hook)
vite.config.ts                        ← modified (multi-entry + plugin)
```

---

## Implementation Units

### U1. Vite infrastructure: multi-entry + dev plugin scaffold

**Goal:** Serve `admin.html` as a second entry point at `/emotions-wheel/admin` during dev. Exclude it from production builds. Register the save plugin skeleton (endpoint wired, file writing in U5).

**Requirements:** F5 (save mechanism), access and deployment criteria.

**Dependencies:** none

**Files:**
- `vite.config.ts` — modify
- `admin.html` — create
- `src/plugins/admin-save.ts` — create (plugin scaffold)
- `src/admin/main.tsx` — create (minimal React root, placeholder UI)

**Approach:**
- Convert `vite.config.ts` to `defineConfig(({ mode }) => ...)` form.
- In `build.rollupOptions.input`, include `{ main: 'index.html', admin: 'admin.html' }` only when `mode !== 'production'`. In production, `input` is omitted or set to `{ main: 'index.html' }` only.
- `admin.html` mirrors the structure of `index.html` but points its script to `src/admin/main.tsx`. Include the same Google Fonts link and meta tags so CSS variables load.
- `src/plugins/admin-save.ts` exports a Vite plugin that uses `configureServer` to register a POST handler at `/admin-api/save`. In this unit, the handler can return `200 OK` with a stub body — the actual file writing lands in U5.
- The plugin is only added to `plugins` when `mode !== 'production'`.

**Patterns to follow:**
- `vite.config.ts` current structure — add to the existing `plugins` array.
- `index.html` — mirror for `admin.html`.

**Test scenarios:**
- Running `vite dev` and opening `http://localhost:517x/emotions-wheel/admin` serves the admin page (manual verification).
- Running `vite build` produces a `dist/` that does not contain `admin.html` or any admin entry chunk.
- `POST /admin-api/save` during dev returns `200`.
- Navigating to `/admin-api/save` during a production preview (or without the dev plugin) returns 404 or a meaningful error.

**Verification:** `admin.html` loads React in the browser during dev. `dist/` has no `admin.html`. Plugin registers without console errors.

---

### U2. Admin app shell and shared state model

**Goal:** `AdminApp` loads the bundled emotion and description data into a merged `AdminEmotion[]` state. Renders the split layout (header + map panel + table panel). Wires all callbacks. Tracks dirty state and save status.

**Requirements:** F1–F5 (all flows share this state), KTD-1 (merged type), KTD-7 (visual language).

**Dependencies:** U1

**Files:**
- `src/admin/types.ts` — create
- `src/admin/App.tsx` — create
- `src/admin/main.tsx` — fill in (was a stub in U1)
- `src/admin/components/AdminHeader.tsx` — create

**Approach:**
- `AdminEmotion` in `types.ts`: all six `Emotion` fields plus `description: string` and `relatedIds: string[]`. Import `Emotion` from `../../data/emotions` and `EmotionDescription` from `../../data/descriptions` for type reference.
- `App.tsx` initialises state by mapping over the bundled `emotions` array, merging each with its entry in `descriptions` (or `{ description: '', relatedIds: [] }` for missing entries).
- State: `emotions: AdminEmotion[]`, `selectedId: string | null`, `dirty: boolean`, `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`, `saveError: string | null`.
- `handleEdit(id: string, patch: Partial<AdminEmotion>)` — merges patch into the matching emotion, sets `dirty = true`.
- `handleAdd()` — generates id, appends a zero-coordinate emotion, sets `dirty = true`.
- `handleDelete(id: string)` — removes the emotion, sets `dirty = true`.
- `handleSave()` — POSTs to `/admin-api/save`, manages `saveStatus` transitions.
- Layout: full-viewport flex column. `AdminHeader` fixed-height bar at top. Below: `AdminMap` (flex: 1, min ~40vh) over `AdminTable` (flex: 1, min ~40vh), separated by a 1px `var(--oura-border)` line.
- Visual: `background: var(--oura-bg)`, header `background: var(--oura-surface)`, border `var(--oura-border)`.
- `AdminHeader`: title "EMOTION EDITOR" (uppercase, 11px, gold-dim), emotion count badge, Save button (gold bg, `#0D0F14` text, uppercase, disabled when not dirty), save status indicator.

**Patterns to follow:**
- `src/App.tsx` for state shape and callback wiring.
- `src/index.css` CSS variable names for visual tokens.

**Test scenarios:**
- On load, `emotions` state length equals the bundled emotions array length (242).
- Emotions with no description entry have `description: ''` and `relatedIds: []`.
- Calling `handleEdit` with a patch marks `dirty = true`.
- Calling `handleAdd` appends one emotion with a generated id and x=0, y=0.
- Calling `handleDelete` removes exactly one emotion from state.
- Save button is disabled when `dirty = false`; enabled when `dirty = true`.
- `saveStatus` transitions: idle → saving → saved / error on POST completion.

**Verification:** Admin page loads without console errors. State reflects the 242 emotions. All callbacks reachable from child components.

---

### U3. Admin map panel: draggable emotion dots

**Goal:** Renders all emotions as labeled, draggable dots on a 2D canvas matching EmotionField's coordinate system. Dragging a dot fires `onMove(id, x, y)` with clamped coordinates. Selected emotion is visually highlighted.

**Requirements:** F1 (drag to reposition), acceptance criterion: map coordinate space matches EmotionField.

**Dependencies:** U2

**Files:**
- `src/admin/components/AdminMap.tsx` — create
- `src/admin/components/AdminDot.tsx` — create

**Approach:**
- `AdminMap` uses a `ResizeObserver` (or `useRef` + `getBoundingClientRect`) to track container pixel dimensions, mirroring `EmotionField.tsx` lines 45–53.
- Renders each emotion as an `AdminDot` positioned with `left = (toPercent(e.x) / 100) * W` and `top = (toPercent(-e.y) / 100) * H`. The `toPercent` function is duplicated locally or imported from a shared util: `(v: number) => 5 + ((v + 1) / 2) * 90`.
- `AdminDot` uses `useDrag` from `@use-gesture/react` with `pointer: { capture: true }`. On each drag step:
  ```
  new_x = clamp(e.x + (Δpx / W) * (1 / 0.9) * 2, -1, 1)
  new_y = clamp(e.y - (Δpy / H) * (1 / 0.9) * 2, -1, 1)
  ```
  (Y negated because drag-down reduces arousal.) Fires `onMove(id, new_x, new_y)`.
- `AdminDot` renders a small circle + label. Selected state: gold border/fill (`var(--oura-gold)`). Unselected: `var(--oura-text-3)` dot, `var(--oura-text-2)` label. Surface emotions get slightly larger dots than deep emotions.
- Clicking a dot fires `onSelect(id)`.
- Map has axis labels matching EmotionField: "ACTIVATED" (top), "CALM" (bottom), "NEGATIVE" (left), "POSITIVE" (right) in the same ghost-uppercase style (`var(--oura-text-3)`, 9px, 0.14em tracking).
- Map background: `var(--oura-bg)` with a subtle crosshair at (0, 0) using `var(--oura-border)`.

**Patterns to follow:**
- `src/components/EmotionField/EmotionField.tsx` — `toPercent`, `ResizeObserver` sizing, axis label style (`AXIS_LABEL` const).
- `src/hooks/useGesturePin.ts` — `useDrag` with `DRAG_SCALE` attenuation and Y-inversion pattern.

**Test scenarios:**
- Emotion at x=0, y=0 renders at the center of the map container (within ~1px tolerance after coordinate math).
- Emotion at x=1, y=1 renders at top-right (approximately 95%, 5%).
- Dragging a dot up increases its y coordinate (arousal).
- Dragging to the edge clamps at −1 or +1; the dot cannot exit the map area.
- `onMove` is called with the clamped new x/y on each drag step.
- `onSelect` is called with the emotion id on click.
- Selected dot is visually distinct from unselected dots.

**Verification:** All 242 dots visible on map with no overlap errors. Drag moves a dot and fires `onMove` with correct coordinates. Clamping holds at boundaries.

---

### U4. Admin table panel: inline editing, add, remove

**Goal:** Renders all emotions in a filterable table with inline editable fields. Syncs with the map via `onEdit`, `onAdd`, `onDelete`, `onSelect` callbacks. Add and delete operations work inline with a single-step confirmation for deletes.

**Requirements:** F2 (inline editing), F3 (add), F4 (remove), KTD-1 (id read-only).

**Dependencies:** U2

**Files:**
- `src/admin/components/AdminTable.tsx` — create
- `src/admin/components/AdminRow.tsx` — create
- `src/admin/lib/idgen.ts` — create

**Approach:**
- `AdminTable`: filter input at the top (filters visible rows by label substring, case-insensitive). "+ Add emotion" button. Scrollable table body. Fixed column header row.
- Columns: `id` (read-only, monospace, muted), `label` (text input), `x` (number input, step 0.01, min/max −1/1), `y` (number input, step 0.01, min/max −1/1), `depth` (select: surface/deep), `cluster` (text input), `description` (text input or textarea), delete (icon button).
- `AdminRow`: renders one `AdminEmotion`. All inputs call `onEdit(id, patch)` on `onChange`. Clicking the row (not an input) calls `onSelect(id)`. Selected row has `background: var(--oura-surface)` and left border `var(--oura-gold)`.
- Delete flow: clicking the × icon on a non-confirming row sets that row into `confirmDelete` local state. The row briefly shows "Remove `label`? [Confirm] [Cancel]". Confirming calls `onDelete(id)`; cancelling resets.
- `idgen.ts`: `generateId(label: string): string` — `label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-' + crypto.randomUUID().slice(0, 6)`. Falls back to `'emotion-' + ...uuid...` when label is empty.
- When "+ Add emotion" is clicked, `onAdd()` is called (App generates the id and appends the row). The new row is scrolled into view and its label input focused.
- Visual: table rows alternate subtle background tint. Number inputs right-aligned. Text inputs full-width within their cell. Font sizes small (11–12px) for data density.

**Patterns to follow:**
- `src/components/EmotionPreview/CoordinateCard.tsx` — chip/pill styles for selected state visual language.
- `src/components/EmotionPreview/EmotionDrawer.tsx` — button styles for add/delete actions.
- `src/admin/lib/idgen.ts` — use `crypto.randomUUID()` (available in modern browsers and Vite's dev server environment) rather than importing the `uuid` package for brevity.

**Test scenarios:**
- Filter input "calm" shows only rows where label contains "calm" (case-insensitive).
- Filter input clearing restores all rows.
- Editing the label field calls `onEdit(id, { label: newValue })`.
- Editing the x field with value `1.5` clamps or is rejected (the number input's `max` attribute handles this; verify the input respects it).
- Depth select shows only "surface" and "deep" options.
- Delete flow: clicking × shows inline confirmation; Cancel hides it; Confirm calls `onDelete`.
- Adding an emotion: the new row appears at the bottom of the table (or at the top of the unfiltered list); its id cell is populated and read-only.
- Generated id for label "Mild Anxiety" matches pattern `mild-anxiety-<6chars>`.
- Selected row is visually distinct (gold left border).
- Scrolling to new row after add: the table scrolls so the new row is visible.

**Verification:** All 242 rows render without layout overflow. Inline editing fires callbacks. Delete confirmation works. Add row appears with correct id.

---

### U5. Save flow: TypeScript serializer + POST handler

**Goal:** `serialize.ts` converts `AdminEmotion[]` to valid TypeScript source strings for both data files. The Vite plugin's POST handler receives the JSON body, calls the serializers, writes both files, and returns a status. The admin UI reflects success or failure.

**Requirements:** F5 (save to disk), acceptance criteria: well-formed TypeScript, HMR within ~2 s, no data loss on failure.

**Dependencies:** U2, U1

**Files:**
- `src/admin/lib/serialize.ts` — create
- `src/plugins/admin-save.ts` — fill in (was a scaffold in U1)
- `src/admin/App.tsx` — modify (wire `handleSave` to the real endpoint)

**Approach:**

`serialize.ts` exports two functions:

- `serializeEmotions(emotions: AdminEmotion[]): string` — produces the full `emotions.ts` source:
  ```
  // Auto-generated by admin emotion editor. Do not edit manually.
  export type EmotionDepth = 'surface' | 'deep';
  export interface Emotion { id: string; label: string; x: number; y: number; depth: EmotionDepth; cluster: string; }
  export const emotions: Emotion[] = [
    { id: 'happy', label: 'Happy', x: 0.65, y: 0.60, depth: 'surface', cluster: 'joyful' },
    ...
  ];
  ```
  Numbers are formatted to 2 decimal places. Strings are single-quoted. No comments beyond the header.

- `serializeDescriptions(emotions: AdminEmotion[]): string` — produces the full `descriptions.ts` source. Only emits entries for emotions where `description` is non-empty OR `relatedIds.length > 0`. Includes the `getDescription` fallback function at the bottom (copied verbatim from the current file's footer, or hardcoded as a constant string).

`admin-save.ts` Vite plugin:
- Uses `configureServer(server)` hook.
- Registers middleware: on `POST /admin-api/save`, reads the request body as JSON, validates it has an `emotions` array, calls serializers, writes to absolute paths resolved from `server.config.root` (e.g., `path.join(root, 'src/data/emotions.ts')`).
- Uses `fs.writeFileSync` (synchronous — acceptable for a dev tool).
- Returns `{ ok: true }` on success, `{ error: string }` with status 500 on failure.
- After writing, calls `server.watcher.emit('change', absolutePath)` for each file to explicitly notify Vite's HMR graph if the file watcher doesn't pick it up automatically.

`App.tsx` `handleSave`:
- Sets `saveStatus = 'saving'`.
- `fetch('/admin-api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emotions }) })`.
- On `response.ok`: sets `saveStatus = 'saved'`, `dirty = false`. After 3 s, resets `saveStatus = 'idle'`.
- On failure: parses error message, sets `saveStatus = 'error'`, `saveError = message`. Does NOT clear `emotions` state.

**Patterns to follow:**
- `src/data/emotions.ts` and `src/data/descriptions.ts` — use the exact export format as the template for the serializer output.
- Vite plugin `configureServer` API — standard pattern, no local examples, but the API is stable in Vite 8.

**Test scenarios:**
- `serializeEmotions([{ id: 'joy', label: 'Joy', x: 0.5, y: 0.5, depth: 'surface', cluster: 'happy', description: '', relatedIds: [] }])` produces a string that, when written to disk and parsed by TypeScript, exports a valid `Emotion[]` with that one entry.
- `serializeEmotions` with an emotion where `x = -0.333...` formats x as `-0.33`.
- `serializeDescriptions` omits emotions with empty `description` and empty `relatedIds`.
- `serializeDescriptions` emits emotions with non-empty `description` even when `relatedIds` is empty.
- `serializeDescriptions` preserves `relatedIds` unchanged for emotions that have them.
- POST to `/admin-api/save` with a valid body writes both files and returns `{ ok: true }`.
- POST with malformed JSON returns status 500 and `{ error: ... }`.
- After a successful save, the contents of `src/data/emotions.ts` on disk match `serializeEmotions(submittedEmotions)` exactly.
- Admin UI: after successful save, Save button shows "Saved ✓" for 3 s, then returns to idle and is disabled (dirty = false).
- Admin UI: after failed save, error message appears; state is unchanged; retry is possible.

**Verification:** Write a known emotion set, save, then `import { emotions } from './src/data/emotions'` in a test harness and verify the data round-trips correctly. HMR fires in the main app tab within 2 s of a successful save.

---

## Scope Boundaries

### Deferred to follow-up work
- `relatedIds` editing (array-of-ids UI; current save flow preserves existing values unchanged).
- Undo/redo — git is the undo mechanism.
- Bulk import from CSV or external sources.
- Visual density heatmap or overlap-detection overlay.

### Deferred for later (from origin)
- Undo/redo
- Bulk import
- Density/overlap visualization

### Outside this tool's identity (from origin)
- Authentication or access control.
- Editing diary entries or any runtime app state.
- End-user product aesthetic (admin reuses existing tokens but is not styled as the Oura experience).

---

## Risks and Dependencies

- **Vite HMR after programmatic write**: Vite's file watcher should detect writes to `src/data/emotions.ts` automatically. If it does not (e.g., because the write comes from within the server process itself), explicitly calling `server.watcher.emit('change', path)` forces invalidation. This is the most likely implementation-time unknown.
- **TypeScript serializer round-trip fidelity**: Floating-point formatting (`toFixed(2)`) may introduce small coordinate rounding. Since coordinates are dragged spatially, 2 decimal places (~0.01 coordinate unit) is acceptable precision.
- **`descriptions.ts` footer**: The existing file contains a `getDescription` fallback function after the `descriptions` const. The serializer must include this function verbatim in the output, or it will break the app. The safest approach is to hardcode the function body as a string constant in the serializer.
- **`tsconfig` strictness**: `noUnusedLocals: true` and `noUnusedParameters: true` are active. Admin code must pass `tsc --noEmit` without errors before the implementation is considered complete.

---

## Sources and Research

- Origin: `docs/brainstorms/2026-07-05-001-admin-emotion-editor-requirements.md`
- `toPercent` formula and Y-axis inversion: `src/components/EmotionField/EmotionField.tsx:11–13`, `src/components/EmotionField/EmotionWord.tsx:15–21`
- Drag delta and Y-inversion pattern: `src/hooks/useGesturePin.ts`
- Pointer capture pattern: `src/hooks/useFieldGesture.ts`
- Data file formats: `src/data/emotions.ts`, `src/data/descriptions.ts`
- Vite config baseline: `vite.config.ts`
- CSS tokens: `src/index.css`
- No institutional learnings (`docs/solutions/` does not exist in this repo yet)
