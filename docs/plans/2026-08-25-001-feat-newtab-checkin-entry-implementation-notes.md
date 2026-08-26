---
title: "Chrome New-Tab Check-In Entry Point — Implementation Notes"
type: implementation-notes
date: 2026-08-25
plan: docs/plans/2026-08-25-001-feat-newtab-checkin-entry-plan.md
---

Low-confidence calls made during `/ce-work` execution that weren't pinned down by the plan itself. None were high-impact enough to block on — flagging for Frank's review, not asking upfront.

## 1. `entrySource` capture shape (U2)

The plan said "resolve once ... matching the existing derive-at-render convention, not an effect." Those two things are slightly in tension — a true derive-at-render value recomputes every render, but the value needs to survive past the point where the query param gets stripped (otherwise a later render would resolve back to `'web'`).

**What I did:** a lazy `useState` initializer (`useState(() => resolveEntrySource(window.location.search))`), mirroring `welcomeCue`'s existing pattern in `App.tsx` — computed once at mount via render, not in a `useEffect`. The actual URL-mutation side effect (`history.replaceState`) lives in its own mount-only `useEffect`, matching the `sessionStartRef` precedent right above it.

Confidence: medium — this satisfies both halves of the plan's instruction as literally as I could resolve the tension, but it's my interpretation, not a pattern the plan spelled out unambiguously.

## 2. Icon placeholder art

Generated three flat, solid-gold (`rgb(201, 168, 124)`) PNGs at 16/48/128px via a small script (no image tooling installed in this environment — no ImageMagick, no PIL). The color matches the app's existing pin/mark gold rather than being arbitrary, but it's not real icon art and Frank hasn't seen it. The plan explicitly flagged this as acceptable-for-v1/non-blocking.

Confidence: low on the specific visual choice, not on whether placeholder art is OK to ship (the plan already decided that).

## 3. Manifest `name`/`description`/`version`

Wrote `"Emotion Selector — New Tab Check-In"`, a one-line description, and `"1.0.0"` as a starting version. Untested against Chrome Web Store's actual Single Purpose review language — U4's own scope says the README's disclosure fields need to be echoed into the Web Store dashboard separately at submission time, which requires an actual developer account/submission and is out of reach of this session.

Confidence: medium-low — reads clearly to me as a human, but "will a Web Store reviewer accept this framing" isn't something this session can verify.

## 4. Verification gaps (environment-limited, not skipped by choice)

Every unit's automated/typed verification passed (`check:source`, `check:checkin`, `tsc -b`, `npm run build`, `npm run lint` — same 4 pre-existing errors as before this branch, none in touched files). What I could **not** verify in this session, because it requires steps outside sandboxed browser automation:

- Loading the extension unpacked via `chrome://extensions` and confirming the redirect actually fires on a real new tab (blocked: automation can't drive `chrome://` pages or native file pickers).
- Confirming the redirected tab's `localStorage` diary is genuinely shared/unpartitioned in a real browser session (same blocker).
- Submitting to the Chrome Web Store dashboard to confirm the review posture holds (needs a real developer account).

These match the plan's own "Integration (manual verification)" framing for U3/U4 — it always expected a human pass. Flagging here so it doesn't get mistaken for "verified" in the summary.

## Not done — explicitly out of scope per the plan

Frequency cap, compact check-in variant, decline-signal recording, non-Chrome browsers, Incognito support. All named in the plan's Scope Boundaries as deferred/out-of-identity, not oversights.
