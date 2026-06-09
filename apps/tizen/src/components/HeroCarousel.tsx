import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { loadSettings } from "../services/settings";
import type { PlexMediaItem } from "@flixor/core";

interface HeroCarouselProps {
  items: PlexMediaItem[];
  onBackdropChange?: (url: string) => void;
}

export function HeroCarousel({ items, onBackdropChange }: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logo, setLogo] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [fadeClass, setFadeClass] = useState("hero-slide-active");
  const navigate = useNavigate();
  const pausedRef = useRef(paused);

  // NO focusable container around the hero buttons. Any wrapper focusable —
  // even a tight one — gets targeted when navigating UP from the first row
  // instead of delegating to Play (norigin picks the nearest focusable, and a
  // container competes with its own child). The Play/More-Info buttons are the
  // only focusables here.
  //
  // On focus, scroll the PAGE to the very top rather than centring the button:
  // the hero is the top section, so this keeps the top nav (now in normal
  // flow) on screen. Centring the button scrolled the page down and pushed the
  // nav off the top — "the navbar disappears after load" (Play is auto-focused
  // on Home). Verified in Chromium 63.
  const scrollPageToTop = (el: HTMLElement | null) => {
    const page = el?.closest(".tv-container") as HTMLElement | null;
    if (page) page.scrollTo({ top: 0, behavior: "auto" });
  };

  // Shared by onClick AND onEnterPress — norigin OK fires onEnterPress, NOT
  // the DOM onClick, so without these the hero buttons did nothing on the
  // remote. Play goes to the player when the item is directly playable
  // (has a Media Part), otherwise to its details page (hero items pulled from
  // trending/TMDB often have no Plex Part yet).
  const handlePlay = () => {
    const cur = items[currentIndex];
    if (!cur) return;
    const part = cur.Media?.[0]?.Part?.[0];
    navigate(part ? `/player/${cur.ratingKey}` : `/details/${cur.ratingKey}`);
  };
  const handleInfo = () => {
    const cur = items[currentIndex];
    if (cur) navigate(`/details/${cur.ratingKey}`);
  };

  const { ref: playRef, focused: playFocused, focusSelf: focusPlay } = useFocusable({
    focusKey: "hero-play",
    onEnterPress: handlePlay,
    onFocus: () => {
      setPaused(true);
      emitBackdropForCurrent();
      scrollPageToTop(playRef.current as HTMLElement | null);
    },
    onBlur: () => setPaused(false),
  });

  const { ref: infoRef, focused: infoFocused } = useFocusable({
    onEnterPress: handleInfo,
    onFocus: () => {
      setPaused(true);
      emitBackdropForCurrent();
      scrollPageToTop(infoRef.current as HTMLElement | null);
    },
    onBlur: () => setPaused(false),
  });

  // Keep ref in sync with state for use in interval callback
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const currentItem = items[currentIndex] ?? null;

  // Reset logo when index changes (render-phase state update avoids cascading effect)
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  if (currentIndex !== prevIndex) {
    setPrevIndex(currentIndex);
    setLogo(null);
  }

  const emitBackdrop = useCallback(
    (item: PlexMediaItem) => {
      const url = flixor.plexServer.getImageUrl(item.art || item.thumb);
      if (url && onBackdropChange) onBackdropChange(url);
    },
    [onBackdropChange],
  );

  // Helper used by focus callbacks (captures currentItem via closure at call time)
  const emitBackdropForCurrent = useCallback(() => {
    const item = items[currentIndex];
    if (item) {
      const url = flixor.plexServer.getImageUrl(item.art || item.thumb);
      if (url && onBackdropChange) onBackdropChange(url);
    }
  }, [items, currentIndex, onBackdropChange]);

  // Fetch logo on mount and when index changes
  useEffect(() => {
    if (!currentItem) return;

    let cancelled = false;

    // Emit backdrop synchronously (no setState, just calls parent callback)
    emitBackdrop(currentItem);

    // Fetch logo asynchronously — setState only after await
    (async () => {
      try {
        const guid = currentItem.guid || "";
        const tmdbIdResult = await flixor.tmdb.findByImdbId(guid);
        if (cancelled) return;
        const tid =
          tmdbIdResult.movie_results[0]?.id || tmdbIdResult.tv_results[0]?.id;
        if (tid) {
          const imgs = tmdbIdResult.movie_results[0]
            ? await flixor.tmdb.getMovieImages(tid)
            : await flixor.tmdb.getTVImages(tid);
          if (cancelled) return;
          const logos = imgs.logos || [];
          const found =
            logos.find((l: { iso_639_1?: string | null; file_path?: string }) => l.iso_639_1 === "en") || logos[0];
          if (found) {
            setLogo(flixor.tmdb.getImageUrl(found.file_path as string, "w500"));
            return;
          }
        }
        if (!cancelled) setLogo(null);
      } catch {
        if (!cancelled) setLogo(null);
      }
    })();

    return () => { cancelled = true; };
  }, [currentIndex, currentItem, emitBackdrop]);

  // Auto-rotation every 15 seconds, paused when hero button is focused
  useEffect(() => {
    if (items.length <= 1) return;

    const settings = loadSettings();
    if (settings.performanceModeEnabled) return; // Skip auto-rotation in performance mode

    const timer = globalThis.setInterval(() => {
      if (pausedRef.current) return;

      setFadeClass("hero-slide-exit");
      globalThis.setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
        setFadeClass("hero-slide-active");
      }, 300);
    }, 15000);

    return () => globalThis.clearInterval(timer);
  }, [items]);

  // Auto-focus play button when items arrive
  useEffect(() => {
    if (items.length > 0) {
      focusPlay();
    }
  }, [items.length, focusPlay]);

  // Early returns AFTER all hooks
  const settings = loadSettings();
  if (!settings.showHeroSection) return null;
  if (items.length === 0 || !currentItem) return null;

  const formattedDuration = currentItem.duration
    ? `${Math.round(currentItem.duration / 60000)}m`
    : null;

  return (
    <section className={`hero-section ${fadeClass}`}>
      <div className="hero-content">
        {logo ? (
          <img src={logo} className="hero-logo" alt={currentItem.title} />
        ) : (
          <h1 className="hero-title">{currentItem.title}</h1>
        )}

        <div className="hero-meta">
          {currentItem.year && (
            <span className="meta-badge">{currentItem.year}</span>
          )}
          <span className="meta-badge">
            {currentItem.contentRating || "PG-13"}
          </span>
          {formattedDuration && (
            <span className="meta-badge">{formattedDuration}</span>
          )}
        </div>

        <p className="hero-overview">
          {currentItem.summary || "No overview available for this title."}
        </p>

        <div className="hero-actions">
          <button
            ref={playRef}
            className={`btn-primary${playFocused ? " focused" : ""}`}
            onClick={handlePlay}
          >
            <span className="icon">▶</span> Play
          </button>
          <button
            ref={infoRef}
            className={`btn-secondary${infoFocused ? " focused" : ""}`}
            onClick={handleInfo}
          >
            More Info
          </button>
        </div>
      </div>
    </section>
  );
}
