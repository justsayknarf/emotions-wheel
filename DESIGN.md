---
name: Constellation
description: A dark, quiet field where feelings are points of warm light you place, and later revisit.
colors:
  night-indigo: "#0B1220"
  midnight-surface: "#131B2E"
  starlight-gold: "#EAD9A8"
  starlight-gold-dim: "rgba(234, 217, 168, 0.5)"
  tidal-teal: "#8FC1C4"
  tidal-teal-dim: "rgba(143, 193, 196, 0.5)"
  bone: "#EDE8DF"
  bone-2: "rgba(237, 232, 223, 0.5)"
  bone-3: "rgba(237, 232, 223, 0.22)"
  hairline: "rgba(255, 255, 255, 0.08)"
typography:
  field-word:
    fontFamily: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.55
  welcome:
    fontFamily: "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
    fontSize: "30px"
    fontWeight: 300
    lineHeight: 1.35
    letterSpacing: "0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 300
    lineHeight: 1.5
  chip:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.01em"
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    letterSpacing: "0.14em"
rounded:
  chip: "6px"
  card: "12px"
  panel: "16px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  word-tag:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.chip}"
    typography: "{typography.chip}"
    padding: "4px 11px"
  word-tag-named:
    backgroundColor: "rgba(234, 217, 168, 0.15)"
    textColor: "{colors.starlight-gold}"
    rounded: "{rounded.chip}"
    typography: "{typography.chip}"
    padding: "4px 11px"
  word-tag-recorded:
    backgroundColor: "rgba(143, 193, 196, 0.16)"
    textColor: "{colors.tidal-teal}"
    rounded: "{rounded.chip}"
    typography: "{typography.chip}"
    padding: "4px 11px"
  coordinate-card:
    backgroundColor: "{colors.midnight-surface}"
    textColor: "{colors.bone}"
    rounded: "{rounded.card}"
    padding: "0"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone-2}"
    rounded: "{rounded.chip}"
    typography: "{typography.label}"
    padding: "6px 12px"
---

# Design System: Constellation

## Overview

**Creative North Star: "The Night Sky Journal"**

The field is a night sky and every check-in is a point of warm light you place in it. The room is a deep indigo dark with slow water-like light drifting behind it. Emotion words emerge out of the dark only as your attention nears them, and your own pins are the brightest things there. Later, in the diary, the same points are read back as a personal constellation. The system's job is to stay out of the way of that one gesture (press, release, a point exists) and then make the accumulated record feel worth revisiting.

Density is low and the voice is hushed. Type is small and mostly low-contrast; hierarchy comes from warmth and proximity rather than size or weight. There are no chart aesthetics, no clinical grids, and no urgency colors: no red-for-bad, no green-for-good, nothing that could read as a score. Words and chips are suggestions, not commands. Dashed borders, italic serif hints, and tiny tracked-out labels all say *offered, not required*, which is the "no wrong answers" commitment carried into the surface.

The palette is one pale starlight gold over deep indigo neutrals, with a single soft teal reserved to mean *already recorded*. Field words are set in a Palatino-family serif so the act of naming a feeling feels human; everything utilitarian is set in Inter.

**Key Characteristics:**
- Deep-indigo night ground with a slow, near-still water gradient; light comes from the user's own pins.
- One pale starlight gold for the present draft; one soft teal for the recorded past.
- Serif for feeling-words, sans for chrome. Type is small, light-weight, and low-contrast.
- Tonal, glassy depth: translucent frosted cards over the live field, no structural shadows.
- Everything offered is dashed, dim, or italic; assertion is saved for the user's own pin.

## Colors

A night-sky palette: bone-white text and a single pale starlight gold over deep indigo, with one soft teal for the past. This is the shipped default theme, "I · Starry Night", in `src/config/theme.ts`. Values here are a documentation mirror of that catalogue, not a second source: `npm run check:theme` fails when they disagree (see The Token Is The Source Rule).

### Primary
- **Starlight Gold** (#EAD9A8): The draft pin, its slider thumbs and fill, named-word chips, proximity warming on field words, and the selection glow. It marks "this is yours, right now." Roughly oklch(89% 0.067 91). Token `--ui-gold`.
- **Starlight Gold Dim** (rgba(234,217,168,0.5)): Borders and secondary text on gold-toned elements (named-chip border, "your words:" label, gold-outlined micro buttons). Token `--ui-gold-dim`.

### Secondary
- **Tidal Teal** (#8FC1C4): Recorded (read-only) pins on the field, saved check-in cards and chips, the departure card's pre-mint sliders. It is a cool counterpart to the gold at a similar luminance, so past and present differ in hue rather than brightness. Roughly oklch(78% 0.052 201). Token `--ui-recorded`; its dim variant (rgba(143,193,196,0.5)) mirrors gold-dim.

### Neutral
- **Night Indigo** (#0B1220): The page ground, `meta theme-color`, and the History view background. Token `--ui-bg`. Roughly oklch(18% 0.031 263).
- **Midnight Surface** (#131B2E): Card and tray body. Used at reduced alpha over the field (0.56 frosted, 0.15 while dragging). Token `--ui-surface`.
- **Bone** (#EDE8DF): Primary text (`--ui-text-1`); a warm off-white, never pure white.
- **Bone 50%** (rgba(237,232,223,0.5)): Secondary text and unnamed chip text (`--ui-text-2`).
- **Bone 22%** (rgba(237,232,223,0.22)): Tertiary: end labels, hints, dismiss ×, metadata (`--ui-text-3`).
- **Hairline** (rgba(255,255,255,0.08)): The default 1px border everywhere (`--ui-border`).

### Where the palette lives
One catalogue, several consumers, no hand-copied values:
- `src/config/theme.ts` holds every theme's ten tokens (`THEME_TOKENS`) and its shader tuning. `DEFAULT_THEME_ID` names the shipped one.
- `src/theme-tokens.css` is generated from the default theme (`npm run sync:theme`) and is the first paint for the app, the landing page and admin. Runtime code applies the admin-selected theme over it (`applyThemeVars`, `useTheme`).
- Components never write a theme color. They use `var(--ui-gold)` for solids and `rgb(var(--ui-gold-rgb) / 0.3)` for any alpha, using the derived channels `--ui-{bg,surface,gold,recorded,text}-rgb` and `--ui-gold-hi` / `--ui-recorded-hi` for highlights. Canvas code, which cannot read `var()`, asks `themeRgba()` in `src/config/themeColor.ts`.
- The admin Color themes page lists tokens straight from `THEME_TOKENS`, so adding a token needs no admin edit.
- To change the look for everyone, edit the default theme (or `BONE_TEXT`, shared by nine themes), run `npm run sync:theme`, update the values above, and run `npm run check:theme`.

### Named Rules
**The Two Hues Rule.** Gold means present and yours; teal means recorded and past. Never use either for anything else, and never introduce a third accent hue. The pair is a role, not a value: a theme may swap both hues, but the roles stay.

**The No Verdict Colors Rule.** Emotional valence never maps to red/green, good/bad, or warm/alarm. The field's quadrant washes are faint ambient tints, not signals.

**The Bone Not White Rule.** Text is #EDE8DF at three fixed opacity tiers. Do not add a fourth tier or use pure white.

**The Token Is The Source Rule.** A color exists once, in the theme catalogue. Any other file that needs it reads a `--ui-*` token or a derived channel; a hex or `rgba()` copy of a theme color is a bug, and `npm run check:theme` scans `src/` for it.

## Typography

**Field Font:** Palatino (with Palatino Linotype, Book Antiqua, Georgia, serif fallbacks)
**Body / UI Font:** Inter (300 / 400 / 500), falling back to the system UI stack

**Character:** A soft humanist serif for the words that name feelings, and a quiet neutral sans for the machinery around them. The serif is the "recording a feeling" voice; the sans is data and controls.

### Hierarchy
- **Welcome cue** (Palatino 300, 30px, 1.35): The grounding line shown on arrival. The only large text in the product.
- **Field word / card headline** (Palatino 400, ~15.5px, 1.55): Emotion words on the field and the named result in a card.
- **Hint / guess** (Palatino italic 13.5–14px, `--ui-text-3`): Tentative suggestions ("between X and Y").
- **Body** (Inter 300, 13px, 1.5, `--ui-text-2`): Diary summaries, tag lists, empty-state lines.
- **Chip** (Inter 400, 12px, 1.35, tracking 0.01em): Word tags.
- **Label** (Inter 500, 8–11px, tracking 0.08–0.14em, UPPERCASE): Axis end labels, section eyebrows, small buttons, day headers.

### Named Rules
**The Serif For Feelings Rule.** Palatino is reserved for words that name or reflect an emotional state. Controls, dates, counts, and chrome are Inter.

**The Small And Quiet Rule.** Most text is 8–15px at weight 300–500 in a dimmed tier. Emphasis comes from warmth (gold) or proximity, not from bold or size.

## Layout

An edge-to-edge, full-viewport canvas: the field fills the screen and nothing scrolls at the shell level (`overflow: hidden`, `touch-action: none`). The field maps valence (x) and arousal (y) to 5%–95% of the container so words never touch the edge. Cards sit over the field, docked as a tray or a rail on wide viewports (`useSidePanelLayout`) and centered and frosted when alone. The History view is a full-screen overlay with its own scroll, padded 20px horizontally with 12–16px vertical rhythm. There is no fixed grid; spacing is a 4/8/12/16/20px hand-tuned scale applied per component. Layout must hold at phone width, since a native mobile app is an eventual goal.

## Elevation & Depth

The system is tonal and glassy, not shadow-based. Depth comes from translucency and blur: cards are the surface token at 0.56 alpha (`rgb(var(--ui-surface-rgb) / 0.56)`) with `blur(12px) saturate(1.1)` so the live field reads through them, and drop to `rgba(22,24,32,0.15)` while a slider is being dragged so the field takes over. A z-axis motion grammar (words scale and fade in with proximity, panels recede) does the rest. Glows are responses, not structure.

### Shadow Vocabulary
- **Selection glow** (`box-shadow: 0 0 0 1px <accent-dim>, 0 6px 22px rgb(var(--ui-gold-rgb) / 0.12)`): Applied to a selected, non-frosted docked card only.
- **Thumb ring** (`0 0 0 4px rgba(accent,0.12), 0 2px 8px rgba(accent,0.35)`): Slider thumbs, in gold or recorded.
- **Word proximity glow** (`0 0 <=12px rgb(var(--ui-gold-rgb) / <=0.30)`): Field words warming toward the cursor.

### Named Rules
**The Flat At Rest Rule.** Surfaces carry no shadow at rest. Glows and rings appear only in response to selection, drag, or proximity.

**The Field Reads Through Rule.** Any surface laid over the field is translucent enough that the field is still legible behind it.

## Shapes

Soft but small. Chips and micro-buttons use a 6px radius; cards 12px; the large preview panel 16px; dismissable pills 20px. Coordinate dots and pins are true circles (2–4px dots for words, larger radial-gradient thumbs for sliders). Borders are always 1px hairlines; a dashed border is a semantic (suggested, not yet yours), never decoration.

## Components

### Word Tag (chip)
The one chip for an emotion word wherever a card offers or shows one.
- **Shape:** 6px radius, 1px border, 4px 11px padding, 12px Inter.
- **Suggested:** dashed border (gold or teal at ~32–38%), transparent fill, `--ui-text-2` text.
- **Named:** solid border at 50%, 15–16% tinted fill, tone-colored text, trailing ✓.
- **Recorded tone:** the same chip in teal, used on saved check-ins.
- **Dismiss:** a trailing × in `--ui-text-3` sets a suggestion aside without naming it.
- **State:** `aria-pressed` toggles named/unnamed. All colors are `color-mix()` from the tone's token so themes recolor it.

### Coordinate Card
The card that holds a pin's position, its two axis sliders, and optional words.
- **Shape:** 12px radius, 1px hairline border, `overflow: hidden`, header band on top.
- **Resting:** `--ui-surface`; frosted variant is translucent with a 12px blur.
- **Dragging:** goes near-transparent and borderless so the field shows through.
- **Selected:** dim-accent border plus a faint gold glow when docked; no glow when centered and frosted.
- **Read-only:** always carries the teal-dim border so a saved check-in reads as its own card.

### Axis Slider
- **Track:** full-width, valence/arousal from -1 to 1, with 8px uppercase tracked end labels in `--ui-text-3`.
- **Thumb:** radial-gradient bead (gold or teal) with a soft ring; faded to reduced opacity when the sibling axis is being dragged.
- **Origin tick:** marks where the pin was first dropped, so travel is visible; a second dim tick marks the previous check-in's anchor.
- **Commit:** on release, not while dragging; an interrupted gesture reverts.

### Ghost Text Button
- **Style:** transparent, 1px hairline (or accent-dim) border, 6px radius, 9–11px uppercase label with 0.06–0.14em tracking, `--ui-text-2/3` color.
- **Use:** History header actions, "Use the field," empty-state calls to action. Never a filled button; the product has no primary button.

### Field Word
- **Look:** Palatino label plus a tiny bone dot at the true coordinate. Surface words rest brighter than deep words; a word warms toward gold and grows to 1.3x as the cursor approaches, and steps back (to a 40% opacity, 85% scale floor) when a card names a different pair.
- **Rule:** The dot never moves; only the label may nudge to avoid overlap.

### History Rows
- Plain rows separated by hairlines: an uppercase 10px date eyebrow, a gold pip per check-in, and daily tags as comma-separated text in 13px Inter 300 with a `+N` overflow in `--ui-text-3`.

## Do's and Don'ts

### Do:
- **Do** let the coordinate lead: an entry looks complete with no word attached.
- **Do** use starlight gold (`--ui-gold`) only for the present draft and tidal teal (`--ui-recorded`) only for the recorded past.
- **Do** mark anything offered rather than chosen with a dashed border, dim text, or italic serif.
- **Do** build new surfaces from the `--ui-*` tokens and their `-rgb` channels so a theme swap recolors them; never paste a hex.
- **Do** keep surfaces translucent over the field and honor `prefers-reduced-motion` (framer-motion `useReducedMotion`; note the canvas loops in `AxisRadiance.tsx` do not yet).
- **Do** keep type small and light; use warmth or proximity for emphasis.

### Don't:
- **Don't** use chart aesthetics, clinical grids, gauges, or scores anywhere; PRODUCT.md rules out clinical framing.
- **Don't** use urgency or verdict colors: no red, no green-for-good, no amber alerts (the bright #FBBF24 in the unused `SelectionControls.tsx` is a leftover, not part of the system).
- **Don't** add a filled primary button, a badge, or a required-field affordance; nothing in a check-in is mandatory.
- **Don't** use pure white text or pure black grounds; stay on bone and night indigo.
- **Don't** add structural drop shadows or opaque cards that hide the field.
- **Don't** hardcode a theme color, in a component, in the landing page, or in a new stylesheet; that silently opts the surface out of every future theme.
- **Don't** introduce a third accent hue or a social, sharing, or comparison visual.
