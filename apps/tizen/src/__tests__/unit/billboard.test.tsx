import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Billboard } from "../../components/Billboard";

// --- Mocks ---

vi.mock("@noriginmedia/norigin-spatial-navigation", () => ({
  useFocusable: (opts?: { onEnterPress?: () => void }) => ({
    ref: { current: null },
    focused: false,
    focusKey: "test",
    ...opts,
  }),
}));

vi.mock("../../components/SmartImage", () => ({
  SmartImage: ({ alt }: { alt: string }) => (
    <div data-testid="smart-image">{alt}</div>
  ),
}));

// --- Billboard unit tests ---

describe("Billboard", () => {
  it("renders title", () => {
    render(<Billboard title="Inception" />);
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("renders overview text", () => {
    render(
      <Billboard title="Inception" overview="A mind-bending thriller." />,
    );
    expect(screen.getByText("A mind-bending thriller.")).toBeInTheDocument();
  });

  it("renders content rating badge when provided", () => {
    render(<Billboard title="Inception" contentRating="PG-13" />);
    // ContentRatingBadge renders a colored text pill (no image assets).
    expect(screen.getByText("PG-13")).toBeInTheDocument();
  });

  it("does not render content rating badge when not provided", () => {
    const { container } = render(<Billboard title="Inception" />);
    // No rating badge span (only the title h1, optional overview p, and play button)
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(0);
  });

  it("Play button fires onPlay callback when clicked", () => {
    const onPlay = vi.fn();
    render(<Billboard title="Inception" onPlay={onPlay} />);
    fireEvent.click(screen.getByText("▶ Play"));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("renders backdrop image when backdropUrl provided", () => {
    render(
      <Billboard
        title="Inception"
        backdropUrl="https://example.com/backdrop.jpg"
      />,
    );
    expect(screen.getByTestId("smart-image")).toBeInTheDocument();
    expect(screen.getByTestId("smart-image")).toHaveTextContent("Inception");
  });

  it("renders placeholder when no backdropUrl", () => {
    const { container } = render(<Billboard title="Inception" />);
    // No SmartImage rendered
    expect(screen.queryByTestId("smart-image")).toBeNull();
    // Placeholder div with #222 background exists
    const placeholder = container.querySelector(
      '[style*="background: rgb(34, 34, 34)"]',
    );
    expect(placeholder).not.toBeNull();
  });
});
