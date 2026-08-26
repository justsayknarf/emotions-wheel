// Immediately redirects this tab to the live deployed app, tagging the
// resulting check-in's source. A real top-level navigation (not an iframe
// embed) so the app gets the real origin's own `localStorage` — the diary
// stays unified with web-originated entries automatically, no sync layer.
//
// Navigated via chrome.tabs.update() rather than window.location.replace():
// Chrome only auto-selects the omnibox for the literal New Tab Page, and
// that state does not survive a page-initiated redirect (location.replace)
// away from it — but real-world reports on chrome.tabs.update() targeting
// the *current* tab (as opposed to chrome.tabs.create()) suggest it's more
// likely to leave the omnibox focused. Not guaranteed — needs Frank's
// manual check in a real unpacked install, browser automation can't verify
// omnibox focus state.
//
// Chrome has no loadReplace option for tabs.update() (Firefox-only), so
// unlike the previous location.replace() call, this does leave one extra
// back-history entry pointing at this blank local stub.
const TARGET_URL = 'https://justsayknarf.github.io/emotions-wheel/?source=new-tab';

chrome.tabs.getCurrent().then((tab) => {
  if (tab) {
    chrome.tabs.update(tab.id, { url: TARGET_URL });
  } else {
    window.location.replace(TARGET_URL);
  }
});
