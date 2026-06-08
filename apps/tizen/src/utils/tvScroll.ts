/**
 * Deterministic focus-follow scrolling for TV.
 *
 * scrollIntoView is unusable for this on the Tizen WebView: it resolves the
 * "nearest scrollable ancestor" itself and repeatedly picked the wrong one —
 * scrolling the page sideways, or dumping vertical centering into a row's few
 * hidden overflow pixels so the page never moved. We instead find the nearest
 * scroller PER AXIS ourselves and centre the element inside it with rect math.
 *
 * This works for every scroll context without hardcoding class names:
 *   - Home rows:   horizontal scroller = .tv-row,  vertical = .tv-container
 *   - Library grid: horizontal scroller = none,    vertical = .virtual-grid-container
 */

function isScrollable(el: HTMLElement, axis: "x" | "y"): boolean {
  const style = getComputedStyle(el);
  const overflow = axis === "x" ? style.overflowX : style.overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return axis === "x"
    ? el.scrollWidth > el.clientWidth
    : el.scrollHeight > el.clientHeight;
}

function nearestScroller(el: HTMLElement, axis: "x" | "y"): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    if (isScrollable(node, axis)) return node;
    node = node.parentElement;
  }
  return null;
}

export function scrollFocusedIntoView(el: HTMLElement | null): void {
  if (!el) return;

  // Horizontal: centre the card within its nearest horizontal scroller.
  const hScroller = nearestScroller(el, "x");
  if (hScroller) {
    const er = el.getBoundingClientRect();
    const sr = hScroller.getBoundingClientRect();
    const delta = er.left + er.width / 2 - (sr.left + sr.width / 2);
    if (Math.abs(delta) > 1) {
      hScroller.scrollTo({
        left: Math.max(0, hScroller.scrollLeft + delta),
        behavior: "auto",
      });
    }
  }

  // Vertical: centre within the nearest vertical scroller (re-read the rect —
  // the horizontal scroll above may have moved the element).
  const vScroller = nearestScroller(el, "y");
  if (vScroller) {
    const er = el.getBoundingClientRect();
    const sr = vScroller.getBoundingClientRect();
    const delta = er.top + er.height / 2 - (sr.top + sr.height / 2);
    if (Math.abs(delta) > 1) {
      vScroller.scrollTo({
        top: Math.max(0, vScroller.scrollTop + delta),
        behavior: "auto",
      });
    }
  }
}
