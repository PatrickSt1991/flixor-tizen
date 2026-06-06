import { describe, it, expect } from 'vitest';
import { computeLayout } from '../../components/VirtualGrid';

describe('VirtualGrid — computeLayout Unit Tests', () => {
  // --- Zero items ---

  describe('zero items', () => {
    it('returns rowCount=0 and totalHeight=0', () => {
      const layout = computeLayout(800, 600, 0, 0, 160, 280, 12, 3);
      expect(layout.rowCount).toBe(0);
      expect(layout.totalHeight).toBe(0);
    });

    it('columnCount is still computed from container width', () => {
      const layout = computeLayout(800, 600, 0, 0, 160, 280, 12, 3);
      // floor((800 + 12) / (160 + 12)) = floor(812 / 172) = floor(4.72) = 4
      expect(layout.columnCount).toBe(4);
    });
  });

  // --- Single item ---

  describe('single item', () => {
    it('produces 1 row with correct totalHeight', () => {
      const layout = computeLayout(800, 600, 0, 1, 160, 280, 12, 3);
      expect(layout.rowCount).toBe(1);
      // 1 * (280 + 12) = 292
      expect(layout.totalHeight).toBe(292);
    });

    it('visibleStartRow is 0 and visibleEndRow is 1 at scrollTop=0', () => {
      const layout = computeLayout(800, 600, 0, 1, 160, 280, 12, 3);
      expect(layout.visibleStartRow).toBe(0);
      expect(layout.visibleEndRow).toBe(1);
    });
  });

  // --- Exact fit: items fill exactly N rows ---

  describe('exact fit', () => {
    it('8 items with 4 columns fills exactly 2 rows', () => {
      // 4 columns from width 800: floor((800+12)/(160+12)) = 4
      const layout = computeLayout(800, 600, 0, 8, 160, 280, 12, 3);
      expect(layout.columnCount).toBe(4);
      expect(layout.rowCount).toBe(2);
      expect(layout.totalHeight).toBe(2 * (280 + 12));
    });

    it('12 items with 4 columns fills exactly 3 rows', () => {
      const layout = computeLayout(800, 600, 0, 12, 160, 280, 12, 3);
      expect(layout.rowCount).toBe(3);
    });

    it('partial last row: 9 items with 4 columns produces 3 rows', () => {
      const layout = computeLayout(800, 600, 0, 9, 160, 280, 12, 3);
      expect(layout.rowCount).toBe(3); // ceil(9/4) = 3
    });
  });

  // --- Container width exactly fits N columns ---

  describe('container width column boundaries', () => {
    it('width exactly fits 1 column', () => {
      // columnWidth=160, gap=12 → need exactly 160 for 1 col
      // floor((160 + 12) / (160 + 12)) = 1
      const layout = computeLayout(160, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.columnCount).toBe(1);
    });

    it('width exactly fits 2 columns', () => {
      // 2 cols: 160 + 12 + 160 = 332, floor((332+12)/(160+12)) = floor(344/172) = 2
      const layout = computeLayout(332, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.columnCount).toBe(2);
    });

    it('width just below 2 columns stays at 1', () => {
      // 2 cols need: 2*(160+12) - 12 = 332. At 331: floor((331+12)/172) = floor(343/172) = 1
      const layout = computeLayout(331, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.columnCount).toBe(1);
    });

    it('width just above 2 columns gives 2', () => {
      const layout = computeLayout(333, 600, 0, 10, 160, 280, 12, 3);
      // floor((333+12)/172) = floor(345/172) = 2
      expect(layout.columnCount).toBe(2);
    });
  });

  // --- Container width = 0 (column count defaults to 1) ---

  describe('container width = 0', () => {
    it('defaults columnCount to 1', () => {
      const layout = computeLayout(0, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.columnCount).toBe(1);
    });

    it('rowCount equals itemCount when columnCount is 1', () => {
      const layout = computeLayout(0, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.rowCount).toBe(10);
    });

    it('totalHeight is correct with 1 column', () => {
      const layout = computeLayout(0, 600, 0, 10, 160, 280, 12, 3);
      expect(layout.totalHeight).toBe(10 * (280 + 12));
    });
  });

  // --- Large scroll position beyond content ---

  describe('large scroll position beyond content', () => {
    it('visibleEndRow is clamped to rowCount', () => {
      // 10 items, 4 cols → 3 rows, totalHeight = 3*292 = 876
      const layout = computeLayout(800, 600, 50000, 10, 160, 280, 12, 3);
      expect(layout.visibleEndRow).toBeLessThanOrEqual(layout.rowCount);
    });

    it('visibleStartRow stays non-negative', () => {
      const layout = computeLayout(800, 600, 50000, 10, 160, 280, 12, 3);
      expect(layout.visibleStartRow).toBeGreaterThanOrEqual(0);
    });
  });

  // --- Various overscan values ---

  describe('overscan behavior', () => {
    it('overscan=0 renders only rows in viewport', () => {
      // 100 items, 4 cols → 25 rows, rowHeight+gap=292
      // viewport=600 → ceil(600/292) = 3 visible rows (rows 0,1,2)
      const layout = computeLayout(800, 600, 0, 100, 160, 280, 12, 0);
      expect(layout.visibleStartRow).toBe(0);
      // ceil((0+600)/292) + 0 = ceil(2.05) = 3
      expect(layout.visibleEndRow).toBe(3);
    });

    it('overscan=3 extends visible range by 3 rows in each direction', () => {
      // Scroll to row 10: scrollTop = 10 * 292 = 2920
      // 100 items, 4 cols → 25 rows
      const layout = computeLayout(800, 600, 2920, 100, 160, 280, 12, 3);
      // visibleStartRow = max(0, floor(2920/292) - 3) = max(0, 10 - 3) = 7
      expect(layout.visibleStartRow).toBe(7);
      // visibleEndRow = min(25, ceil((2920+600)/292) + 3) = min(25, ceil(12.05) + 3) = min(25, 16) = 16
      expect(layout.visibleEndRow).toBe(16);
    });

    it('overscan does not push visibleStartRow below 0', () => {
      // scrollTop=0, overscan=5
      const layout = computeLayout(800, 600, 0, 100, 160, 280, 12, 5);
      expect(layout.visibleStartRow).toBe(0);
    });

    it('overscan does not push visibleEndRow beyond rowCount', () => {
      // 4 items, 4 cols → 1 row, overscan=10
      const layout = computeLayout(800, 600, 0, 4, 160, 280, 12, 10);
      expect(layout.visibleEndRow).toBeLessThanOrEqual(layout.rowCount);
    });
  });

  // --- Scroll position within content ---

  describe('scroll position within content', () => {
    it('scrolling down shifts visible row range', () => {
      // 200 items, 4 cols → 50 rows
      const atTop = computeLayout(800, 600, 0, 200, 160, 280, 12, 3);
      const scrolled = computeLayout(800, 600, 5000, 200, 160, 280, 12, 3);

      expect(scrolled.visibleStartRow).toBeGreaterThan(atTop.visibleStartRow);
      expect(scrolled.visibleEndRow).toBeGreaterThan(atTop.visibleEndRow);
    });

    it('row and column counts are independent of scroll position', () => {
      const a = computeLayout(800, 600, 0, 100, 160, 280, 12, 3);
      const b = computeLayout(800, 600, 3000, 100, 160, 280, 12, 3);

      expect(a.columnCount).toBe(b.columnCount);
      expect(a.rowCount).toBe(b.rowCount);
      expect(a.totalHeight).toBe(b.totalHeight);
    });
  });

  // --- Different container widths produce different column counts ---

  describe('resize behavior — different widths produce different column counts', () => {
    it('narrow container has fewer columns than wide container', () => {
      const narrow = computeLayout(300, 600, 0, 50, 160, 280, 12, 3);
      const wide = computeLayout(1200, 600, 0, 50, 160, 280, 12, 3);

      expect(narrow.columnCount).toBeLessThan(wide.columnCount);
    });

    it('more columns means fewer rows for same item count', () => {
      const narrow = computeLayout(300, 600, 0, 50, 160, 280, 12, 3);
      const wide = computeLayout(1200, 600, 0, 50, 160, 280, 12, 3);

      expect(wide.rowCount).toBeLessThan(narrow.rowCount);
    });
  });

  // --- Gap = 0 edge case ---

  describe('gap = 0', () => {
    it('columns are computed without gap spacing', () => {
      // floor((800 + 0) / (160 + 0)) = 5
      const layout = computeLayout(800, 600, 0, 20, 160, 280, 0, 3);
      expect(layout.columnCount).toBe(5);
    });

    it('totalHeight has no gap contribution', () => {
      const layout = computeLayout(800, 600, 0, 5, 160, 280, 0, 3);
      // 5 cols, 1 row → totalHeight = 1 * 280 = 280
      expect(layout.totalHeight).toBe(280);
    });
  });
});
