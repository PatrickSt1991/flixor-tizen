import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  type JSX,
} from "react";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";

export interface VirtualGridItem {
  id: string;
  [key: string]: unknown;
}

export interface VirtualGridProps<T extends VirtualGridItem> {
  items: T[];
  rowHeight?: number;
  columnWidth?: number;
  gap?: number;
  overscan?: number;
  render: (item: T) => JSX.Element;
  hasMore?: boolean;
  loadMore?: () => void;
}

import { computeLayout } from "../utils/virtualGridUtils";

function GridItem<T extends VirtualGridItem>({
  item,
  style,
  render,
}: {
  item: T;
  style: React.CSSProperties;
  render: (item: T) => JSX.Element;
}) {
  // Plain positioning wrapper — NOT focusable. The rendered card is itself a
  // norigin focusable; making this a focusable too created two focusables per
  // cell, and norigin resolved them inconsistently by direction (down landed
  // on the card, up landed on this wrapper) — so up lost the card focus and
  // the grid scrolled with nothing highlighted. The card scrolls itself.
  return (
    <div style={style} className="virtual-grid-item">
      {render(item)}
    </div>
  );
}

function InfiniteSentinel({
  onVisible,
  rootRef,
}: {
  onVisible: () => void;
  rootRef: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const rootEl = rootRef.current as Element | null;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) onVisibleRef.current();
        }
      },
      { root: rootEl || undefined, rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef]);

  return (
    <div
      ref={ref}
      style={{ position: "absolute", bottom: 0, height: 1, width: "100%" }}
    />
  );
}

export function VirtualGrid<T extends VirtualGridItem>({
  items,
  rowHeight = 420, // poster (360) + title label below it
  columnWidth = 240,
  gap = 25,
  overscan = 5,
  render,
  hasMore,
  loadMore,
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [containerWidth, setContainerWidth] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  // norigin's ref is attached to the scrolling <div> via ref={focusRef}, so
  // React populates focusRef.current at commit — i.e. BEFORE this effect runs.
  // (The previous code measured a separate containerRef that was only synced
  // in a *later* effect, so at mount it was null, the effect bailed, width
  // stayed 0, computeLayout fell back to one column and the scroll listener
  // never attached: no grid, no scrolling.)
  const { ref: focusRef, focusKey } = useFocusable({
    trackChildren: true,
    isFocusBoundary: true,
    // Trap only left/right (edge columns); up/down may leave the grid
    // toward the filter bar / nav.
    focusBoundaryDirections: ["left", "right"],
  });
  // Alias for the InfiniteSentinel rootRef below; effects read focusRef.current
  // directly so the deps linter recognizes it as a ref.
  const containerRef = focusRef as React.RefObject<HTMLDivElement>;

  // Measure container and attach scroll/resize listeners
  useEffect(() => {
    const el = focusRef.current;
    if (!el) return;

    const measure = () => {
      setViewportHeight(el.clientHeight);
      setContainerWidth(el.clientWidth);
    };
    measure();

    // RAF-throttled scroll handler
    const onScroll = () => {
      lastScrollTopRef.current = el.scrollTop;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setScrollTop(lastScrollTopRef.current);
        });
      }
    };

    el.addEventListener("scroll", onScroll, { passive: true });

    // ResizeObserver with fallback to window.resize
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(el);
    } else {
      window.addEventListener("resize", measure);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener("resize", measure);
      }
    };
    // focusRef is a stable ref from norigin; measure once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = useMemo(
    () =>
      computeLayout(
        containerWidth,
        viewportHeight,
        scrollTop,
        items.length,
        columnWidth,
        rowHeight,
        gap,
        overscan,
      ),
    [
      containerWidth,
      viewportHeight,
      scrollTop,
      items.length,
      columnWidth,
      rowHeight,
      gap,
      overscan,
    ],
  );

  const visibleItems = useMemo(() => {
    const out: Array<{ item: T; style: React.CSSProperties; key: string }> = [];
    for (let r = layout.visibleStartRow; r < layout.visibleEndRow; r++) {
      for (let c = 0; c < layout.columnCount; c++) {
        const idx = r * layout.columnCount + c;
        const item = items[idx];
        if (!item) break;
        out.push({
          item,
          key: item.id,
          style: {
            position: "absolute",
            top: r * (rowHeight + gap),
            left: c * (columnWidth + gap),
            width: columnWidth,
            height: rowHeight,
          },
        });
      }
    }
    return out;
  }, [items, layout, rowHeight, gap, columnWidth]);

  const handleLoadMore = useCallback(() => {
    loadMore?.();
  }, [loadMore]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={focusRef}
        className="virtual-grid-container"
        style={{
          height: "calc(100vh - 200px)",
          overflow: "auto",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            height: layout.totalHeight,
            margin: gap / 2,
          }}
        >
          {visibleItems.map(({ item, style, key }) => (
            <GridItem
              key={key}
              item={item}
              style={style}
              render={render}
            />
          ))}
        </div>
        {hasMore && (
          <InfiniteSentinel rootRef={containerRef} onVisible={handleLoadMore} />
        )}
      </div>
    </FocusContext.Provider>
  );
}
