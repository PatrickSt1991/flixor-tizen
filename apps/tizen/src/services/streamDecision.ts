import type { PlexStream } from '@flixor/core';
import { loadSettings } from './settings';

/**
 * fetch() with a timeout that works on every Tizen engine.
 * AbortSignal.timeout is Chrome 103+ and AbortController Chrome 66+, so on
 * Tizen TVs `AbortSignal.timeout(...)` threw and the backend path was never
 * used. Abort when possible, and always race against a timer so the call
 * cannot hang on engines without AbortController.
 */
export function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
): Promise<Response> {
  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`Request timed out after ${ms}ms`));
    }, ms);
  });
  const request = fetch(url, controller ? { ...init, signal: controller.signal } : init);
  // No Promise#finally (Chrome 63) — clean up on both paths explicitly.
  return Promise.race([request, timeout]).then(
    (res) => {
      clearTimeout(timer);
      return res;
    },
    (err) => {
      clearTimeout(timer);
      throw err;
    },
  );
}

// --- Interfaces ---

export interface StreamDecisionInput {
  container: string;
  videoCodec: string;
  videoProfile?: string;
  codecTag?: string;
  width?: number;
  height?: number;
  bitrate?: number; // kbps
}

export type PlaybackStrategy = 'direct-play' | 'direct-stream' | 'transcode';

export interface StreamDecision {
  strategy: PlaybackStrategy;
  maxBitrate?: number; // only for transcode
}

export interface QualityOption {
  label: string;
  bitrate: number; // kbps, 0 for Original
}

export interface TrackInfo {
  id: number;
  language: string;
  codec: string;
  channels?: number; // audio only
  title?: string;
}

/**
 * Extended PlexStream with optional channels field.
 * Plex API returns channels on audio streams but the core type doesn't include it.
 */
type PlexStreamWithChannels = PlexStream & { channels?: number };

// --- Quality Presets ---

interface QualityPreset extends QualityOption {
  maxHeight: number; // implied resolution
}

const QUALITY_PRESETS: QualityPreset[] = [
  { label: 'Original', bitrate: 0, maxHeight: Infinity },
  { label: '20 Mbps - 1080p', bitrate: 20000, maxHeight: 1080 },
  { label: '12 Mbps - 1080p', bitrate: 12000, maxHeight: 1080 },
  { label: '8 Mbps - 720p', bitrate: 8000, maxHeight: 720 },
  { label: '4 Mbps - 720p', bitrate: 4000, maxHeight: 720 },
  { label: '2 Mbps - 480p', bitrate: 2000, maxHeight: 480 },
  { label: '1 Mbps - 360p', bitrate: 1000, maxHeight: 360 },
];

// --- Functions ---

/**
 * Returns true iff container is "mp4" AND videoCodec is "h264" (case-insensitive).
 */
export function canDirectPlay(input: StreamDecisionInput): boolean {
  return (
    input.container?.toLowerCase() === 'mp4' &&
    input.videoCodec?.toLowerCase() === 'h264'
  );
}

/**
 * Returns true iff videoCodec is "h264" (case-insensitive), regardless of container.
 */
export function canDirectStream(input: StreamDecisionInput): boolean {
  return input.videoCodec?.toLowerCase() === 'h264';
}

/**
 * Returns true iff videoProfile contains "dolby vision" (case-insensitive)
 * OR codecTag contains "dvhe" or "dvh1" (case-insensitive).
 */
export function hasDolbyVision(input: StreamDecisionInput): boolean {
  const profile = input.videoProfile?.toLowerCase() ?? '';
  const tag = input.codecTag?.toLowerCase() ?? '';
  return (
    profile.includes('dolby vision') ||
    tag.includes('dvhe') ||
    tag.includes('dvh1')
  );
}

/**
 * Decides playback strategy based on input and quality setting.
 *
 * - "original" → direct-play if canDirectPlay, else direct-stream if canDirectStream, else transcode
 * - specific bitrate string (e.g. "8000") → always transcode with maxBitrate
 */
export function decideStream(
  input: StreamDecisionInput,
  qualitySetting: string,
): StreamDecision {
  if (qualitySetting.toLowerCase() === 'original') {
    if (canDirectPlay(input)) {
      return { strategy: 'direct-play' };
    }
    if (canDirectStream(input)) {
      return { strategy: 'direct-stream' };
    }
    return { strategy: 'transcode' };
  }

  const parsed = parseInt(qualitySetting, 10);
  if (isNaN(parsed)) {
    // Malformed quality setting → default to transcode
    return { strategy: 'transcode' };
  }

  return { strategy: 'transcode', maxBitrate: parsed };
}

/**
 * Returns quality presets filtered by source resolution.
 * Excludes options whose implied resolution > sourceHeight.
 * "Original" is always included.
 */
export function getQualityOptions(sourceHeight: number): QualityOption[] {
  return QUALITY_PRESETS
    .filter((p) => p.bitrate === 0 || p.maxHeight <= sourceHeight)
    .map(({ label, bitrate }) => ({ label, bitrate }));
}

/**
 * Extracts subtitle tracks (streamType === 3) from Plex streams.
 */
export function getSubtitleOptions(streams: PlexStreamWithChannels[]): TrackInfo[] {
  if (!streams || streams.length === 0) return [];

  return streams
    .filter((s) => s.streamType === 3)
    .map((s) => ({
      id: s.id,
      language: s.language ?? '',
      codec: s.codec ?? '',
      title: s.title,
    }));
}

/**
 * Extracts audio tracks (streamType === 2) from Plex streams, including channels.
 */
export function getAudioOptions(streams: PlexStreamWithChannels[]): TrackInfo[] {
  if (!streams || streams.length === 0) return [];

  return streams
    .filter((s) => s.streamType === 2)
    .map((s) => ({
      id: s.id,
      language: s.language ?? '',
      codec: s.codec ?? '',
      channels: s.channels,
      title: s.title,
    }));
}

/**
 * Constructs a Plex external subtitle download URL.
 * Returns empty string if subtitleKey is falsy.
 */
export function getExternalSubtitleUrl(
  serverUrl: string,
  token: string,
  subtitleKey: string,
): string {
  if (!subtitleKey) return '';
  return `${serverUrl}${subtitleKey}?X-Plex-Token=${token}`;
}


// --- Backend-Proxied Stream URL Support ---

export interface BackendStreamOptions {
  mediaIndex?: number;
  partIndex?: number;
  maxBitrate?: number;
  directPlay?: boolean;
  directStream?: boolean;
  subtitleStreamID?: number;
  audioStreamID?: number;
}

export interface BackendStreamResult {
  streamUrl: string;
  sessionId: string;
}

export type BackendPlaybackState = 'playing' | 'paused' | 'stopped' | 'buffering';

/**
 * Attempts to get a stream URL from the backend proxy API.
 * Returns null if the backend is unavailable or the request fails,
 * allowing the caller to fall back to direct Plex server calls.
 */
export async function getBackendStreamUrl(
  ratingKey: string,
  options: BackendStreamOptions = {},
): Promise<BackendStreamResult | null> {
  const { backendUrl } = loadSettings();
  if (!backendUrl) return null;

  try {
    const params = new URLSearchParams();
    if (options.mediaIndex != null) params.set('mediaIndex', String(options.mediaIndex));
    if (options.partIndex != null) params.set('partIndex', String(options.partIndex));
    if (options.maxBitrate != null) params.set('maxBitrate', String(options.maxBitrate));
    if (options.directPlay != null) params.set('directPlay', String(options.directPlay));
    if (options.directStream != null) params.set('directStream', String(options.directStream));
    if (options.subtitleStreamID != null) params.set('subtitleStreamID', String(options.subtitleStreamID));
    if (options.audioStreamID != null) params.set('audioStreamID', String(options.audioStreamID));

    const qs = params.toString();
    const url = `${backendUrl}/api/stream/${encodeURIComponent(ratingKey)}${qs ? `?${qs}` : ''}`;

    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    }, 10_000);

    if (!res.ok) return null;

    const data = await res.json();
    if (!data.streamUrl || !data.sessionId) return null;

    return { streamUrl: data.streamUrl, sessionId: data.sessionId };
  } catch {
    // Backend unavailable — caller should fall back to direct Plex calls
    return null;
  }
}

/**
 * Reports playback progress / timeline updates through the backend proxy.
 * Returns true if the update was accepted, false if the backend is unavailable.
 */
export async function updateBackendProgress(
  ratingKey: string,
  timeMs: number,
  durationMs: number,
  state: BackendPlaybackState,
): Promise<boolean> {
  const { backendUrl } = loadSettings();
  if (!backendUrl) return false;

  try {
    const res = await fetchWithTimeout(`${backendUrl}/api/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ratingKey,
        timeMs,
        durationMs,
        state,
      }),
    }, 5_000);

    return res.ok;
  } catch {
    // Backend unavailable — caller should fall back to direct Plex calls
    return false;
  }
}
