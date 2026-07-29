/**
 * Background service worker. Deliberately thin: the extension has no backend and
 * does no analysis here. It only configures side-panel availability. The heavy
 * lifting (extraction, LLM calls, parsing) happens in the content script and the
 * side-panel/popup React apps.
 *
 * Note: `chrome.sidePanel.open()` must be called from a user gesture, so the
 * popup opens the panel directly rather than routing through this worker.
 */

chrome.runtime.onInstalled.addListener(() => {
  // The toolbar action shows our popup; the side panel is opened explicitly from
  // the popup, so we disable "open on action click" to avoid a double surface.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    /* older Chrome without setPanelBehavior — safe to ignore */
  });
});
