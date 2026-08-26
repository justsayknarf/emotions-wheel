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
keyboard focus from the omnibox) that runs `newtab.js`, which navigates the
tab via `chrome.tabs.update()` rather than `window.location.replace()`:

```js
chrome.tabs.getCurrent().then((tab) => {
  if (tab) {
    chrome.tabs.update(tab.id, { url: TARGET_URL });
  } else {
    window.location.replace(TARGET_URL);
  }
});
```

This is a real top-level navigation to the live deployed app, not an embed —
Chrome does not allow a `chrome_url_overrides.newtab` manifest entry to point
directly at a remote URL, so a bundled local page that immediately redirects
is the standard pattern (see, e.g., the long-shipping "New Tab Redirect!"
extension on the Chrome Web Store). Because it's a real navigation, the tab
gets the live app's own `localStorage`, so check-ins recorded from a new tab
land in the exact same diary as check-ins recorded by visiting the site
directly — no sync bridge, no separate store.

**Why `tabs.update()` and not `location.replace()`:** Chrome only
auto-selects the omnibox for the literal New Tab Page, and that state doesn't
survive a page-initiated redirect away from it. Real-world reports on
`chrome.tabs.update()` targeting the *current* tab (vs. `chrome.tabs.create()`,
which focuses the page) suggest it's more likely to leave the omnibox
selected — this is an evidence-based attempt, not a guaranteed fix, and needs
manual confirmation in a real unpacked install (browser automation can't
verify omnibox focus state). Trade-off: Chrome has no `loadReplace` option
for `tabs.update()` (Firefox-only), so unlike the old `location.replace()`
call, this leaves one extra back-history entry pointing at the blank local
stub — pressing Back once from the live app briefly shows it instead of
having nowhere to go.

The `?source=new-tab` query parameter lets the app tag which surface produced
a given check-in; the app reads and clears it once at boot.

## Permissions

`permissions` and `host_permissions` are both empty. A `chrome_url_overrides`
entry requires no permission grant on its own, and neither does navigating
the current tab via `chrome.tabs.update()` or `window.location.replace` from
the extension's own script — the `tabs` permission only gates reading
sensitive properties (url/title/favIconUrl) of *other* tabs, not navigating
this one. That's only relevant to an iframe-embed approach, which this
extension does not use.

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
- **Omnibox focus after redirect is unverified:** `newtab.js` navigates via
  `chrome.tabs.update()` specifically to try to keep the omnibox selected
  after the redirect, based on real-world reports rather than a documented
  guarantee — needs confirming in a real unpacked install. One accepted
  trade-off either way: pressing Back once from the live app shows the blank
  local stub instead of having nowhere to go (Chrome's `tabs.update()` has no
  `loadReplace` option, unlike Firefox).
