import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import type { PlexServer } from "@flixor/core";

interface ServerCardProps {
  server: PlexServer;
  connecting: boolean;
  onSelect: (server: PlexServer) => void;
}

function ServerCard({ server, connecting, onSelect }: ServerCardProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (!connecting) onSelect(server);
    },
  });

  return (
    <button
      ref={ref}
      className={`server-card${focused ? " focused" : ""}${connecting ? " connecting" : ""}`}
      onClick={() => {
        if (!connecting) onSelect(server);
      }}
      disabled={connecting}
    >
      <div className="server-card-icon">🖥</div>
      <div className="server-card-info">
        <span className="server-card-name">{server.name}</span>
        <span className="server-card-status">
          <span className="status-dot available" />
          Available
        </span>
      </div>
      <span className={`server-card-badge ${server.owned ? "owned" : "shared"}`}>
        {server.owned ? "Owned" : "Shared"}
      </span>
    </button>
  );
}

export function ServerSelect() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const {
    ref: containerRef,
    focusKey: containerFocusKey,
    focusSelf,
  } = useFocusable({
    trackChildren: true,
    isFocusBoundary: true,
  });

  const connectToServer = useCallback(
    async (server: PlexServer) => {
      setConnecting(true);
      setError(null);
      try {
        await flixor.connectToPlexServer(server);
        navigate("/profile-select");
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Connection failed";
        setError(message);
        setConnecting(false);
      }
    },
    [navigate],
  );

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await flixor.getPlexServers();
      if (list.length === 1) {
        await connectToServer(list[0]);
        return;
      }
      setServers(list);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch servers";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [connectToServer]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  // Set initial spatial focus once the server cards render. Without this the
  // page loads with NOTHING focused, so the D-pad does nothing and the remote
  // appears dead (ProfileSelect already does this; ServerSelect never did).
  // Confirmed on a 2025 QE77S85F: this is what unblocked server selection.
  useEffect(() => {
    if (!loading && servers.length > 0) {
      const timer = setTimeout(() => focusSelf(), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, servers.length, focusSelf]);

  if (loading) {
    return (
      <div className="tv-container server-select-container loading-state">
        <h1 className="logo">FLIXOR</h1>
        <p>Finding your servers…</p>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <FocusContext.Provider value={containerFocusKey}>
      <div ref={containerRef} className="tv-container server-select-container">
        <h1 className="logo">FLIXOR</h1>
        <h2>Select a Server</h2>

        {error && (
          <div className="server-error">
            <p className="error-message">{error}</p>
            <RetryButton onClick={fetchServers} />
          </div>
        )}

        {!error && servers.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🖥</div>
            <h2>No Servers Found</h2>
            <p>We couldn't find any Plex servers on your account.</p>
            <RetryButton onClick={fetchServers} />
          </div>
        )}

        {servers.length > 0 && (
          <div className="server-grid">
            {servers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                connecting={connecting}
                onSelect={connectToServer}
              />
            ))}
          </div>
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
