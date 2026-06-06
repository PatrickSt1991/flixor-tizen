import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildChips, TechnicalChips } from "../../components/TechnicalChips";

// --- buildChips pure function tests ---

describe("buildChips", () => {
  it("all fields present → 5 chips", () => {
    const chips = buildChips({
      resolution: "4K",
      bitrate: 20000,
      videoCodec: "hevc",
      audioCodec: "eac3",
      audioChannels: "7.1",
      hdr: "HDR10",
    });
    expect(chips).toHaveLength(5);
    expect(chips).toEqual(["4K", "20.0 Mbps", "HEVC", "EAC3 7.1", "HDR10"]);
  });

  it("all fields absent → empty array", () => {
    expect(buildChips({})).toEqual([]);
  });

  it("mixed fields → correct count", () => {
    const chips = buildChips({ resolution: "1080p", videoCodec: "h264" });
    expect(chips).toHaveLength(2);
    expect(chips).toEqual(["1080p", "H264"]);
  });

  it("bitrate 8000 → '8.0 Mbps'", () => {
    const chips = buildChips({ bitrate: 8000 });
    expect(chips).toEqual(["8.0 Mbps"]);
  });

  it("bitrate 1500 → '1.5 Mbps'", () => {
    const chips = buildChips({ bitrate: 1500 });
    expect(chips).toEqual(["1.5 Mbps"]);
  });

  it("video codec 'h264' → 'H264'", () => {
    const chips = buildChips({ videoCodec: "h264" });
    expect(chips).toEqual(["H264"]);
  });

  it("video codec 'hevc' → 'HEVC'", () => {
    const chips = buildChips({ videoCodec: "hevc" });
    expect(chips).toEqual(["HEVC"]);
  });

  it("audio codec with channels: 'aac' + '5.1' → 'AAC 5.1'", () => {
    const chips = buildChips({ audioCodec: "aac", audioChannels: "5.1" });
    expect(chips).toEqual(["AAC 5.1"]);
  });

  it("audio codec without channels: 'aac' → 'AAC'", () => {
    const chips = buildChips({ audioCodec: "aac" });
    expect(chips).toEqual(["AAC"]);
  });

  it("bitrate of 0 is omitted", () => {
    expect(buildChips({ bitrate: 0 })).toEqual([]);
  });
});

// --- TechnicalChips component rendering tests ---

describe("TechnicalChips component", () => {
  it("renders null when no fields present", () => {
    const { container } = render(<TechnicalChips />);
    expect(container.firstChild).toBeNull();
  });

  it("renders correct number of pill badges", () => {
    render(
      <TechnicalChips
        resolution="4K"
        bitrate={12000}
        videoCodec="hevc"
        audioCodec="aac"
        audioChannels="5.1"
        hdr="Dolby Vision"
      />,
    );
    const badges = screen.getAllByText(/.+/);
    expect(badges).toHaveLength(5);
  });

  it("renders correct text content", () => {
    render(
      <TechnicalChips
        resolution="1080p"
        bitrate={8000}
        videoCodec="h264"
        audioCodec="aac"
        audioChannels="2.0"
      />,
    );
    expect(screen.getByText("1080p")).toBeInTheDocument();
    expect(screen.getByText("8.0 Mbps")).toBeInTheDocument();
    expect(screen.getByText("H264")).toBeInTheDocument();
    expect(screen.getByText("AAC 2.0")).toBeInTheDocument();
  });
});
