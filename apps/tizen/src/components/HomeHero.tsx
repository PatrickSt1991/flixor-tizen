/**
 * HomeHero — Full-width static hero with optional trailer autoplay.
 *
 * Displays a backdrop image with TMDB logo overlay, Play + More Info buttons,
 * and optional muted video background (Plex direct or YouTube embed).
 * Falls back to static backdrop on video load error.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { SmartImage } from "./SmartImage";
import { flixor } from "../services/flixor";
import * as tmdbService from "../services/tmdb";
import type { HeroItem } from "../pages/Home";

interface TMDBImageEntry {
  file_path: string;
  iso_639_1?: string | null;
}

export interface HomeHeroProps {
  item: HeroItem;
  onPlay?: () => void;
  onMoreInfo?: () => void;
}

export function HomeHero({ item, onPlay, onMoreInfo }: HomeHeroProps) {
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const playHandler = useMemo(() => () => onPlay?.(), [onPlay]);
  const infoHandler = useMemo(() => () => onMoreInfo?.(), [onMoreInfo]);
  const muteHandler = useMemo(() => () => setMuted((m) => !m), []);

  const { ref: sectionRef, focusKey } = useFocusable({
    focusKey: "home-hero",
    trackChildren: true,
  });

  const { ref: playRef, focused: playFocused } = useFocusable({
    onEnterPress: playHandler,
  });

  const { ref: infoRef, focused: infoFocused } = useFocusable({
    onEnterPress: infoHandler,
  });

  const { ref: muteRef, focused: muteFocused } = useFocusable({
    onEnterPress: muteHandler,
  });

  // Resolve TMDB logo for the hero item
  useEffect(() => {
    let cancelled = false;

    const fetchLogo = async () => {
      setLogoUrl(null);
      try {
        const rk = item.ratingKey || "";
        const tmdbMatch = rk.match(/^tmdb-(movie|tv)-(\d+)$/);

        if (tmdbMatch) {
          const mediaType = tmdbMatch[1] as "movie" | "tv";
          const tmdbId = Number(tmdbMatch[2]);
          const images = await tmdbService.getImages(tmdbId, mediaType);
          const logos = (images.logos || []) as TMDBImageEntry[];
          const logo =
            logos.find((l) => l.iso_639_1 === "en") || logos[0];
          if (logo && !cancelled) {
            setLogoUrl(tmdbService.buildImageUrl(logo.file_path, "logo"));
          }
        } else if (rk && !rk.startsWith("trakt-")) {
          // Plex item — try to find TMDB ID via guid
          const guid = item.guid || "";
          const findResult = await flixor.tmdb.findByImdbId(guid);
          const tid =
            findResult.movie_results[0]?.id ||
            findResult.tv_results[0]?.id;
          if (tid) {
            const imgs = findResult.movie_results[0]
              ? await flixor.tmdb.getMovieImages(tid)
              : await flixor.tmdb.getTVImages(tid);
            const logos = (imgs.logos || []) as TMDBImageEntry[];
            const logo =
              logos.find((l) => l.iso_639_1 === "en") || logos[0];
            if (logo && !cancelled) {
              setLogoUrl(
                flixor.tmdb.getImageUrl(logo.file_path as string, "w500"),
              );
            }
          }
        }
      } catch {
        /* logo fetch failed — fall back to title text */
      }
    };

    fetchLogo();
    return () => {
      cancelled = true;
    };
  }, [item]);

  // Reset video state when item changes
  const itemKey = item.ratingKey || "";
  const [prevItemKey, setPrevItemKey] = useState(itemKey);
  if (prevItemKey !== itemKey) {
    setPrevItemKey(itemKey);
    setPlaying(false);
    setVideoError(false);
  }

  // Auto-start video after 5s delay
  useEffect(() => {
    if (item.videoUrl || item.ytKey) {
      playTimerRef.current = setTimeout(() => setPlaying(true), 5000);
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [item.videoUrl, item.ytKey]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    setPlaying(false);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setPlaying(false);
  }, []);

  const hasVideo = !!(item.videoUrl || item.ytKey) && !videoError;
  const showVideo = playing && hasVideo;

  // Build backdrop URL
  const backdropSrc = item.art?.startsWith("http")
    ? item.art
    : flixor.plexServer.getImageUrl(item.art || item.thumb);

  return (
    <FocusContext.Provider value={focusKey}>
      <section
        ref={sectionRef}
        style={{
          position: "relative",
          width: "100%",
          height: "56vh",
          overflow: "hidden",
          background: "#111",
        }}
      >
        {/* Backdrop image layer */}
        {backdropSrc && (
          <div
            style={{
              position: "absolute",
              top: 0, right: 0, bottom: 0, left: 0,
              opacity: showVideo ? 0 : 1,
              transition: "opacity 1s ease",
            }}
          >
            <SmartImage
              src={backdropSrc}
              alt={item.title}
              width="100%"
              height="100%"
            />
          </div>
        )}

        {/* Video layer — Plex direct */}
        {showVideo && item.videoUrl && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.6 }}>
            <video
              ref={videoRef}
              src={item.videoUrl}
              autoPlay
              muted={muted}
              playsInline
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* Video layer — YouTube embed */}
        {showVideo && !item.videoUrl && item.ytKey && (
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.6 }}>
            <iframe
              title="Trailer"
              src={`https://www.youtube.com/embed/${item.ytKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=0&playsinline=1&rel=0&showinfo=0&modestbranding=1&enablejsapi=1`}
              allow="autoplay; encrypted-media"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        )}

        {/* Gradient overlays */}
        <div
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 40%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0, right: 0, bottom: 0, left: 0,
            background:
              "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 40%, transparent 100%)",
          }}
        />

        {/* Content overlay */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            padding: "24px 48px",
            display: "grid",
            justifyItems: "start",
            gridGap: 10,
          }}
        >
          {/* Logo or title */}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={item.title}
              style={{
                height: 72,
                maxWidth: "50vw",
                objectFit: "contain",
                objectPosition: "left",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.9))",
              }}
            />
          ) : (
            <h1
              style={{
                color: "#fff",
                fontSize: 36,
                fontWeight: 700,
                margin: 0,
                textShadow: "0 4px 20px rgba(0,0,0,0.9)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.title}
            </h1>
          )}

          {/* Meta badges */}
          <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", alignItems: "center", gridGap: 8 }}>
            {item.year && (
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
                {item.year}
              </span>
            )}
            {item.contentRating && (
              <span
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 14,
                  padding: "2px 6px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: 4,
                }}
              >
                {item.contentRating}
              </span>
            )}
            {item.duration ? (
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                {Math.round(item.duration / 60000)}m
              </span>
            ) : null}
          </div>

          {/* Overview */}
          {item.summary && (
            <p
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 14,
                lineHeight: 1.5,
                margin: 0,
                maxWidth: 600,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {item.summary}
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: "grid", gridAutoFlow: "column", justifyContent: "start", alignItems: "center", gridGap: 12, marginTop: 4 }}>
            <button
              ref={playRef}
              onClick={() => onPlay?.()}
              style={{
                display: "inline-grid",
                gridAutoFlow: "column",
                alignItems: "center",
                gridGap: 8,
                padding: "10px 28px",
                borderRadius: 8,
                border: playFocused
                  ? "3px solid #ff4b2b"
                  : "3px solid transparent",
                background: "#fff",
                color: "#000",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                transform: playFocused ? "scale(1.05)" : "scale(1)",
              }}
              tabIndex={0}
            >
              ▶ Play
            </button>

            <button
              ref={infoRef}
              onClick={() => onMoreInfo?.()}
              style={{
                display: "inline-grid",
                gridAutoFlow: "column",
                alignItems: "center",
                gridGap: 8,
                padding: "10px 28px",
                borderRadius: 8,
                border: infoFocused
                  ? "3px solid #ff4b2b"
                  : "3px solid transparent",
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
                outline: "none",
                transition: "all 0.2s ease",
                transform: infoFocused ? "scale(1.05)" : "scale(1)",
                backdropFilter: "blur(4px)",
              }}
              tabIndex={0}
            >
              ℹ More Info
            </button>
          </div>
        </div>

        {/* Mute/unmute toggle */}
        {hasVideo && (
          <button
            ref={muteRef}
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: muteFocused
                ? "3px solid #ff4b2b"
                : "3px solid transparent",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 18,
              cursor: "pointer",
              outline: "none",
              transition: "all 0.2s ease",
              transform: muteFocused ? "scale(1.1)" : "scale(1)",
            }}
            tabIndex={0}
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
      </section>
    </FocusContext.Provider>
  );
}
