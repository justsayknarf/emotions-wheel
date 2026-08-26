---
date: 2026-08-25
topic: newtab-checkin-entry
---

## Summary

A Chrome extension that overrides the browser's new-tab page to always show the full Emotion Selector field. This gives check-ins a third entry point — alongside the deployed web app and the not-yet-built persistent widget — aimed at catching the moment someone opens a tab on autopilot. It loads the real deployed app rather than a separate copy, so new-tab check-ins and web check-ins land in one shared diary.

## Problem Frame

The interaction itself (field, pin, card) is solved; what isn't designed is the *trigger* — what actually gets someone to open the app on a given day. A prior brainstorm ([[EmotionSelector-SessionHabitLoop]]) settled on piggybacking the check-in on an existing high-frequency autopilot behavior rather than adding a standalone reminder: the moment someone reaches for a "time-wasting" site without consciously deciding to is itself high-value emotional signal, and a new tab is the earliest, most app-agnostic point to catch it — before a destination is even chosen.

That same brainstorm also settled the motivation posture ([[EmotionSelector-MotivationModel]]): no reward or currency for checking in, because the check-in is trivially gameable and a gate would recreate the "form" the product's design spent months eliminating. This brainstorm narrows that prior direction into concrete behavior for the entry surface itself.

## Key Decisions

- **Full takeover, always shown.** The interstitial occupies the whole new tab on every tab open, with no staleness or frequency gate in v1. Prioritizes simplicity and staying honest to "detour, not blockade" over avoiding repeat-prompt fatigue during a multi-tab browsing burst; a time-boxed cooldown was floated in the prior brainstorm as a possible future mitigation but is deliberately not built now.
- **Real field, not a compact variant.** The new tab shows the same traversal/pin/card mechanics as the main app — it doesn't invent a lighter quick-tap interaction.
- **Dismiss is just navigation.** There is no dedicated "skip" control. Typing a URL, clicking a bookmark, or any other navigation away from the tab is itself the exit.
- **Thin shell over the live site.** The extension loads the actual deployed app rather than bundling its own copy with a separate storage layer, so it inherits the deployed app's `localStorage` diary automatically instead of requiring a sync bridge between two stores.
- **Source-tagged entries.** A completed check-in records which surface produced it (new-tab vs. direct site visit), consistent with the prior brainstorm's note not to blend differently-sourced signal into one dataset.
- **Web Store publishable.** Built to Chrome Web Store requirements from the start, not as a personal unpacked-only extension.

## Requirements

**Trigger surface**
- R1. Every new tab opened in Chrome shows the full Emotion Selector field as a complete takeover of the new-tab page.
- R2. No frequency or staleness gate limits how often the interstitial appears — it shows on every new tab regardless of how recently the user last checked in or dismissed one.
- R3. The check-in experience on the new tab is the same field/pin/card interaction as the main app, not a separate compact variant.
- R4. The user can leave the interstitial at any time via ordinary browser navigation, with no dedicated skip control required to do so.

**Data model**
- R5. A completed check-in records which surface produced it (new-tab vs. direct site visit).
- R6. Check-ins made from the new tab and check-ins made by visiting the deployed site directly appear in one unified diary — never two separate histories.

**Distribution**
- R7. The extension meets Chrome Web Store publishing requirements (manifest, permissions, listing, privacy disclosures), not just personal/unpacked installation.

## Key Flows

- F1. New-tab check-in
  - **Trigger:** User opens a new browser tab.
  - **Steps:** The full Emotion Selector field renders. The user either completes a check-in (pin drop → card → entry minted, tagged with its source) or navigates away without completing one.
  - **Outcome:** A completed check-in joins the same diary the main app writes to. A bypassed tab leaves no record at all.
  - **Covered by:** R1, R2, R3, R4, R5, R6

## Acceptance Examples

- AE1. Given a new tab is opened, when the user completes a check-in, then the entry appears in diary history tagged with a new-tab source and lives in the same diary as web-originated entries. Covers F1, R5, R6.
- AE2. Given a new tab is opened, when the user types a URL into the omnibox and navigates away without touching the field, then navigation proceeds normally and nothing is recorded — no entry, no decline event. Covers F1, R4.
- AE3. Given the user checked in minutes ago, when they open another new tab, then the full interstitial still appears — no staleness suppression. Covers R2.

## Scope Boundaries

**Deferred for later**
- A frequency cap or "don't ask again" time-boxed window — considered in the prior brainstorm, not built in v1.
- A compact/quick-tap check-in variant distinct from the full field.
- Recording a "declined" signal when a tab is bypassed — there's no explicit skip action to hook the signal to.
- Any browser besides Chrome.

**Outside this product's identity**
- The new tab replacing the deployed site as the primary or sole entry point. Both remain live, equally valid ways to check in.

## Outstanding Questions

**Deferred to Planning**
- What the tab shows once the interstitial is left behind (Chrome's native new tab underneath vs. a simpler fallback page).
- The technical mechanism for loading the live deployed app from within the extension's new-tab page, and whether the deployed site's response headers allow it to be embedded/navigated to that way.
- Chrome Web Store review specifics — privacy disclosures, single-purpose justification, minimal permissions — for an always-on New Tab override extension.

## Dependencies / Assumptions

- Assumes no other extension currently overrides Chrome's new-tab page for this user, so there's no override conflict to resolve.
- Assumes the deployed GitHub Pages app can be loaded from the extension's new-tab context without frame-blocking headers or CSP restrictions — unverified, flagged for planning research.
- Assumes the Chrome Web Store review process doesn't categorically reject an always-on New Tab override with no dedicated dismiss control as an intrusive pattern — unverified, flagged for planning research.

## Sources / Research

- wiki/concepts/emotion-selector/EmotionSelector-SessionHabitLoop.md — the autopilot-interception framing and the choice of new-tab as the first trigger surface to pursue
- wiki/concepts/emotion-selector/EmotionSelector-MotivationModel.md — no reward/currency layer; time-boxed "don't ask again" as a considered-but-unbuilt mitigation; capture-signal-don't-police principle behind source tagging
- STRATEGY.md — check-in frequency as the primary habit-formation metric this entry point serves
- src/types.ts, src/store/diary.ts — current data model and storage (plain `localStorage`, no source field yet)
