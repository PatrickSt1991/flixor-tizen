import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
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

  // The focus boundary lives on a TIGHT wrapper around just the action
  // buttons — NOT the whole 85vh <section>. A section-sized focusable stole
  // focus when navigating UP from the first row (its bottom edge is nearest,
  // and norigin targets the container instead of delegating to a child), so
  // up from the rows landed on the invisible section. A small wrapper (like
  // the nav) delegates correctly to Play / More Info. Verified in Chromium 63.
  const { ref: actionsRef, focusKey } = useFocusable({
    focusKey: "hero-carousel",
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ["left", "right"],
  });

  // `focused` must be rendered as a class: norigin's spatial focus is
  // virtual (no element.focus()), so the :focus styles never apply on TV
  // and the initially-focused Play button looked like nothing had focus.
  const { ref: playRef, focused: playFocused, focusSelf: focusPlay } = useFocusable({
    focusKey: "hero-play",
    onFocus: () => {
      setPaused(true);
      emitBackdropForCurrent();
    },
    onBlur: () => setPaused(false),
  });

  const { ref: infoRef, focused: infoFocused } = useFocusable({
    onFocus: () => {
      setPaused(true);
      emitBackdropForCurrent();
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

        <FocusContext.Provider value={focusKey}>
          <div className="hero-actions" ref={actionsRef}>
            <button
              ref={playRef}
              className={`btn-primary${playFocused ? " focused" : ""}`}
              onClick={() => {
                const part = currentItem.Media?.[0]?.Part?.[0];
                if (part) navigate(`/player/${currentItem.ratingKey}`);
              }}
            >
              <span className="icon">▶</span> Play
            </button>
            <button
              ref={infoRef}
              className={`btn-secondary${infoFocused ? " focused" : ""}`}
              onClick={() => navigate(`/details/${currentItem.ratingKey}`)}
            >
              More Info
            </button>
          </div>
        </FocusContext.Provider>
      </div>
    </section>
  );
}
