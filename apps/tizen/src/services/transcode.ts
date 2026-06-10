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

  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  // NOTE: we deliberately do NOT call /transcode/universal/decision anymore.
  // On this server it returns 400 Bad Request for every request we can build
  // (confirmed via the debug overlay, with hasMDE 0 and 1, params identical to
  // the working start.m3u8). Because we sent it with the same `session` id that
  // start.m3u8 then reuses, that failed decision appears to poison the session
  // so Plex plays it WITHOUT the requested subtitle burn. start.m3u8 honours
  // `subtitleStreamID` + `subtitles=burn` on its own, so we let it do the whole
  // job against a clean, never-decisioned session (how simple Plex clients do
  // subtitle burning).
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

  // Snapshot for the on-device debug overlay.
  lastTranscodeDebug = {
    audioStreamID,
    subtitleStreamID,
    startUrl: result.startUrl,
    decisionUrl: "(skipped — start.m3u8 handles subtitle burn directly)",
    decisionStatus: 0,
    decisionBody: "",
    timestamp: Date.now(),
  };

  // Start the transcode session on the server
  await flixor.plexServer.startTranscodeSession(result.startUrl);

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
