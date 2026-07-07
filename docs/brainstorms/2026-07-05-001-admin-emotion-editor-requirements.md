# Admin Emotion Editor — Requirements

**Date:** 2026-07-05  
**Status:** Ready for planning  
**Scope:** Standard

---

## Problem frame

Emotion word density is uneven across the field — some regions are illegible clusters, others are sparse. Tuning coordinates by hand-editing `src/data/emotions.ts` is tedious: there's no visual feedback, no way to see the effect before reloading, and 242 entries to scroll through. An admin tool with a live map and synchronized table makes coordinate adjustment iterative and spatial.

---

## Actors

- **Developer (Frank)** — sole user; accesses the tool in a local dev browser session.

---

## Key flows

### F1 — Reposition an emotion (drag)
1. Developer opens `/emotions-wheel/admin` in the browser.
2. The map panel renders all emotions as labeled dots in the same coordinate space as the main field.
3. Developer drags a dot to a new position.
4. The x/y values update live in the corresponding table row.

### F2 — Edit emotion fields (table)
1. Developer clicks a table row to focus it.
2. All editable fields become inline inputs: `label`, `x`, `y`, `depth`, `cluster`, `description`.
3. `id` is displayed but not editable.
4. Changes reflect immediately on the map dot.

### F3 — Add an emotion
1. Developer clicks **+ Add emotion**.
2. A new row appears with blank fields and a generated `id` (slugified label + short random suffix).
3. Developer fills in label, coordinates, depth, cluster, description; the dot appears on the map.

### F4 — Remove an emotion
1. Developer clicks the delete button on a table row.
2. A brief confirmation prompt appears ("Remove *Anxious*?").
3. On confirm: the dot disappears from the map; the row is removed from the table.

### F5 — Save to disk
1. Developer clicks **Save**.
2. The admin page POSTs the full emotion and description datasets to a Vite dev-server endpoint.
3. The endpoint rewrites `src/data/emotions.ts` and `src/data/descriptions.ts` on disk.
4. Vite HMR fires; the main app reloads with the updated data.

---

## Acceptance criteria

- Dragging a dot on the map updates x/y in the table row in real time (no save required to see the update in the admin UI).
- The map coordinate space matches the main field exactly: x = valence (−1 left → +1 right), y = arousal (−1 bottom → +1 top).
- `id` is visible in the table but cannot be edited.
- A new emotion added via F3 immediately appears on the map as a draggable dot.
- Saving writes well-formed TypeScript to `src/data/emotions.ts` and `src/data/descriptions.ts`.
- Vite HMR reloads the main app tab within ~2 s of a successful save.
- If the save endpoint is unreachable (e.g., production build accidentally opened), a clear error is shown and the data is not lost.

---

## Data model in scope

**Emotion fields** (from `src/data/emotions.ts`):
| Field | Editable | Notes |
|---|---|---|
| `id` | No (read-only) | Displayed; cannot be changed after creation. Changing IDs would silently corrupt localStorage diary entries. |
| `label` | Yes | Free text |
| `x` | Yes | Float in [−1, 1]; updated by drag or direct input |
| `y` | Yes | Float in [−1, 1]; updated by drag or direct input |
| `depth` | Yes | Enum: `'surface'` \| `'deep'` |
| `cluster` | Yes | Free text (no enum enforcement in this tool) |

**Description fields** (from `src/data/descriptions.ts`, keyed by `id`):
| Field | Editable | Notes |
|---|---|---|
| `description` | Yes | The user-visible "definition" text |
| `relatedIds` | Deferred | Present in the data model; editing an array of ids is a distinct UX problem. Deferred to a later iteration. |

---

## Access and deployment

- A second Vite entry point (`admin.html`) serves the admin panel at `/emotions-wheel/admin` during `vite dev`.
- `admin.html` is excluded from the production build (Vite's `build.rollupOptions.input` omits it, or the production deploy step excludes it).
- No authentication. Dev-only by construction.

---

## Save mechanism

A Vite plugin registers a custom dev-server middleware that handles:
- `POST /admin-api/save` — accepts JSON body `{ emotions: Emotion[], descriptions: Record<string, EmotionDescription> }`, rewrites both source files, returns `200 OK` or an error message.

The plugin is loaded only when `mode === 'development'`. The admin page disables the Save button and shows a warning if the endpoint returns anything other than 200.

---

## Scope boundaries

**Deferred for later:**
- `relatedIds` editing (array-of-ids UI is a distinct problem; description text covers the main use case).
- Undo/redo — git provides this; the tool does not.
- Bulk import from CSV or external sources.
- Any visual density heatmap or overlap-detection overlay (useful eventually, but not needed to start tuning).

**Outside this tool's identity:**
- Authentication or access control.
- Oura visual aesthetic — this is a developer utility; plain, functional UI is appropriate.
- Editing diary entries or any runtime app state.

---

## Dependencies and assumptions

- The Vite dev server is running (`vite dev`); the save endpoint is unavailable in production.
- `src/data/emotions.ts` and `src/data/descriptions.ts` export their data in a consistent, machine-writable TypeScript format. The save endpoint regenerates the full file from the in-memory dataset.
- Approximately 120 of the 242 emotions currently have entries in `descriptions.ts`; the rest fall back to a default. Emotions with no existing description entry will receive an empty description string when saved (not the fallback default).
