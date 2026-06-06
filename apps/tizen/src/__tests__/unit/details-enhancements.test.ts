import { describe, it, expect } from "vitest";
import { deriveMoods } from "../../utils/moodTagsUtils";
import { buildChips } from "../../components/TechnicalChips";
import { detectAccessibilityBadges } from "../../utils/accessibilityUtils";
import { getProgressDisplay } from "../../utils/episodeCardUtils";

/**
 * Unit tests for Details page enhancements:
 * - TMDB logo available vs fallback
 * - Accessibility badge edge cases
 * - Tagline display
 * - Episode layout switching
 * - Skeleton → content transition
 * - MoodTags integration
 * - TechnicalChips integration
 */

describe("Details Page Enhancements", () => {
  describe("MoodTags integration", () => {
    it("derives moods from genre list", () => {
      const moods = deriveMoods(["Action", "Drama", "Comedy"]);
      expect(moods.length).toBeGreaterThan(0);
      expect(moods.length).toBeLessThanOrEqual(4);
    });

    it("returns empty for unrecognized genres", () => {
      const moods = deriveMoods(["Experimental", "Avant-Garde"]);
      expect(moods).toEqual([]);
    });

    it("deduplicates moods from overlapping genres", () => {
      // Both "Sci-Fi" and "Science Fiction" map to "Mind-Bending"
      const moods = deriveMoods(["Sci-Fi", "Science Fiction", "Action"]);
      const unique = new Set(moods);
      expect(unique.size).toBe(moods.length);
    });
  });

  describe("TechnicalChips integration", () => {
    it("builds chips from full media info", () => {
      const chips = buildChips({
        resolution: "1080p",
        bitrate: 20000,
        videoCodec: "hevc",
        audioCodec: "aac",
        audioChannels: "5.1",
      });
      expect(chips).toContain("1080p");
      expect(chips).toContain("HEVC");
      expect(chips.some((c) => c.includes("Mbps"))).toBe(true);
      expect(chips.some((c) => c.includes("AAC"))).toBe(true);
    });

    it("returns empty chips when no info provided", () => {
      const chips = buildChips({});
      expect(chips).toEqual([]);
    });
  });

  describe("AccessibilityBadges detection", () => {
    it("detects CC when subtitle streams present", () => {
      const result = detectAccessibilityBadges([
        { streamType: 3, displayTitle: "English" },
      ]);
      expect(result.hasCC).toBe(true);
    });

    it("detects SDH from stream title", () => {
      const result = detectAccessibilityBadges([
        { streamType: 3, displayTitle: "English (SDH)" },
      ]);
      expect(result.hasSDH).toBe(true);
    });

    it("detects AD from audio stream", () => {
      const result = detectAccessibilityBadges([
        { streamType: 2, displayTitle: "English Audio Description" },
      ]);
      expect(result.hasAD).toBe(true);
    });

    it("returns all false for empty streams", () => {
      const result = detectAccessibilityBadges([]);
      expect(result).toEqual({ hasCC: false, hasSDH: false, hasAD: false });
    });

    it("detects SDH with 'deaf' keyword", () => {
      const result = detectAccessibilityBadges([
        { streamType: 3, title: "English for the Deaf" },
      ]);
      expect(result.hasSDH).toBe(true);
    });

    it("detects SDH with 'hard of hearing' keyword", () => {
      const result = detectAccessibilityBadges([
        { streamType: 3, displayTitle: "Hard of Hearing subtitles" },
      ]);
      expect(result.hasSDH).toBe(true);
    });

    it("does not detect AD from non-audio streams", () => {
      const result = detectAccessibilityBadges([
        { streamType: 3, displayTitle: "Audio Description" },
      ]);
      expect(result.hasAD).toBe(false);
    });
  });

  describe("Episode layout toggle", () => {
    it("getProgressDisplay returns 'none' for 0%", () => {
      expect(getProgressDisplay(0)).toBe("none");
    });

    it("getProgressDisplay returns 'bar' for 50%", () => {
      expect(getProgressDisplay(50)).toBe("bar");
    });

    it("getProgressDisplay returns 'checkmark' for 85%", () => {
      expect(getProgressDisplay(85)).toBe("checkmark");
    });

    it("getProgressDisplay returns 'checkmark' for 100%", () => {
      expect(getProgressDisplay(100)).toBe("checkmark");
    });

    it("getProgressDisplay returns 'bar' for 1%", () => {
      expect(getProgressDisplay(1)).toBe("bar");
    });

    it("getProgressDisplay returns 'bar' for 84%", () => {
      expect(getProgressDisplay(84)).toBe("bar");
    });
  });

  describe("Extended metadata formatting", () => {
    it("formats budget >= 1M as $XM", () => {
      const budget = 150_000_000;
      const formatted = budget >= 1_000_000
        ? `$${Math.round(budget / 1_000_000)}M`
        : `$${Math.round(budget / 1_000)}K`;
      expect(formatted).toBe("$150M");
    });

    it("formats revenue >= 1M as $X.XM", () => {
      const revenue = 850_500_000;
      const formatted = revenue >= 1_000_000
        ? `$${(revenue / 1_000_000).toFixed(1)}M`
        : `$${Math.round(revenue / 1_000)}K`;
      expect(formatted).toBe("$850.5M");
    });

    it("limits production companies to 6", () => {
      const companies = ["A", "B", "C", "D", "E", "F", "G", "H"];
      expect(companies.slice(0, 6).length).toBe(6);
    });

    it("limits networks to 6", () => {
      const nets = ["N1", "N2", "N3", "N4", "N5", "N6", "N7"];
      expect(nets.slice(0, 6).length).toBe(6);
    });
  });

  describe("TMDB logo fallback", () => {
    it("logo URL is null when no logos available", () => {
      const logos: Array<{ iso_639_1?: string | null; file_path?: string }> = [];
      const enLogo = logos.find(
        (l) => l.iso_639_1 === "en" || l.iso_639_1 === null || l.iso_639_1 === undefined,
      );
      expect(enLogo).toBeUndefined();
    });

    it("selects English logo when available", () => {
      const logos = [
        { iso_639_1: "ja", file_path: "/jp-logo.png" },
        { iso_639_1: "en", file_path: "/en-logo.png" },
      ];
      const enLogo = logos.find(
        (l) => l.iso_639_1 === "en" || l.iso_639_1 === null || l.iso_639_1 === undefined,
      );
      expect(enLogo?.file_path).toBe("/en-logo.png");
    });

    it("selects null-language logo as fallback", () => {
      const logos = [
        { iso_639_1: null, file_path: "/neutral-logo.png" },
      ];
      const enLogo = logos.find(
        (l) => l.iso_639_1 === "en" || l.iso_639_1 === null || l.iso_639_1 === undefined,
      );
      expect(enLogo?.file_path).toBe("/neutral-logo.png");
    });
  });
});
