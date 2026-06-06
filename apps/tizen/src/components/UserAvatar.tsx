/**
 * UserAvatar — Circular avatar with initial-letter fallback.
 *
 * Displays the current user's profile picture in a circle.
 * Falls back to the first letter of the user's name when the
 * image URL is missing or fails to load.
 * Uses `useFocusable` for Tizen remote / D-PAD navigation.
 */

import { useState, useCallback } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

export interface UserAvatarProps {
  /** Avatar image URL (Plex thumb). */
  thumb?: string;
  /** Display name — first character used as fallback initial. */
  title: string;
  /** Callback when the user presses Enter on the avatar. */
  onPress?: () => void;
}

export function UserAvatar({ thumb, title, onPress }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const handlePress = useCallback(() => onPress?.(), [onPress]);

  const { ref, focused } = useFocusable({
    onEnterPress: handlePress,
  });

  const handleImgError = useCallback(() => setImgError(true), []);

  const showImage = !!thumb && !imgError;
  const initial = (title || "?").charAt(0).toUpperCase();

  return (
    <button
      ref={ref}
      onClick={handlePress}
      aria-label={`User profile: ${title}`}
      tabIndex={0}
      style={{
        display: "grid",
        gridAutoFlow: "column",
        alignItems: "center",
        gap: 10,
        padding: 4,
        background: "transparent",
        border: focused ? "3px solid #ff4b2b" : "3px solid transparent",
        borderRadius: 30,
        cursor: "pointer",
        outline: "none",
        transition: "all 0.2s ease",
        transform: focused ? "scale(1.08)" : "scale(1)",
      }}
    >
      {/* Avatar circle */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          background: showImage
            ? "#333"
            : "linear-gradient(135deg, #ff4b2b, #ff9b44)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImage ? (
          <img
            src={thumb}
            alt={title}
            onError={handleImgError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            {initial}
          </span>
        )}
      </div>

      {/* Name label (visible beside avatar) */}
      <span
        style={{
          color: focused ? "#fff" : "rgba(255,255,255,0.8)",
          fontSize: 14,
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 120,
          transition: "color 0.2s ease",
        }}
      >
        {title}
      </span>
    </button>
  );
}
