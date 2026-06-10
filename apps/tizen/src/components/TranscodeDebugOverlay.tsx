import { useEffect, useState } from "react";
import { getLastTranscodeDebug } from "../services/transcode";

/**
 * On-device debug panel for the transcode/subtitle pipeline. A real Samsung TV
 * has no devtools, so this surfaces what we asked Plex for and what its decision
 * said — crucially whether the chosen subtitle stream is being burned. Toggle it
 * from the player; see Player.tsx (GREEN colour key, or "g" in the emulator).
 *
 * It also shows the last key pressed (keyCode + key name) so we can identify
 * exactly what each remote button sends on a given TV model — remote key codes
 * vary, so this is how we map the Play/Pause/seek buttons.
 */
export function TranscodeDebugOverlay({ visible }: { visible: boolean }) {
  const [lastKey, setLastKey] = useState<{ code: number; key: string } | null>(null);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      setLastKey({ code: e.keyCode || e.which, key: e.key || "(none)" });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible]);

  if (!visible) return null;

  const dbg = getLastTranscodeDebug();
  if (!dbg) {
    return (
      <div className="transcode-debug">
        <div className="transcode-debug-title">Transcode debug</div>
        <div className="transcode-debug-row">
          <b>last key:</b>{" "}
          {lastKey ? `keyCode=${lastKey.code}  key="${lastKey.key}"` : "(press a remote button)"}
        </div>
        <div>No transcode yet. Select an audio/subtitle track or (re)start playback.</div>
      </div>
    );
  }

  // Pull the per-stream subtitle decisions out of the response so the key signal
  // (burn vs ignore) is readable without scrolling the whole XML/JSON blob.
  const subtitleDecisions =
    dbg.decisionBody
      .match(/streamType="3"[^>]*/g)
      ?.map((s) => {
        const id = s.match(/\bid="(\d+)"/)?.[1] ?? "?";
        const decision = s.match(/\bdecision="(\w+)"/)?.[1] ?? "(none)";
        const lang = s.match(/\blanguage="([^"]*)"/)?.[1] ?? "";
        return `#${id} ${lang} → ${decision}`;
      })
      .join("  |  ") || "(no streamType=3 / decision attrs found in body)";

  return (
    <div className="transcode-debug">
      <div className="transcode-debug-title">Transcode debug</div>
      <div className="transcode-debug-row">
        <b>last key:</b>{" "}
        {lastKey ? `keyCode=${lastKey.code}  key="${lastKey.key}"` : "(press a remote button)"}
      </div>
      <div className="transcode-debug-row">
        <b>audioStreamID:</b> {dbg.audioStreamID ?? "(default)"}
      </div>
      <div className="transcode-debug-row">
        <b>subtitleStreamID:</b> {dbg.subtitleStreamID ?? "(none)"}
        {dbg.subtitleStreamID && dbg.subtitleStreamID !== "0" ? " (expect subtitles=burn)" : " (off)"}
      </div>
      <div className="transcode-debug-row">
        <b>decision status:</b> {dbg.decisionStatus}
      </div>
      <div className="transcode-debug-row">
        <b>subtitle decisions:</b> {subtitleDecisions}
      </div>
      <div className="transcode-debug-row transcode-debug-url">
        <b>decision URL:</b> {dbg.decisionUrl}
      </div>
      <div className="transcode-debug-row transcode-debug-url">
        <b>start URL:</b> {dbg.startUrl}
      </div>
      <div className="transcode-debug-row transcode-debug-body">
        <b>decision body:</b> {dbg.decisionBody || "(empty)"}
      </div>
    </div>
  );
}
