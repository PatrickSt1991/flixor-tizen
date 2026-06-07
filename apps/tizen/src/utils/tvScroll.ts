/**
 * Deterministic focus-follow scrolling for TV.
 *
 * scrollIntoView proved untrustworthy on the Tizen WebView: with the page as
 * the only scroller, inline:"center" shifted the WHOLE page sideways (hidden
 * overflow is programmatically scrollable); after making rows their own
 * horizontal scrollers, block:"center" was consumed by the row's hidden
 * overflow-y instead of scrolling the page. Rect math on explicit containers
 * has no such ambiguity:
 *   - horizontal: center the card inside its .tv-row scroller (if any)
 *   - vertical:   center the card inside the page .tv-container scroller
 */
export function scrollFocusedIntoView(el: HTMLElement | null): void {
  if (!el) return;

  const row = el.closest(".tv-row") as HTMLElement | null;
  if (row && row.scrollWidth > row.clientWidth) {
    const er = el.getBoundingClientRect();
    const rr = row.getBoundingClientRect();
    const delta = er.left + er.width / 2 - (rr.left + rr.width / 2);
    if (Math.abs(delta) > 1) {
      row.scrollTo({ left: Math.max(0, row.scrollLeft + delta), behavior: "auto" });
    }
  }

  const page = el.closest(".tv-container") as HTMLElement | null;
  if (page) {
    const er = el.getBoundingClientRect(); // re-read: horizontal scroll above moved it
    const pr = page.getBoundingClientRect();
    const delta = er.top + er.height / 2 - (pr.top + pr.height / 2);
    if (Math.abs(delta) > 1) {
      page.scrollTo({ top: Math.max(0, page.scrollTop + delta), behavior: "auto" });
    }
  }
}
