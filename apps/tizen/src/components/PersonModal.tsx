import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import * as tmdbService from "../services/tmdb";
import { SmartImage } from "./SmartImage";
import type { TMDBPerson, TMDBPersonCreditItem } from "@flixor/core";

export interface PersonModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** TMDB person ID (preferred) */
  personId?: number;
  /** Person name for search fallback when personId is unavailable */
  name?: string;
}

interface CreditItem {
  id: number;
  title: string;
  posterPath: string | null;
  mediaType: "movie" | "tv";
  character?: string;
  year?: string;
}

function mapCredits(items: TMDBPersonCreditItem[], type: "movie" | "tv"): CreditItem[] {
  return items
    .filter((c) => c.media_type === type)
    .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))
    .slice(0, 20)
    .map((c) => ({
      id: c.id,
      title: (type === "movie" ? c.title : c.name) || "Unknown",
      posterPath: c.poster_path || null,
      mediaType: type,
      character: c.character,
      year: (type === "movie" ? c.release_date : c.first_air_date)?.split("-")[0],
    }));
}

/** Focusable credit card with poster, title, and character name */
function CreditCard({
  item,
  onSelect,
}: {
  item: CreditItem;
  onSelect: (item: CreditItem) => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect(item),
  });

  return (
    <div
      ref={ref}
      style={{
        flexShrink: 0,
        width: 140,
        cursor: "pointer",
        borderRadius: 8,
        border: focused ? "3px solid #ff4b2b" : "3px solid transparent",
        padding: 2,
        transition: "border-color 0.15s, transform 0.15s",
        transform: focused ? "scale(1.05)" : "scale(1)",
      }}
      onClick={() => onSelect(item)}
    >
      <div
        style={{
          width: "100%",
          /* 2/3 via padding hack — aspect-ratio is Chrome 88+ */
          position: "relative",
          height: 0,
          paddingTop: "150%",
          borderRadius: 6,
          overflow: "hidden",
          background: "#333",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
        {item.posterPath ? (
          <SmartImage
            src={item.posterPath}
            alt={item.title}
            kind="poster"
            useTmdb
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: 14,
            }}
          >
            No Image
          </div>
        )}
        </div>
      </div>
      <div style={{ marginTop: 6, padding: "0 2px" }}>
        <div
          style={{
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </div>
        {item.character && (
          <div
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 11,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.character}
          </div>
        )}
        {item.year && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            {item.year}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal scrollable credit row with spatial navigation */
function CreditRow({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: CreditItem[];
  onSelect: (item: CreditItem) => void;
}) {
  const { ref, focusKey } = useFocusable({ trackChildren: true });

  if (items.length === 0) return null;

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} style={{ marginBottom: 24 }}>
        <h3
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          {title} ({items.length})
        </h3>
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            justifyContent: "start",
            gridGap: 12,
            overflowX: "auto",
            paddingBottom: 8,
          }}
        >
          {items.map((item) => (
            <CreditCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

/** Focusable close button */
function CloseButton({ onClose }: { onClose: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onClose });

  return (
    <button
      ref={ref}
      onClick={onClose}
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: focused ? "3px solid #ff4b2b" : "3px solid transparent",
        background: focused ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 20,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color 0.15s, background 0.15s",
        padding: 0,
      }}
      aria-label="Close"
    >
      ✕
    </button>
  );
}

export function PersonModal({ open, onClose, personId, name }: PersonModalProps) {
  const navigate = useNavigate();
  const [person, setPerson] = useState<TMDBPerson | null>(null);
  const [movies, setMovies] = useState<CreditItem[]>([]);
  const [tvShows, setTvShows] = useState<CreditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { ref, focusKey, focusSelf } = useFocusable({ isFocusBoundary: true });

  // Focus the modal on open
  useEffect(() => {
    if (open) focusSelf();
  }, [open, focusSelf]);

  // Close on Back key (Tizen 10009) or Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.keyCode === 10009 || e.key === "Escape" || e.key === "GoBack") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown, true);
    }
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open, handleKeyDown]);

  // Fetch person details and credits
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPerson(null);
    setMovies([]);
    setTvShows([]);

    (async () => {
      try {
        let resolvedId = personId;

        // Search by name if no ID provided
        if (!resolvedId && name) {
          const searchRes = await flixor.tmdb.searchPerson(name);
          if (searchRes.results?.length > 0) {
            resolvedId = searchRes.results[0].id;
          }
        }

        if (!resolvedId) {
          setLoading(false);
          return;
        }

        const [details, credits] = await Promise.all([
          tmdbService.getPersonDetails(resolvedId),
          tmdbService.getPersonCredits(resolvedId),
        ]);

        setPerson(details);

        if (credits?.cast) {
          setMovies(mapCredits(credits.cast, "movie"));
          setTvShows(mapCredits(credits.cast, "tv"));
        }
      } catch (err) {
        console.error("PersonModal: failed to load person data", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, personId, name]);

  /** Navigate to Plex details if matched, otherwise show TMDB-only info */
  const handleCreditSelect = useCallback(
    async (item: CreditItem) => {
      try {
        const guid = `tmdb://${item.id}`;
        const plexItems = await flixor.plexServer.findByGuid(
          guid,
          item.mediaType === "movie" ? 1 : 2,
        );

        onClose();

        if (plexItems.length > 0) {
          navigate(`/details/${plexItems[0].ratingKey}`);
        } else {
          // Navigate to TMDB-only details view
          navigate(`/details/tmdb:${item.mediaType}:${item.id}`);
        }
      } catch {
        // On error, try TMDB-only navigation
        onClose();
        navigate(`/details/tmdb:${item.mediaType}:${item.id}`);
      }
    },
    [navigate, onClose],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
      onClick={onClose}
    >
      <FocusContext.Provider value={focusKey}>
        <div
          ref={ref}
          style={{
            width: "100%",
            maxWidth: 960,
            maxHeight: "90vh",
            overflowY: "auto",
            background: "#141414",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div
              style={{
                padding: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
              }}
            >
              Loading…
            </div>
          ) : !person ? (
            <div
              style={{
                padding: 64,
                textAlign: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 16,
              }}
            >
              Person not found.
            </div>
          ) : (
            <>
              {/* Header: profile photo + info */}
              <div
                style={{
                  display: "flex",
                  padding: 24,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  position: "relative",
                }}
              >
                <CloseButton onClose={onClose} />

                {/* Profile photo */}
                <div style={{ flexShrink: 0, marginRight: 24 }}>
                  {person.profile_path ? (
                    <SmartImage
                      src={person.profile_path}
                      alt={person.name}
                      kind="profile"
                      useTmdb
                      width={120}
                      height={120}
                    />
                  ) : (
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #ff4b2b, #ff9b44)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 48,
                        fontWeight: 700,
                      }}
                    >
                      {person.name[0]}
                    </div>
                  )}
                </div>

                {/* Person info */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: 48 }}>
                  <h2
                    style={{
                      color: "#fff",
                      fontSize: 28,
                      fontWeight: 700,
                      margin: "0 0 8px",
                    }}
                  >
                    {person.name}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    {person.birthday && (
                      <span style={{ margin: "0 16px 4px 0" }}>
                        Born:{" "}
                        {new Date(person.birthday).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {person.place_of_birth && (
                      <span style={{ margin: "0 16px 4px 0" }}>{person.place_of_birth}</span>
                    )}
                  </div>

                  {person.biography && (
                    <p
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 14,
                        lineHeight: 1.5,
                        margin: 0,
                        display: "-webkit-box",
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {person.biography}
                    </p>
                  )}
                </div>
              </div>

              {/* Credit rows */}
              <div style={{ padding: 24 }}>
                <CreditRow
                  title="Movies"
                  items={movies}
                  onSelect={handleCreditSelect}
                />
                <CreditRow
                  title="TV Shows"
                  items={tvShows}
                  onSelect={handleCreditSelect}
                />

                {movies.length === 0 && tvShows.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "48px 0",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 15,
                    }}
                  >
                    No filmography found for this person.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </FocusContext.Provider>
    </div>
  );
}
