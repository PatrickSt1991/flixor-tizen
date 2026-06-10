import { flixor } from "./flixor";

/** Settings for a transcode session */
export interface TranscodeSettings {
  maxVideoBitrate?: number;
  videoResolution?: string;
  audioStreamID?: string;
  subtitleStreamID?: string;
  mediaIndex?: number;
  offset?: number;
  directStream?: boolean;
}

/** Result from starting a transcode session */
export interface TranscodeSession {
  sessionId: string;
  url: string;
  startUrl: string;
}

/** Active session ID tracked for cleanup */
let activeSessionId: string | null = null;

/**
 * Snapshot of the most recent transcode attempt, for the on-device debug
 * overlay (a real TV has no devtools). Captures exactly what we asked Plex for
 * and what its decision said about subtitle burning.
 */
export interface TranscodeDebug {
  audioStreamID?: string;
  subtitleStreamID?: string;
  /** The start.m3u8 URL the player actually loads. */
  startUrl: string;
  /** Decision request URL + response (status + truncated body w/ burn flags). */
  decisionUrl: string;
  decisionStatus: number;
  decisionBody: string;
  timestamp: number;
}

let lastTranscodeDebug: TranscodeDebug | null = null;

/** Get the most recent transcode debug snapshot (null until first transcode). */
export function getLastTranscodeDebug(): TranscodeDebug | null {
  return lastTranscodeDebug;
}

/**
 * Start a new transcode session for the given media.
 * Calls the Plex decision API then initiates the transcode stream.
 */
export async function startTranscode(
  mediaKey: string,
  settings: TranscodeSettings = {},
): Promise<TranscodeSession> {
  // Stop any existing session first
  if (activeSessionId) {
    await stopTranscode(activeSessionId);
  }

  const { mediaIndex = 0, audioStreamID, subtitleStreamID } = settings;

  // ONE session id shared by the decision and the start request.
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  // Make the transcode decision FIRST so Plex registers the subtitle-burn
  // choice against this session; start.m3u8 then replays that decision.
  // This call returns 200 with decision="burn" now that getTranscodeUrl/
  // makeTranscodeDecision send X-Plex-Client-Profile-Name — without a
  // recognised profile name the decision endpoint 400s (verified against a
  // live server), which is what blocked subtitle burning all along.
  const decision = await flixor.plexServer.makeTranscodeDecision(mediaKey, {
    audioStreamID,
    subtitleStreamID,
    mediaIndex,
    sessionId,
    maxVideoBitrate: settings.maxVideoBitrate,
    videoResolution: settings.videoResolution,
  });

  // Health check moved onto the decision: if it failed, surface it so the
  // caller falls back to a direct stream. (Previously the start.m3u8 pre-fetch
  // below served this purpose.) decision is undefined when mocked in tests.
  if (decision && !decision.ok) {
    throw new Error(`Transcode decision failed with status ${decision.status}`);
  }

  // Build transcode URL (same session as the decision above)
  const result = flixor.plexServer.getTranscodeUrl(mediaKey, {
    maxVideoBitrate: settings.maxVideoBitrate,
    videoResolution: settings.videoResolution,
    directStream: settings.directStream,
    audioStreamID,
    subtitleStreamID,
    offset: settings.offset,
    mediaIndex,
    sessionId,
  });

  // Snapshot for the on-device debug overlay. (decision may be undefined when
  // mocked in tests.)
  lastTranscodeDebug = {
    audioStreamID,
    subtitleStreamID,
    startUrl: result.startUrl,
    decisionUrl: decision?.url ?? "",
    decisionStatus: decision?.status ?? 0,
    decisionBody: decision?.body ?? "",
    timestamp: Date.now(),
  };

  // NOTE: we deliberately do NOT pre-fetch start.m3u8 here anymore. The video
  // player (hls.js) loads start.m3u8 itself, and that request is what actually
  // starts the Plex transcode — an extra blocking fetch just added a full
  // round-trip before playback could begin. The decision above already confirms
  // the session is set up.
  activeSessionId = result.sessionId;

  return {
    sessionId: result.sessionId,
    url: result.url,
    startUrl: result.startUrl,
  };
}

/**
 * Stop a transcode session by ID.
 * Clears the active session tracker if it matches.
 */
export async function stopTranscode(sessionId: string): Promise<void> {
  try {
    await flixor.plexServer.stopTranscode(sessionId);
  } catch {
    // Best-effort — server may already have cleaned up
  }
  if (activeSessionId === sessionId) {
    activeSessionId = null;
  }
}

/**
 * Update an active transcode session with new settings.
 * Stops the current session and starts a fresh one.
 */
export async function updateTranscode(
  mediaKey: string,
  sessionId: string,
  settings: TranscodeSettings,
): Promise<TranscodeSession> {
  await stopTranscode(sessionId);
  return startTranscode(mediaKey, settings);
}

/** Get the currently active transcode session ID, if any. */
export function getActiveSessionId(): string | null {
  return activeSessionId;
}

/**
 * Stop the active transcode session (if any).
 * Intended for cleanup on navigation away or app pause.
 */
export async function stopActiveSession(): Promise<void> {
  if (activeSessionId) {
    await stopTranscode(activeSessionId);
  }
}

// --- Lifecycle cleanup ---
// Stop active transcode when the Tizen app is paused (e.g. user switches apps)
function handleVisibilityChange(): void {
  if (document.hidden && activeSessionId) {
    stopTranscode(activeSessionId).catch(() => {});
  }
}

document.addEventListener("visibilitychange", handleVisibilityChange);
