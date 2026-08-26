# Emotion Selector — New Tab Check-In

A Chrome extension that replaces the browser's New Tab page with the
[Emotion Selector](https://justsayknarf.github.io/emotions-wheel/) check-in field.

## Single purpose

Show the user's personal emotion check-in field every time they open a new
tab, so the moment of reaching for a tab on autopilot becomes a chance to
notice how they feel. That's the entire extension — no other behavior, no
other surface.

## How it works

`newtab.html` is a bare local stub (no interactive content — nothing to steal
keyboard focus from the omnibox) that runs one line of script:

```js
window.location.replace('https://justsayknarf.github.io/emotions-wheel/?source=new-tab');
```

This is a real top-level navigation to the live deployed app, not an embed —
Chrome does not allow a `chrome_url_overrides.newtab` manifest entry to point
directly at a remote URL, so a bundled local page that immediately redirects
is the standard pattern (see, e.g., the long-shipping "New Tab Redirect!"
extension on the Chrome Web Store). Because it's a real navigation, the tab
gets the live app's own `localStorage`, so check-ins recorded from a new tab
land in the exact same diary as check-ins recorded by visiting the site
directly — no sync bridge, no separate store.

The `?source=new-tab` query parameter lets the app tag which surface produced
a given check-in; the app reads and clears it once at boot.

## Permissions

`permissions` and `host_permissions` are both empty. A `chrome_url_overrides`
entry requires no permission grant on its own, and `window.location.replace`
from the extension's own script needs none either — that's only relevant to
an iframe-embed approach, which this extension does not use.

## Data / privacy

The extension itself collects, stores, or transmits nothing. All check-in
data lives in the loaded page's own `localStorage`, exactly as it would if
the user visited the site directly in an ordinary tab. No data is sent to,
or read by, the extension.

## Known limitations

- **Incognito:** Chrome does not permit New Tab overrides in Incognito
  windows at all — those windows show Chrome's native new tab, unchanged.
  This is a platform limit, not a gap in this extension.
- **Offline:** the new tab depends on network availability to reach the
  deployed app; there is no offline fallback in v1.
- **No frequency cap:** the interstitial shows on every new tab with no
  "don't ask again" or cooldown window — a deliberate v1 choice (see the
  origin brainstorm/plan under `docs/`), not an oversight.
