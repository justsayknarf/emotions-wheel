// Immediately redirects this tab to the live deployed app, tagging the
// resulting check-in's source. A real top-level navigation (not an iframe
// embed) so the app gets the real origin's own `localStorage` — the diary
// stays unified with web-originated entries automatically, no sync layer.
// `.replace()` (not `.href`) so this local stub doesn't leave an extra
// back-history entry between the previous page and the live app.
window.location.replace('https://justsayknarf.github.io/emotions-wheel/?source=new-tab');
