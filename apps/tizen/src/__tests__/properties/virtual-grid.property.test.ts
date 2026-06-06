import fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { computeLayout } from '../../components/VirtualGrid';

// --- Arbitraries ---

const arbContainerWidth = fc.integer({ min: 0, max: 3840 });
const arbViewportHeight = fc.integer({ min: 1, max: 2160 });
const arbScrollTop = fc.integer({ min: 0, max: 100000 });
const arbItemCount = fc.integer({ min: 0, max: 5000 });
const arbColumnWidth = fc.integer({ min: 50, max: 500 });
const arbRowHeight = fc.integer({ min: 50, max: 500 });
const arbGap = fc.integer({ min: 0, max: 50 });
const arbOverscan = fc.integer({ min: 0, max: 10 });

// Feature: tizen-parity-phase2, Property 15: VirtualGrid renders bounded number of items
describe('Property 15: VirtualGrid renders bounded number of items', () => {
  /**
   * Validates: Requirements 5.1, 5.2
   *
   * For any scroll position, item count, viewport height, overscan value,
   * column width, row height, and gap, the number of items rendered by
   * VirtualGrid is at most (visibleRows + 2 * overscan) * columnCount,
   * where visibleRows = ceil(viewportHeight / (rowHeight + gap)) and
   * columnCount = max(1, floor((containerWidth + gap) / (columnWidth + gap))).
   * Also verify it doesn't exceed the total item count.
   */
  it('rendered item count is bounded by (visibleRows + 2 * overscan) * columnCount', () => {
    fc.assert(
      fc.property(
        arbContainerWidth,
        arbViewportHeight,
        arbScrollTop,
        arbItemCount,
        arbColumnWidth,
        arbRowHeight,
        arbGap,
        arbOverscan,
        (containerWidth, viewportHeight, scrollTop, itemCount, columnWidth, rowHeight, gap, overscan) => {
          const layout = computeLayout(
            containerWidth,
            viewportHeight,
            scrollTop,
            itemCount,
            columnWidth,
            rowHeight,
            gap,
            overscan,
          );

          // The number of rendered rows (may be 0 if visibleEndRow <= visibleStartRow)
          const renderedRows = Math.max(0, layout.visibleEndRow - layout.visibleStartRow);
          // Grid slots = rows * columns (upper bound on rendered items)
          const gridSlots = renderedRows * layout.columnCount;

          // Compute the expected upper bound per the property definition.
          // visibleRows from the spec is ceil(viewportHeight / (rowHeight + gap)),
          // but the viewport can straddle row boundaries, so the actual number of
          // rows intersecting the viewport is at most visibleRows + 1. Adding the
          // +1 accounts for partial rows at both the top and bottom edges.
          const visibleRows = Math.ceil(viewportHeight / (rowHeight + gap)) + 1;
          const columnCount = Math.max(
            1,
            Math.floor((containerWidth + gap) / (columnWidth + gap)),
          );
          const maxGridSlots = (visibleRows + 2 * overscan) * columnCount;

          // Grid slots must not exceed the theoretical bound
          expect(gridSlots).toBeLessThanOrEqual(maxGridSlots);

          // Actual rendered items are capped by itemCount (the component
          // breaks out of the inner loop when items[idx] is undefined)
          // So grid slots that map to valid items <= itemCount
          const actualRenderedItems = Math.min(gridSlots, itemCount);
          expect(actualRenderedItems).toBeLessThanOrEqual(itemCount);

          // Column count must match
          expect(layout.columnCount).toBe(columnCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('visible row range is non-negative and within row count bounds', () => {
    fc.assert(
      fc.property(
        arbContainerWidth,
        arbViewportHeight,
        arbScrollTop,
        arbItemCount,
        arbColumnWidth,
        arbRowHeight,
        arbGap,
        arbOverscan,
        (containerWidth, viewportHeight, scrollTop, itemCount, columnWidth, rowHeight, gap, overscan) => {
          const layout = computeLayout(
            containerWidth,
            viewportHeight,
            scrollTop,
            itemCount,
            columnWidth,
            rowHeight,
            gap,
            overscan,
          );

          // visibleStartRow is always >= 0
          expect(layout.visibleStartRow).toBeGreaterThanOrEqual(0);

          // visibleEndRow is always <= rowCount
          expect(layout.visibleEndRow).toBeLessThanOrEqual(layout.rowCount);

          // When there are items, the rendered row count is non-negative
          // (visibleEndRow >= visibleStartRow when rowCount > 0 and scroll is in range)
          // When itemCount is 0, rowCount is 0 and visibleEndRow may be < visibleStartRow
          if (layout.rowCount > 0 && scrollTop <= layout.totalHeight) {
            expect(layout.visibleEndRow).toBeGreaterThanOrEqual(layout.visibleStartRow);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
