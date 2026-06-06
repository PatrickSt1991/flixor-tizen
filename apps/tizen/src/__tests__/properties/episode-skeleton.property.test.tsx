import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  EpisodeSkeletonList,
  PLACEHOLDER_COUNT,
} from "../../components/EpisodeSkeletonList";

// Feature: tizen-parity-phase2, Property 25: Episode skeleton list renders correct count

describe("Property 25: Episode skeleton list renders correct count", () => {
  /**
   * **Validates: Requirements 17.1, 17.2**
   */

  // numRuns:100 × up to 50 rendered rows is borderline under full-suite
  // parallel load on slow filesystems — give it headroom over the 5s default
  // so it can't flake on a timeout (it always passes; see seed determinism).
  it("renders exactly count skeleton rows, each with PLACEHOLDER_COUNT skeleton elements", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (count) => {
        const { container } = render(<EpisodeSkeletonList count={count} />);
        const skeletons = container.querySelectorAll(".skeleton");

        // Total skeleton elements = count × PLACEHOLDER_COUNT (4)
        expect(skeletons.length).toBe(count * PLACEHOLDER_COUNT);
      }),
      { numRuns: 100 },
    );
  }, 15000);

  it("renders null when count is 0 or negative", () => {
    fc.assert(
      fc.property(fc.integer({ min: -100, max: 0 }), (count) => {
        const { container } = render(<EpisodeSkeletonList count={count} />);
        const skeletons = container.querySelectorAll(".skeleton");
        expect(skeletons.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("defaults to 6 rows when count is not provided", () => {
    const { container } = render(<EpisodeSkeletonList />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(6 * PLACEHOLDER_COUNT);
  });
});
