import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlexMediaItem } from "@flixor/core";

// --- Mocks ---

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

import { ContinueWatchingLandscapeCard } from "../../components/ContinueWatchingLandscapeCard";
import { ContinueWatchingPosterCard } from "../../components/ContinueWatchingPosterCard";
import { loadSettings, saveSettings } from "../../services/settings";

function makeItem(overrides: Partial<PlexMediaItem> = {}): PlexMediaItem {
  return {
    ratingKey: "100",
    key: "/library/metadata/100",
    type: "movie",
    title: "Integration Test Movie",
    thumb: "/thumb/100",
    duration: 7200000,
    viewOffset: 3600000,
    ...overrides,
  } as PlexMediaItem;
}

beforeEach(() => {
  localStorage.clear();
});

// ─── Progress bar edge cases ───

describe("Progress bar percentage edge cases", () => {
  it("shows 0% (no bar) when viewOffset is 0", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({ viewOffset: 0, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const progressFill = container.querySelector(
      '[style*="background: rgb(229, 9, 20)"]',
    );
    expect(progressFill).toBeNull();
  });

  it("caps progress at 100% when viewOffset exceeds duration", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({ viewOffset: 9000000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector('[style*="width: 100%"]');
    expect(bar).toBeTruthy();
  });

  it("caps progress at 100% when viewOffset equals duration", () => {
    const { container } = render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: 7200000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector('[style*="width: 100%"]');
    expect(bar).toBeTruthy();
  });

  it("calculates correct percentage for 25% watched", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({ viewOffset: 1800000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector('[style*="width: 25%"]');
    expect(bar).toBeTruthy();
  });

  it("calculates correct percentage for 75% watched", () => {
    const { container } = render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: 5400000, duration: 7200000 })}
        onSelect={vi.fn()}
      />,
    );
    const bar = container.querySelector('[style*="width: 75%"]');
    expect(bar).toBeTruthy();
  });

  it("shows no progress bar when duration is undefined", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({ viewOffset: 3600000, duration: undefined })}
        onSelect={vi.fn()}
      />,
    );
    const progressFill = container.querySelector(
      '[style*="background: rgb(229, 9, 20)"]',
    );
    expect(progressFill).toBeNull();
  });

  it("shows no progress bar when both viewOffset and duration are undefined", () => {
    const { container } = render(
      <ContinueWatchingPosterCard
        item={makeItem({ viewOffset: undefined, duration: undefined })}
        onSelect={vi.fn()}
      />,
    );
    const progressFill = container.querySelector(
      '[style*="background: rgb(229, 9, 20)"]',
    );
    expect(progressFill).toBeNull();
  });
});

// ─── Episode info formatting edge cases ───

describe("Episode info formatting edge cases", () => {
  it("formats S01E05 with zero-padding for single digits", () => {
    render(
      <ContinueWatchingLandscapeCard
        item={makeItem({
          type: "episode",
          title: "Pilot",
          grandparentTitle: "Breaking Bad",
          parentIndex: 1,
          index: 5,
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("S01E05")).toBeInTheDocument();
  });

  it("formats S12E24 without extra padding for multi-digit numbers", () => {
    render(
      <ContinueWatchingLandscapeCard
        item={makeItem({
          type: "episode",
          title: "Finale",
          grandparentTitle: "Long Show",
          parentIndex: 12,
          index: 24,
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("S12E24")).toBeInTheDocument();
  });

  it("shows no episode info when parentIndex is missing", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({
          type: "episode",
          title: "No Season",
          grandparentTitle: "Some Show",
          parentIndex: undefined,
          index: 3,
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/S\d+E\d+/);
  });

  it("shows no episode info when index is missing", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({
          type: "episode",
          title: "No Episode Num",
          grandparentTitle: "Some Show",
          parentIndex: 2,
          index: undefined,
        })}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/S\d+E\d+/);
  });

  it("shows no episode info for movies", () => {
    const { container } = render(
      <ContinueWatchingLandscapeCard
        item={makeItem({ type: "movie", title: "A Movie" })}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).not.toMatch(/S\d+E\d+/);
  });
});

// ─── Poster vs landscape rendering based on settings ───

describe("Card style switching via continueWatchingCardStyle setting", () => {
  it("renders landscape card when setting is 'landscape'", () => {
    saveSettings({ continueWatchingCardStyle: "landscape" });
    const style = loadSettings().continueWatchingCardStyle ?? "landscape";
    const CardComponent =
      style === "poster"
        ? ContinueWatchingPosterCard
        : ContinueWatchingLandscapeCard;

    const { container } = render(
      <CardComponent item={makeItem()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".tv-card.landscape")).toBeTruthy();
    expect(container.querySelector(".tv-card.poster")).toBeNull();
  });

  it("renders poster card when setting is 'poster'", () => {
    saveSettings({ continueWatchingCardStyle: "poster" });
    const style = loadSettings().continueWatchingCardStyle ?? "landscape";
    const CardComponent =
      style === "poster"
        ? ContinueWatchingPosterCard
        : ContinueWatchingLandscapeCard;

    const { container } = render(
      <CardComponent item={makeItem()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".tv-card.poster")).toBeTruthy();
    expect(container.querySelector(".tv-card.landscape")).toBeNull();
  });

  it("defaults to landscape card when setting is not set", () => {
    // No settings saved — should default to landscape
    const style = loadSettings().continueWatchingCardStyle ?? "landscape";
    const CardComponent =
      style === "poster"
        ? ContinueWatchingPosterCard
        : ContinueWatchingLandscapeCard;

    const { container } = render(
      <CardComponent item={makeItem()} onSelect={vi.fn()} />,
    );
    expect(container.querySelector(".tv-card.landscape")).toBeTruthy();
    expect(container.querySelector(".tv-card.poster")).toBeNull();
  });

  it("uses the correct component type based on setting", () => {
    saveSettings({ continueWatchingCardStyle: "poster" });
    const style = loadSettings().continueWatchingCardStyle;
    expect(style).toBe("poster");

    const CardComponent =
      style === "poster"
        ? ContinueWatchingPosterCard
        : ContinueWatchingLandscapeCard;

    // Poster card 2/3 shape comes from the .tv-card.poster CSS rule
    const { container } = render(
      <CardComponent item={makeItem()} onSelect={vi.fn()} />,
    );
    const card = container.querySelector(".tv-card.poster");
    expect(card).toBeTruthy();
  });
});
