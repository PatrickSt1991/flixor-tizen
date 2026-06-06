import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { PlexMediaItem } from "@flixor/core";

vi.mock("@noriginmedia/norigin-spatial-navigation", () => ({
  useFocusable: (opts?: { onEnterPress?: () => void }) => ({
    ref: { current: null },
    focused: false,
    focusSelf: vi.fn(),
    ...opts,
  }),
}));

vi.mock("../../services/flixor", () => ({
  flixor: {
    plexServer: {
      getImageUrl: vi.fn((path: string) => `https://plex.test${path}`),
    },
  },
}));

vi.mock("../../components/SmartImage", () => ({
  SmartImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

import { ContinueWatchingPosterCard } from "../../components/ContinueWatchingPosterCard";

function makeItem(overrides: Partial<PlexMediaItem> = {}): PlexMediaItem {
  return {
    ratingKey: "123",
    key: "/library/metadata/123",
    type: "movie",
    title: "Test Movie",
    thumb: "/thumb/123",
    duration: 7200000,
    viewOffset: 3600000,
    ...overrides,
  } as PlexMediaItem;
}

describe("ContinueWatchingPosterCard", () => {
  it("renders the item title", () => {
    render(
      <ContinueWatchingPosterCard item={makeItem()} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("Test Movie")).toBeInTheDocument();
  });

  it("renders poster image via flixor", () => {
    render(
      <ContinueWatchingPosterCard item={makeItem()} onSelect={vi.fn()} />,
    );
    const img = screen.getByRole("img", { name: "Test Movie" });
    expect(img).toHaveAttribute("src", "https://plex.test/thumb/123");
  });

  it("shows progress bar with correct percentage", () => {
    const { container } = render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: 3600000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector('[style*="width: 50%"]');
    expect(bar).toBeTruthy();
  });

  it("shows duration remaining label", () => {
    render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: 3600000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("1h 0m left")).toBeInTheDocument();
  });

  it("calls onSelect with ratingKey on click", () => {
    const onSelect = vi.fn();
    render(
      <ContinueWatchingPosterCard
        item={makeItem({ ratingKey: "456" })}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("456");
  });

  it("hides progress bar when no viewOffset", () => {
    const { container } = render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: undefined, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector(
      '[style*="background: rgb(229, 9, 20)"]',
    );
    expect(bar).toBeNull();
  });

  it("uses the poster card class (2/3 ratio comes from .tv-card.poster CSS)", () => {
    const { container } = render(
      <ContinueWatchingPosterCard item={makeItem()} onSelect={vi.fn()} />,
    );
    // aspect-ratio is unsupported on Tizen WebViews; the 2/3 shape is enforced
    // by the .tv-card.poster rule (240x360) instead of an inline style.
    const btn = container.querySelector(".tv-card.poster");
    expect(btn).toBeTruthy();
  });
});
