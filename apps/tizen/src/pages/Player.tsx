import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
  setFocus,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { loadSettings, saveSettings } from "../services/settings";
import { StatsHUD } from "../components/StatsHUD";
import { TranscodeDebugOverlay } from "../components/TranscodeDebugOverlay";
import { FocusableButton } from "../components/FocusableButton";
import { TrackPicker } from "../components/TrackPicker";
import { VersionPickerModal } from "../components/VersionPickerModal";
import { NextEpisodeCountdown } from "../components/NextEpisodeCountdown";
import { SeekSlider } from "../components/SeekSlider";
import { TraktScrobbler } from "../services/traktScrobbler";
import {
  decideStream,
  getQualityOptions,
  getAudioOptions,
  getSubtitleOptions,
  getBackendStreamUrl,
  updateBackendProgress,
  type StreamDecisionInput,
  type PlaybackStrategy,
} from "../services/streamDecision";
import {
  startTranscode,
  stopActiveSession,
  type TranscodeSession,
} from "../services/transcode";
import {
  isHlsStream,
  createHlsPlayer,
  destroyHlsPlayer,
  isDashStream,
  createDashPlayer,
  destroyDashPlayer,
} from "../utils/streaming";
import type Hls from "hls.js";
import type { MediaPlayerClass } from "dashjs";
import type { PlexMediaItem, PlexMarker, PlexStream } from "@flixor/core";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function PlayerPage() {
  const { ratingKey } = useParams<{ ratingKey: string }>();
  // Tracks pre-selected on the Details page (regular-Plex style: pick audio/
  // subtitle before pressing Play). Applied on the initial load below.
  const location = useLocation();
  const navState = location.state as {
    mediaIndex?: number;
    audioStreamID?: number | null;
    subtitleStreamID?: number | null;
  } | null;
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [item, setItem] = useState<PlexMediaItem | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  // True while a stream is loading/buffering (initial start or a track switch).
  const [isBuffering, setIsBuffering] = useState(false);
  // What the current stream is doing, so the buffering label can explain the
  // wait: a transcode (esp. burning subtitles) takes the server a few seconds
  // to spin up, vs. a near-instant direct stream.
  const [streamMode, setStreamMode] = useState<"start" | "transcode" | "burn">("start");
  const [activeMarker, setActiveMarker] = useState<PlexMarker | null>(null);
  const [audioTracks, setAudioTracks] = useState<PlexStream[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<PlexStream[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState(navState?.mediaIndex ?? 0);
  const [quality, setQuality] = useState(() => loadSettings().preferredQuality || "original");
  const [playbackSpeed, setPlaybackSpeed] = useState(() => loadSettings().preferredPlaybackSpeed ?? 1);
  const [nextEpisode, setNextEpisode] = useState<PlexMediaItem | null>(null);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [showStatsHud, setShowStatsHud] = useState(() => loadSettings().statsHudEnabled ?? false);
  // Transcode/subtitle debug panel — toggled by the GREEN colour key (404), or
  // "g" in the emulator. Surfaces the decision response (burn vs ignore) since
  // a real TV has no devtools.
  const [showTranscodeDebug, setShowTranscodeDebug] = useState(false);

  // Seek slider state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Track picker modal state
  const [showAudioPicker, setShowAudioPicker] = useState(false);
  const [showSubPicker, setShowSubPicker] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const controlsTimeout = useRef<number | null>(null);
  const resumeApplied = useRef(false);
  const lastInfoKeyTime = useRef<number>(0);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<MediaPlayerClass | null>(null);
  const transcodeSessionRef = useRef<TranscodeSession | null>(null);
  const backendSessionRef = useRef<string | null>(null);
  const [playbackStrategy, setPlaybackStrategy] = useState<PlaybackStrategy | null>(null);

  // Toggle StatsHUD on double-press of Info/Menu key (keyCode 457 = Info on Tizen)
  const handleStatsToggle = useCallback((e: KeyboardEvent) => {
    if (e.keyCode === 457 || e.key === "ContextMenu" || e.key === "Info") {
      const now = Date.now();
      if (now - lastInfoKeyTime.current < 500) {
        setShowStatsHud((prev) => !prev);
        lastInfoKeyTime.current = 0;
      } else {
        lastInfoKeyTime.current = now;
      }
    }
    // GREEN colour button (Tizen keyCode 404) or "g" → transcode debug panel.
    if (e.keyCode === 404 || e.key === "ColorF1Green" || e.key === "g") {
      setShowTranscodeDebug((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleStatsToggle);
    return () => window.removeEventListener("keydown", handleStatsToggle);
  }, [handleStatsToggle]);

  // Dynamic quality options filtered by source resolution via StreamDecisionService
  const qualityOptions = useMemo(() => {
    const media = item?.Media?.[selectedMedia] || item?.Media?.[0];
    const sourceHeight = media?.height ?? 1080;
    return getQualityOptions(sourceHeight).map((opt) => ({
      label: opt.label,
      value: opt.bitrate === 0 ? "original" : String(opt.bitrate),
    }));
  }, [item, selectedMedia]);

  /** Attach HLS.js or dash.js to the video element, or set src directly */
  const attachStream = useCallback((url: string) => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy previous HLS instance
    if (hlsRef.current) {
      destroyHlsPlayer(hlsRef.current);
      hlsRef.current = null;
    }

    // Destroy previous DASH instance
    if (dashRef.current) {
      destroyDashPlayer(dashRef.current);
      dashRef.current = null;
    }

    if (isDashStream(url)) {
      const player = createDashPlayer(video, url);
      dashRef.current = player;
    } else if (isHlsStream(url)) {
      const hls = createHlsPlayer(video, url);
      hlsRef.current = hls;
      // If createHlsPlayer returned null, it already set video.src for native HLS
    } else {
      video.src = url;
    }
  }, []);

  // Load media and set up video URL
  useEffect(() => {
    if (!ratingKey) return;
    resumeApplied.current = false;

    flixor.plexServer.getMetadata(ratingKey).then(async (data) => {
      if (!data) return;
      setItem(data);
      const media = data.Media?.[selectedMedia] || data.Media?.[0];
      const part = media?.Part?.[0];
      if (part) {
        const streams = part.Stream || [];

        // Build StreamDecisionInput from media/part metadata
        const sdInput: StreamDecisionInput = {
          container: media?.container ?? "",
          videoCodec: media?.videoCodec ?? "",
          videoProfile: part.videoProfile,
          width: media?.width,
          height: media?.height,
          bitrate: media?.bitrate,
        };

        // Use StreamDecisionService to determine playback strategy
        const decision = decideStream(sdInput, quality);
        setPlaybackStrategy(decision.strategy);

        // If Details pre-selected an audio/subtitle track, honor it up front:
        // force a transcode with those streams (a direct stream can't apply a
        // non-default audio track or burn Plex subs).
        const preAudio = navState?.audioStreamID;
        const preSub = navState?.subtitleStreamID;
        const hasPreselect = preAudio != null || preSub != null;
        let streamHandled = false;
        if (hasPreselect) {
          if (preAudio != null) setSelectedAudio(preAudio);
          if (preSub != null) setSelectedSub(preSub);
          try {
            setStreamMode(preSub != null ? "burn" : "transcode");
            const session = await startTranscode(ratingKey, {
              mediaIndex: selectedMedia,
              maxVideoBitrate: decision.maxBitrate,
              audioStreamID: preAudio != null ? String(preAudio) : undefined,
              subtitleStreamID: preSub == null ? "0" : String(preSub),
            });
            transcodeSessionRef.current = session;
            setVideoUrl(session.startUrl);
            streamHandled = true;
          } catch {
            // fall through to the normal path
          }
        }

        // Try backend-proxied stream URL first
        const backendResult = streamHandled
          ? null
          : await getBackendStreamUrl(ratingKey, {
              mediaIndex: selectedMedia,
              maxBitrate: decision.maxBitrate,
              directPlay: decision.strategy === "direct-play",
              directStream: decision.strategy === "direct-stream",
            });

        if (streamHandled) {
          // already set up above
        } else if (backendResult) {
          backendSessionRef.current = backendResult.sessionId;
          setStreamMode("start");
          setVideoUrl(backendResult.streamUrl);
        } else {
          // Fall back to direct Plex stream
          backendSessionRef.current = null;

          if (decision.strategy === "direct-play") {
            setStreamMode("start");
            const url = await flixor.plexServer.getStreamUrl(ratingKey, selectedMedia);
            setVideoUrl(url);
          } else if (decision.strategy === "direct-stream") {
            setStreamMode("start");
            const url = await flixor.plexServer.getStreamUrl(ratingKey, selectedMedia);
            setVideoUrl(url);
          } else {
            // Transcode
            try {
              setStreamMode("transcode");
              const session = await startTranscode(ratingKey, {
                mediaIndex: selectedMedia,
                maxVideoBitrate: decision.maxBitrate,
              });
              transcodeSessionRef.current = session;
              setVideoUrl(session.startUrl);
            } catch {
              // Fallback to direct stream on transcode failure
              const url = await flixor.plexServer.getStreamUrl(ratingKey, selectedMedia);
              setVideoUrl(url);
            }
          }
        }

        // Use StreamDecisionService for track extraction
        const audioTrackInfos = getAudioOptions(streams);
        const subTrackInfos = getSubtitleOptions(streams);
        setAudioTracks(streams.filter((s) => audioTrackInfos.some((t) => t.id === s.id)));
        setSubtitleTracks(streams.filter((s) => subTrackInfos.some((t) => t.id === s.id)));
        // Only seed defaults from the server's "selected" streams when the
        // Details page didn't already pre-select tracks.
        if (!hasPreselect) {
          const activeAudio = streams.find((s) => s.streamType === 2 && s.selected);
          const activeSub = streams.find((s) => s.streamType === 3 && s.selected);
          if (activeAudio) setSelectedAudio(activeAudio.id);
          if (activeSub) setSelectedSub(activeSub.id);
        }
      }

      // Detect next episode for TV shows
      if (data.type === "episode" && data.parentRatingKey) {
        flixor.plexServer.getChildren(data.parentRatingKey).then((siblings) => {
          const currentIdx = siblings.findIndex((e) => e.ratingKey === ratingKey);
          if (currentIdx >= 0 && currentIdx < siblings.length - 1) {
            setNextEpisode(siblings[currentIdx + 1]);
          } else {
            setNextEpisode(null);
          }
        }).catch(() => setNextEpisode(null));
      }
    });
    // Reset next episode overlay when ratingKey/media/quality changes
    return () => {
      setShowNextOverlay(false);
    };
  }, [ratingKey, selectedMedia, quality]);

  // Attach HLS.js or set video src when videoUrl changes
  useEffect(() => {
    if (videoUrl) {
      // A fresh stream is loading (initial play or a track/quality switch) —
      // show the buffering indicator until the video actually starts playing.
      // Burned-subtitle switches re-transcode, so this can take a few seconds;
      // the spinner makes the wait visible instead of a frozen black frame.
      setIsBuffering(true);
      attachStream(videoUrl);
    }
  }, [videoUrl, attachStream]);

  // Apply saved playback speed when video is ready
  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;
    const video = videoRef.current;
    const applySpeed = () => {
      video.playbackRate = playbackSpeed;
    };
    video.addEventListener("canplay", applySpeed, { once: true });
    return () => video.removeEventListener("canplay", applySpeed);
  }, [videoUrl, playbackSpeed]);

  // Cleanup HLS.js, dash.js, and transcode session on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        destroyHlsPlayer(hlsRef.current);
        hlsRef.current = null;
      }
      if (dashRef.current) {
        destroyDashPlayer(dashRef.current);
        dashRef.current = null;
      }
      stopActiveSession().catch(() => {});
    };
  }, []);

  // Resume playback from viewOffset
  useEffect(() => {
    if (!item || !videoRef.current || resumeApplied.current) return;
    const video = videoRef.current;
    const viewOffset = (item as unknown as Record<string, unknown>).viewOffset as number | undefined;
    if (viewOffset && viewOffset > 0) {
      const handleCanPlay = () => {
        if (!resumeApplied.current) {
          video.currentTime = viewOffset / 1000;
          resumeApplied.current = true;
        }
        video.removeEventListener("canplay", handleCanPlay);
      };
      video.addEventListener("canplay", handleCanPlay);
      return () => video.removeEventListener("canplay", handleCanPlay);
    } else {
      resumeApplied.current = true;
    }
  }, [item, videoUrl]);

  // Trakt Scrobbling — uses TraktScrobbler for full lifecycle (start/pause/resume/stop)
  const scrobblerRef = useRef<TraktScrobbler>(new TraktScrobbler());

  useEffect(() => {
    if (!ratingKey || !item) return;

    const scrobbler = scrobblerRef.current;
    const media = TraktScrobbler.convertPlexToTraktMedia(item);
    if (!media) return;

    const getProgress = (): number => {
      const video = videoRef.current;
      if (!video || !video.duration) return 0;
      return (video.currentTime / video.duration) * 100;
    };

    // Start scrobble on mount / when item changes
    scrobbler.start(media, getProgress());

    const video = videoRef.current;

    const handlePause = () => {
      scrobbler.pause(getProgress());
    };

    const handlePlay = () => {
      // Resume if the scrobbler is paused, otherwise it's the initial play (already started above)
      if (scrobbler.isCurrentlyScrobbling() && scrobbler.isPaused()) {
        scrobbler.resume(getProgress());
      }
    };

    if (video) {
      video.addEventListener("pause", handlePause);
      video.addEventListener("play", handlePlay);
    }

    return () => {
      if (video) {
        video.removeEventListener("pause", handlePause);
        video.removeEventListener("play", handlePlay);
      }
      scrobbler.stop(getProgress()).catch(() => {});
    };
  }, [ratingKey, item]);

  // Progress Reporting (Plex + backend proxy)
  useEffect(() => {
    if (!ratingKey || !videoRef.current) return;
    const interval = globalThis.setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        const currentTime = Math.floor(video.currentTime * 1000);
        const duration = Math.floor(video.duration * 1000);
        flixor.plexServer.updateTimeline(ratingKey, "playing", currentTime, duration);

        // Also report via backend if a backend session is active
        if (backendSessionRef.current) {
          updateBackendProgress(ratingKey, currentTime, duration, "playing").catch(() => {});
        }
      }
    }, 10000);
    return () => globalThis.clearInterval(interval);
  }, [ratingKey]);

  // Focus context for the on-screen controls (the overlay is the only way to
  // reach Audio/Subtitle on a TV — there's no mouse, and native <video>
  // controls aren't D-pad navigable).
  const { ref: controlsRef, focusKey: controlsFocusKey } = useFocusable({
    focusKey: "player-controls",
    trackChildren: true,
  });

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) globalThis.clearTimeout(controlsTimeout.current);
    controlsTimeout.current = globalThis.setTimeout(
      () => setShowControls(false),
      5000,
    ) as unknown as number;
  }, []);

  const togglePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const handleMouseMove = showControlsTemporarily;

  // Show the controls on any remote keypress; OK toggles play/pause when the
  // overlay is hidden. When the overlay appears, move focus into it so the
  // D-pad can reach the play/pause + Audio/Subtitle buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const code = e.keyCode || e.which;
      const isBack = code === 10009 || e.key === "Backspace" || e.key === "Escape";
      if (isBack) return; // handled by the global remote hook (navigate back)
      const wasHidden = !showControls;
      showControlsTemporarily();
      // OK / Enter while hidden → toggle playback instead of needing a target.
      if ((code === 13 || e.key === "Enter") && wasHidden) {
        togglePlayPause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showControls, showControlsTemporarily, togglePlayPause]);

  // When the overlay becomes visible, focus the play/pause button.
  useEffect(() => {
    if (showControls) {
      const t = globalThis.setTimeout(() => setFocus("player-playpause"), 50);
      return () => globalThis.clearTimeout(t);
    }
  }, [showControls]);

  // While a track/version picker is open, cancel the 5s auto-hide of the
  // controls overlay (the overlay is already visible — the user opened the
  // picker from it). Otherwise the overlay, and the button we hand focus back
  // to when the picker closes, can vanish out from under the picker, leaving
  // the D-pad dead after a selection.
  useEffect(() => {
    if (
      (showAudioPicker || showSubPicker || showVersionPicker) &&
      controlsTimeout.current
    ) {
      globalThis.clearTimeout(controlsTimeout.current);
      controlsTimeout.current = null;
    }
  }, [showAudioPicker, showSubPicker, showVersionPicker]);

  const handleTrackChange = async (type: "audio" | "subtitle", streamId: number | null) => {
    if (!ratingKey) return;
    const nextAudio = type === "audio" ? streamId : selectedAudio;
    const nextSub = type === "subtitle" ? streamId : selectedSub;
    if (type === "audio") setSelectedAudio(streamId);
    else setSelectedSub(streamId);

    // Switching audio or subtitles requires a fresh transcode so Plex applies
    // (and burns) the chosen streams — the WebView can't switch embedded audio
    // or render Plex text subs itself. Resume at the current position.
    const offsetMs = Math.floor((videoRef.current?.currentTime ?? 0) * 1000);
    try {
      setStreamMode(nextSub != null ? "burn" : "transcode");
      const session = await startTranscode(ratingKey, {
        mediaIndex: selectedMedia,
        audioStreamID: nextAudio != null ? String(nextAudio) : undefined,
        // null subtitle ⇒ "0" (off); otherwise the chosen track (burned in).
        subtitleStreamID: nextSub == null ? "0" : String(nextSub),
        offset: offsetMs,
      });
      transcodeSessionRef.current = session;
      resumeApplied.current = true; // offset handles resume; don't re-seek
      setVideoUrl(session.startUrl);
    } catch {
      const url = await flixor.plexServer.getStreamUrl(ratingKey, selectedMedia);
      setVideoUrl(url);
    }
  };

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    saveSettings({ preferredPlaybackSpeed: speed });
  }, []);

  const cycleSpeed = useCallback(() => {
    const currentIdx = SPEED_OPTIONS.indexOf(playbackSpeed as typeof SPEED_OPTIONS[number]);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    handleSpeedChange(SPEED_OPTIONS[nextIdx]);
  }, [playbackSpeed, handleSpeedChange]);

  const handleQualityChange = (val: string) => {
    setQuality(val);
    saveSettings({ preferredQuality: val });
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const currentTimeMs = video.currentTime * 1000;

    // Safety net: if playback is progressing, we're not buffering — clears the
    // "Starting…" spinner even if the `playing` event didn't fire.
    if (isBuffering && !video.paused) setIsBuffering(false);

    // Update seek slider state
    setCurrentTime(video.currentTime);
    if (video.duration && isFinite(video.duration)) {
      setDuration(video.duration);
    }

    // Marker detection
    if (item?.Marker) {
      const marker = item.Marker.find(
        (m) => currentTimeMs >= m.startTimeOffset && currentTimeMs <= m.endTimeOffset,
      );
      setActiveMarker(marker || null);
    }

    // Next episode overlay: show when within last 30 seconds
    if (nextEpisode && video.duration > 0) {
      const remaining = video.duration - video.currentTime;
      if (remaining <= 30 && remaining > 0 && !showNextOverlay) {
        setShowNextOverlay(true);
      }
    }
  };

  const handlePlayNext = useCallback(() => {
    if (nextEpisode) {
      navigate(`/player/${nextEpisode.ratingKey}`, { replace: true });
    }
  }, [nextEpisode, navigate]);

  const handleCancelNext = useCallback(() => {
    setShowNextOverlay(false);
  }, []);

  /** Seek to a specific time in the video */
  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  /** Generate BIF thumbnail preview URL when indexes are available */
  const getPreviewUrl = useMemo(() => {
    const part = item?.Media?.[selectedMedia]?.Part?.[0];
    // indexes field indicates BIF thumbnail availability (not in PlexPart type)
    const hasIndexes = !!(part && (part as unknown as Record<string, unknown>).indexes);
    if (!hasIndexes || !part?.id) return undefined;
    return (time: number): string | null => {
      return flixor.plexServer.getPhotoTranscodeUrl(
        `/library/parts/${part.id}/indexes/sd/${Math.floor(time)}`,
        320,
        180,
      );
    };
  }, [item, selectedMedia]);

  const handleEnded = () => {
    const video = videoRef.current;
    if (ratingKey && video) {
      flixor.plexServer.updateTimeline(
        ratingKey, "stopped",
        Math.floor(video.currentTime * 1000),
        Math.floor(video.duration * 1000),
      );
    }
    if (nextEpisode) {
      navigate(`/player/${nextEpisode.ratingKey}`, { replace: true });
    } else {
      navigate(-1);
    }
  };



  if (!videoUrl) return <div className="loading">Initializing player...</div>;

  return (
    <div className="player-container" onMouseMove={handleMouseMove}>
      <video
        ref={videoRef}
        className="tv-video"
        autoPlay
        /* Native controls aren't D-pad navigable on Tizen — use the custom
           focusable overlay below instead. */
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPaused(false)}
        onPause={() => setIsPaused(true)}
        onWaiting={() => setIsBuffering(true)}
        onStalled={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
      >
        Your browser does not support the video tag.
      </video>

      {/* Buffering / starting indicator — visible until the video starts
          playing (transcoded + burned-subtitle streams take a few seconds). */}
      {isBuffering && (
        <div className="player-buffering">
          <div className="player-buffering-spinner" />
          <div className="player-buffering-label">
            {streamMode === "burn"
              ? "Transcoding (burning in subtitles)…"
              : streamMode === "transcode"
                ? "Transcoding…"
                : "Starting…"}
          </div>
          {streamMode !== "start" && (
            <div className="player-buffering-sublabel">
              Your Plex server is converting this title — this can take a few seconds.
            </div>
          )}
        </div>
      )}

      {/* Playback Stats HUD */}
      <StatsHUD videoRef={videoRef} item={item} visible={showStatsHud} playbackStrategy={playbackStrategy ?? undefined} />

      {/* Transcode/subtitle debug panel (GREEN key / "g") */}
      <TranscodeDebugOverlay visible={showTranscodeDebug} />

      {/* Next Episode Overlay — uses NextEpisodeCountdown component */}
      {showNextOverlay && nextEpisode && (
        <NextEpisodeCountdown
          episode={nextEpisode}
          countdownSeconds={30}
          onPlayNext={handlePlayNext}
          onCancel={handleCancelNext}
        />
      )}

      {/* Audio Track Picker Modal */}
      {showAudioPicker && (
        <TrackPicker
          title="Audio"
          tracks={audioTracks}
          selectedId={selectedAudio}
          onSelect={(id) => {
            handleTrackChange("audio", id);
            setShowAudioPicker(false);
          }}
          onClose={() => setShowAudioPicker(false)}
          returnFocusKey="player-audio-btn"
        />
      )}

      {/* Subtitle Track Picker Modal */}
      {showSubPicker && (
        <TrackPicker
          title="Subtitles"
          tracks={subtitleTracks}
          selectedId={selectedSub}
          onSelect={(id) => {
            handleTrackChange("subtitle", id);
            setShowSubPicker(false);
          }}
          onClose={() => setShowSubPicker(false)}
          showOff
          returnFocusKey="player-sub-btn"
        />
      )}

      {/* Version Picker Modal */}
      {showVersionPicker && item?.Media && (
        <VersionPickerModal
          versions={item.Media}
          selectedIndex={selectedMedia}
          onSelect={(idx) => {
            setSelectedMedia(idx);
            setShowVersionPicker(false);
          }}
          onClose={() => setShowVersionPicker(false)}
        />
      )}

      {showControls && (
        <FocusContext.Provider value={controlsFocusKey}>
        <div className="player-overlay" ref={controlsRef}>
          <FocusableButton className="player-exit" onClick={() => navigate(-1)}>
            &times;
          </FocusableButton>

          <div className="player-meta">
            <h2 className="player-title">{item?.title}</h2>
            {item?.type === "episode" && (
              <div className="player-episode-meta">
                S{item.parentIndex || "?"}:E{item.index || "?"} · {(item as unknown as Record<string, unknown>).grandparentTitle as string || ""}
              </div>
            )}
          </div>

          {activeMarker && (
            <button
              className="player-skip-btn"
              onClick={() => {
                if (videoRef.current && activeMarker) {
                  videoRef.current.currentTime = activeMarker.endTimeOffset / 1000;
                  setActiveMarker(null);
                }
              }}
            >
              Skip{" "}
              {activeMarker.type === "intro" ? "Intro" : activeMarker.type === "credits" ? "Credits" : "Commercial"}
            </button>
          )}

          {/* Seek Slider */}
          <div style={{ padding: "0 24px", marginBottom: 12 }}>
            <SeekSlider
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              getPreviewUrl={getPreviewUrl}
            />
          </div>

          <div className="player-tracks">
            {/* Play / Pause — takes initial focus when the overlay opens */}
            <FocusableButton
              className="track-group-btn"
              focusKey="player-playpause"
              focusOnMount
              onClick={togglePlayPause}
            >
              {isPaused ? "▶ Play" : "⏸ Pause"}
            </FocusableButton>

            {/* Version picker trigger */}
            {item?.Media && item.Media.length > 1 && (
              <FocusableButton
                className="track-group-btn"
                onClick={() => setShowVersionPicker(true)}
              >
                Version {selectedMedia + 1}
              </FocusableButton>
            )}

            {/* Quality picker — options filtered by source resolution via StreamDecisionService */}
            <div className="track-group">
              <h3>Quality</h3>
              {qualityOptions.map((opt) => (
                <FocusableButton
                  key={opt.value}
                  className={`track-btn ${quality === opt.value ? "active" : ""}`}
                  onClick={() => handleQualityChange(opt.value)}
                >
                  {opt.label}
                </FocusableButton>
              ))}
            </div>

            {/* Audio track picker trigger */}
            <FocusableButton
              className="track-group-btn"
              focusKey="player-audio-btn"
              onClick={() => setShowAudioPicker(true)}
            >
              Audio: {audioTracks.find((t) => t.id === selectedAudio)?.language || "Default"}
            </FocusableButton>

            {/* Subtitle track picker trigger */}
            <FocusableButton
              className="track-group-btn"
              focusKey="player-sub-btn"
              onClick={() => setShowSubPicker(true)}
            >
              Subtitles: {selectedSub === null ? "Off" : subtitleTracks.find((t) => t.id === selectedSub)?.language || "On"}
            </FocusableButton>

            {/* Playback speed control */}
            <FocusableButton className="track-group-btn" onClick={cycleSpeed}>
              Speed: {playbackSpeed}x
            </FocusableButton>
          </div>
        </div>
        </FocusContext.Provider>
      )}
    </div>
  );
}
