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

  // Generate ONE session id shared by both the decision and the start request.
  // Plex applies the subtitle-burn decision to a specific session; if the
  // start.m3u8 plays a different session the subtitles never appear.
  const sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  // Make transcode decision so Plex knows which streams to use
  await flixor.plexServer.makeTranscodeDecision(mediaKey, {
    audioStreamID,
    subtitleStreamID,
    mediaIndex,
    sessionId,
    maxVideoBitrate: settings.maxVideoBitrate,
    videoResolution: settings.videoResolution,
  });

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
