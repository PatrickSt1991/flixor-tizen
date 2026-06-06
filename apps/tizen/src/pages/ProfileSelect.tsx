import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { cacheService } from "../services/cache";
import type { PlexHomeUser } from "@flixor/core";

/* ------------------------------------------------------------------ */
/*  PIN Dialog                                                         */
/* ------------------------------------------------------------------ */

interface PinDialogProps {
  user: PlexHomeUser;
  error: string | null;
  submitting: boolean;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

/**
 * On-screen key for the PIN pad — focusable via D-pad spatial navigation.
 * A text <input> is useless on a TV: typing needs the browser IME (which
 * never opens for JS focus) and many Samsung smart remotes have no number
 * row at all. Every digit must be enterable with arrows + OK alone.
 */
function PinKey({
  label,
  onPress,
  disabled,
  wide,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  wide?: boolean;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (!disabled) onPress();
    },
  });
  return (
    <button
      ref={ref}
      className={`pin-key${wide ? " wide" : ""}${focused ? " focused" : ""}`}
      onClick={() => {
        if (!disabled) onPress();
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

function PinDialog({
  user,
  error,
  submitting,
  onSubmit,
  onCancel,
}: PinDialogProps) {
  const [pin, setPin] = useState("");

  const {
    ref: dialogRef,
    focusKey: dialogFocusKey,
    focusSelf,
  } = useFocusable({
    focusKey: "pin-dialog",
    trackChildren: true,
    isFocusBoundary: true,
  });

  // Focus the dialog container on mount so spatial nav owns focus
  useEffect(() => {
    const timer = setTimeout(() => {
      focusSelf();
    }, 100);
    return () => clearTimeout(timer);
  }, [focusSelf]);

  const appendDigit = useCallback(
    (d: string) => {
      if (submitting) return;
      setPin((p) => (p.length >= 4 ? p : p + d));
    },
    [submitting],
  );

  const backspace = useCallback(() => {
    setPin((p) => p.slice(0, -1));
  }, []);

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4 && !submitting) {
      onSubmit(pin);
    }
  }, [pin, submitting, onSubmit]);

  // Wrong PIN: clear the entry so the user can retype immediately.
  // (Canonical adjust-state-during-render pattern instead of an effect.)
  const [prevError, setPrevError] = useState<string | null>(null);
  if (error !== prevError) {
    setPrevError(error);
    if (error) setPin("");
  }

  // Physical remote keys: number row types directly (keycodes 48-57 / numpad
  // 96-105); BACK deletes a digit, or closes the dialog when empty. Capture
  // phase + stopImmediatePropagation keeps useTizenRemote's global BACK
  // handler from navigating the page away underneath the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const kc = e.keyCode || e.which;
      if ((kc >= 48 && kc <= 57) || (kc >= 96 && kc <= 105)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        appendDigit(String(kc >= 96 ? kc - 96 : kc - 48));
        return;
      }
      if (kc === 10009 || e.key === "Backspace" || e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (pin.length > 0) {
          backspace();
        } else {
          onCancel();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [pin.length, appendDigit, backspace, onCancel]);

  return (
    <div className="pin-overlay">
      <FocusContext.Provider value={dialogFocusKey}>
        <div ref={dialogRef} className="pin-dialog">
          <h2 className="pin-dialog-title">Enter PIN for {user.title}</h2>

          <div className="pin-dots" aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`pin-dot${i < pin.length ? " filled" : ""}`}
              />
            ))}
          </div>

          {error && <p className="pin-error">{error}</p>}
          {submitting && <p className="pin-status">Verifying…</p>}

          <div className="pin-pad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <PinKey
                key={d}
                label={d}
                disabled={submitting}
                onPress={() => appendDigit(d)}
              />
            ))}
            <PinKey label="⌫" disabled={submitting} onPress={backspace} />
            <PinKey label="0" disabled={submitting} onPress={() => appendDigit("0")} />
            <PinKey label="✕" disabled={submitting} onPress={onCancel} />
          </div>
        </div>
      </FocusContext.Provider>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Profile Card                                                       */
/* ------------------------------------------------------------------ */

interface ProfileCardProps {
  user: PlexHomeUser;
  disabled: boolean;
  onSelect: (user: PlexHomeUser) => void;
}

function ProfileCard({ user, disabled, onSelect }: ProfileCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (!disabled) onSelect(user);
    },
  });

  const initial = (user.title || user.username || "?").charAt(0).toUpperCase();

  return (
    <button
      ref={ref}
      className={`profile-card${focused ? " focused" : ""}${disabled ? " disabled" : ""}`}
      onClick={() => {
        if (!disabled) onSelect(user);
      }}
      disabled={disabled}
    >
      <div className="profile-avatar">
        {user.thumb ? (
          <img
            src={user.thumb}
            alt={user.title}
            className="profile-avatar-img"
          />
        ) : (
          <span className="profile-avatar-initial">{initial}</span>
        )}
      </div>
      <span className="profile-card-name">{user.title}</span>
      {user.admin && <span className="profile-badge admin">Admin</span>}
      {user.protected && <span className="profile-badge pin">🔒</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  ProfileSelect Page                                                 */
/* ------------------------------------------------------------------ */

export function ProfileSelect() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<PlexHomeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PIN dialog state
  const [pinUser, setPinUser] = useState<PlexHomeUser | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  const {
    ref: containerRef,
    focusKey: containerFocusKey,
    focusSelf,
  } = useFocusable({
    focusKey: "profile-select",
    trackChildren: true,
    isFocusBoundary: true,
  });

  const switchProfile = useCallback(
    async (user: PlexHomeUser, pin?: string) => {
      try {
        await flixor.switchToProfile(user, pin);
        // Clear all caches so Home loads fresh data for the new profile
        cacheService.clear();
        navigate("/");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to switch profile";
        // If this was a PIN attempt, surface the error in the dialog
        if (pin !== undefined) {
          setPinError(message);
          setPinSubmitting(false);
        } else {
          setError(message);
        }
      }
    },
    [navigate],
  );

  const handleProfileSelect = useCallback(
    (user: PlexHomeUser) => {
      if (user.protected) {
        setPinUser(user);
        setPinError(null);
      } else {
        switchProfile(user);
      }
    },
    [switchProfile],
  );

  const handlePinSubmit = useCallback(
    (pin: string) => {
      if (!pinUser) return;
      setPinSubmitting(true);
      setPinError(null);
      switchProfile(pinUser, pin);
    },
    [pinUser, switchProfile],
  );

  const handlePinCancel = useCallback(() => {
    setPinUser(null);
    setPinError(null);
    setPinSubmitting(false);
  }, []);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await flixor.getHomeUsers();
      setUsers(list);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch profiles";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Restore focus into the profile grid once profiles are loaded
  useEffect(() => {
    if (!loading && users.length > 0) {
      // Small delay to let the DOM render profile cards before focusing
      const timer = setTimeout(() => focusSelf(), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, users.length, focusSelf]);

  /* Loading state */
  if (loading) {
    return (
      <div className="tv-container profile-select-container loading-state">
        <h1 className="logo">FLIXOR</h1>
        <p>Loading profiles…</p>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <FocusContext.Provider value={containerFocusKey}>
      <div ref={containerRef} className="tv-container profile-select-container">
        <h1 className="logo">FLIXOR</h1>
        <h2>Who's Watching?</h2>

        {error && (
          <div className="server-error">
            <p className="error-message">{error}</p>
            <RetryButton onClick={fetchProfiles} />
          </div>
        )}

        {!error && users.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h2>No Profiles Found</h2>
            <p>We couldn't find any profiles on your Plex Home.</p>
            <RetryButton onClick={fetchProfiles} />
          </div>
        )}

        {users.length > 0 && (
          <div className="profile-grid">
            {users.map((user) => (
              <ProfileCard
                key={user.id}
                user={user}
                disabled={pinUser !== null}
                onSelect={handleProfileSelect}
              />
            ))}
          </div>
        )}

        {pinUser && (
          <PinDialog
            user={pinUser}
            error={pinError}
            submitting={pinSubmitting}
            onSubmit={handlePinSubmit}
            onCancel={handlePinCancel}
          />
        )}
      </div>
    </FocusContext.Provider>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onClick });
  return (
    <button
      ref={ref}
      className={`btn-primary${focused ? " focused" : ""}`}
      onClick={onClick}
    >
      Retry
    </button>
  );
}
