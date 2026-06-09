import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ContentRatingBadge, {
  ContentRatingText,
} from "../../components/ContentRatingBadge";
import { isMatureRating } from "../../utils/contentRatingUtils";

// ── ContentRatingBadge ─────────────────────────────────────────────────

describe("ContentRatingBadge", () => {
  // ── Null on empty / undefined ──────────────────────────────────────

  it("returns null when rating is undefined", () => {
    const { container } = render(<ContentRatingBadge />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when rating is empty string", () => {
    const { container } = render(<ContentRatingBadge rating="" />);
    expect(container.firstChild).toBeNull();
  });

  // ── Colored text pill for known ratings ────────────────────────────
  // (Image badges were removed — the rating PNGs were never shipped, so the
  //  component always renders the colored text pill now.)

  const knownRatings = ["G", "PG", "PG-13", "R", "TV-G", "TV-PG", "TV-14", "TV-MA", "NR"];

  it.each(knownRatings)("renders a colored text pill for %s", (rating) => {
    render(<ContentRatingBadge rating={rating} />);
    const pill = screen.getByText(rating);
    expect(pill).toBeInTheDocument();
    expect(pill.tagName).toBe("SPAN");
  });

  // ── Normalization: variations map to canonical form ─────────────────

  const normalizedVariations = [
    { input: "TVMA", expected: "TV-MA" },
    { input: "tvpg", expected: "TV-PG" },
    { input: "PG13", expected: "PG-13" },
    { input: "TVY", expected: "TV-Y" },
    { input: "TVY7", expected: "TV-Y7" },
    { input: "NC17", expected: "NC-17" },
    { input: "NOTRATED", expected: "NR" },
    { input: "NOT RATED", expected: "NR" },
    { input: "UNRATED", expected: "NR" },
  ];

  it.each(normalizedVariations)(
    "normalizes '$input' to '$expected'",
    ({ input, expected }) => {
      render(<ContentRatingBadge rating={input} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  // ── Unknown rating falls back to gray text pill ────────────────────

  it("renders gray text pill for unknown rating", () => {
    render(<ContentRatingBadge rating="XYZZY" />);
    const pill = screen.getByText("XYZZY");
    expect(pill).toBeInTheDocument();
    expect(pill.tagName).toBe("SPAN");
    // Gray color scheme (jsdom normalizes hex → rgb)
    expect(pill.style.color).toBe("rgb(163, 163, 163)");
  });

  // ── Color categories via text pill (ratings without image assets) ──

  describe("color categories for text pill fallback", () => {
    it("green for TV-Y", () => {
      render(<ContentRatingBadge rating="TV-Y" />);
      const pill = screen.getByText("TV-Y");
      expect(pill.style.color).toBe("rgb(74, 222, 128)");
    });

    it("green for TV-Y7", () => {
      render(<ContentRatingBadge rating="TV-Y7" />);
      const pill = screen.getByText("TV-Y7");
      expect(pill.style.color).toBe("rgb(74, 222, 128)");
    });

    it("dark red for NC-17", () => {
      render(<ContentRatingBadge rating="NC-17" />);
      const pill = screen.getByText("NC-17");
      expect(pill.style.color).toBe("rgb(252, 165, 165)");
    });
  });

  // ── Size prop ──────────────────────────────────────────────────────

  it("applies size font to large text pill", () => {
    render(<ContentRatingBadge rating="G" size="lg" />);
    const pill = screen.getByText("G");
    expect(pill.style.fontSize).toBe("14px");
  });

  it("applies size font to text pill", () => {
    render(<ContentRatingBadge rating="CUSTOM" size="sm" />);
    const pill = screen.getByText("CUSTOM");
    expect(pill.style.fontSize).toBe("9px");
  });
});

// ── ContentRatingText ──────────────────────────────────────────────────

describe("ContentRatingText", () => {
  it("returns null for undefined rating", () => {
    const { container } = render(<ContentRatingText />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty string rating", () => {
    const { container } = render(<ContentRatingText rating="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders normalized rating text with correct color", () => {
    render(<ContentRatingText rating="R" />);
    const el = screen.getByText("R");
    expect(el).toBeInTheDocument();
    expect(el.style.color).toBe("rgb(248, 113, 113)");
  });

  it("uses gray color for unknown rating", () => {
    render(<ContentRatingText rating="UNKNOWN" />);
    const el = screen.getByText("UNKNOWN");
    expect(el.style.color).toBe("rgb(163, 163, 163)");
  });
});

// ── isMatureRating ─────────────────────────────────────────────────────

describe("isMatureRating", () => {
  it("returns false for undefined", () => {
    expect(isMatureRating(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isMatureRating("")).toBe(false);
  });

  const matureRatings = ["R", "NC-17", "TV-MA", "TV-14"];
  it.each(matureRatings)("returns true for %s", (rating) => {
    expect(isMatureRating(rating)).toBe(true);
  });

  it("returns true for unnormalized mature ratings", () => {
    expect(isMatureRating("TVMA")).toBe(true);
    expect(isMatureRating("NC17")).toBe(true);
    expect(isMatureRating("TV14")).toBe(true);
  });

  const nonMatureRatings = ["G", "PG", "PG-13", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "NR"];
  it.each(nonMatureRatings)("returns false for %s", (rating) => {
    expect(isMatureRating(rating)).toBe(false);
  });

  it("returns false for unknown rating", () => {
    expect(isMatureRating("XYZZY")).toBe(false);
  });
});
