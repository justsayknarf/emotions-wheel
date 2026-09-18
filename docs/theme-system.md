# Theme system

How the palette flows from one catalogue to every surface, and what to do when the look changes.

## One source

`src/config/theme.ts` is the only place a theme color is authored.

- `THEME_TOKENS` lists the ten `--ui-*` tokens every theme defines. `ThemeVars`, the admin inspector, the generator, and the check script all read this list.
- `THEMES` holds each theme's ten values (`mkVars` fills in the shared bone text ramp `BONE_TEXT`) and its ShaderGradient tuning.
- `DEFAULT_THEME_ID` is the shipped theme. Visitors with no saved choice get it.
- `DERIVED_TOKENS` are computed from the tokens (`--ui-gold-rgb`, and so on). Themes never write these.

## Consumers

| Consumer | How it follows the theme |
|---|---|
| `src/theme-tokens.css` | Generated from the default theme by `npm run sync:theme`. Imported by `index.css` and `landing.css`. First paint before any JavaScript. |
| App, landing page, admin | Call `applyThemeVars` before React mounts and `useTheme` after, so an admin-selected theme repaints live. |
| Components and stylesheets | Write `var(--ui-gold)` for solids, `rgb(var(--ui-gold-rgb) / 0.3)` for alpha, `var(--ui-gold-hi)` for a highlight. Never a hex or `rgba()`. |
| Canvas code | `themeRgba('gold', a)` from `src/config/themeColor.ts`, read at draw time (canvas cannot resolve `var()`). |
| ShaderBackground | Reads the theme's shader block through `useTheme`. |
| Admin Color themes page | Lists tokens from `THEME_TOKENS`, derived channels from `DERIVED_TOKENS`, and marks the shipped theme. No edit needed when tokens change. |
| DESIGN.md | Documents the default theme's palette in its frontmatter. Checked against the catalogue. |

## Changing the look

1. **Tune it** on the admin Color themes page and press "Save to file". That writes `docs/handoff/theme-settings.json`.
2. **Fold it in.** Copy the saved `vars` and shader values into that theme's `THEMES` entry. A shared change (body text contrast, say) goes in `BONE_TEXT` and reaches nine themes at once.
3. **Ship it.** Set `DEFAULT_THEME_ID` if the shipped theme changes.
4. **Sync.** `npm run sync:theme` regenerates `src/theme-tokens.css`.
5. **Document.** Update the colors in DESIGN.md's frontmatter and prose (and `.impeccable/design.json` if you keep the sidecar).
6. **Check.** `npm run check:theme` must pass. It fails if the generated CSS is stale, a theme is missing a token or holds an unreadable value, DESIGN.md disagrees with the default theme, or any file in `src/` hardcodes a theme color.

## Adding a token

Add it to `THEME_TOKENS` and a value to every `THEMES` entry (or to `BONE_TEXT` if shared), then `npm run sync:theme`. The admin inspector picks it up on its own. If components need alpha variants, add a derived channel to `DERIVED_TOKENS`.

## Not tokenized on purpose

- The field's ambient watercolor blobs in `FieldAura.tsx` (rose, periwinkle, violet) are decorative hue shifts, not theme roles.
- Canvas fade layers that composite with black (`rgba(0,0,0,…)`) are mechanics, not palette.
- Error red in the admin save button, and the neutral white swatch borders in admin.
