import fc from "fast-check";
import { describe, it, expect } from "vitest";
import { buildChips, type TechnicalChipsProps } from "../../components/TechnicalChips";

// Feature: tizen-parity-phase2, Property 19: Technical chips generation and formatting

/** Arbitrary for optional non-empty string */
const optString = fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined });

/** Arbitrary for optional positive bitrate in kbps */
const optBitrate = fc.option(
  fc.integer({ min: 1, max: 200_000 }),
  { nil: undefined },
);

/** Arbitrary TechnicalChipsProps with optional fields */
const technicalChipsPropsArb: fc.Arbitrary<TechnicalChipsProps> = fc.record({
  resolution: optString,
  bitrate: optBitrate,
  videoCodec: optString,
  audioCodec: optString,
  audioChannels: optString,
  hdr: optString,
});

/** Count how many chip-producing fields are present */
function countPresentFields(props: TechnicalChipsProps): number {
  let count = 0;
  if (props.resolution) count++;
  if (props.bitrate != null && props.bitrate > 0) count++;
  if (props.videoCodec) count++;
  if (props.audioCodec) count++; // audioChannels is part of audio chip, not separate
  if (props.hdr) count++;
  return count;
}

describe("Property 19: Technical chips generation and formatting", () => {
  /**
   * **Validates: Requirements 10.2, 10.3, 10.4**
   *
   * For any MediaInfo object, the number of generated chip strings equals
   * the number of non-undefined fields. Bitrate contains "Mbps", video
   * codec is uppercased, and audio codec is uppercased.
   */

  it("chip count equals the number of present (non-empty/non-undefined) fields", () => {
    fc.assert(
      fc.property(technicalChipsPropsArb, (props) => {
        const chips = buildChips(props);
        expect(chips.length).toBe(countPresentFields(props));
      }),
      { numRuns: 200 },
    );
  });

  it("bitrate chip always contains 'Mbps'", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200_000 }),
        (kbps) => {
          const chips = buildChips({ bitrate: kbps });
          expect(chips.length).toBe(1);
          expect(chips[0]).toContain("Mbps");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("video codec chip is always uppercase", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (codec) => {
          const chips = buildChips({ videoCodec: codec });
          expect(chips.length).toBe(1);
          expect(chips[0]).toBe(codec.toUpperCase());
        },
      ),
      { numRuns: 100 },
    );
  });

  it("audio codec chip is always uppercase (trimmed)", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,18}[a-zA-Z0-9]?$/),
        (codec) => {
          const chips = buildChips({ audioCodec: codec });
          expect(chips.length).toBe(1);
          expect(chips[0]).toBe(codec.toUpperCase().trim());
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty props produce empty array", () => {
    const chips = buildChips({});
    expect(chips).toEqual([]);
  });
});
