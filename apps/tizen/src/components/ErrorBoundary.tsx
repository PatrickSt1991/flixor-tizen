import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * App-wide crash guard.
 *
 * Retail Tizen sets have no dev console, and until now a render-time throw in
 * any page unmounted the entire React tree: the screen froze and — because
 * useTizenRemote's keydown handler unmounted along with it — the remote went
 * dead too. (The SmartThings pointer still moves, because that is drawn by the
 * OS, but nothing responds to its clicks.) That is indistinguishable from a
 * hardware fault to the user.
 *
 * This boundary catches the throw, renders the error + component stack ON
 * SCREEN so the failure is diagnosable off the TV (photograph it), and installs
 * its OWN capture-phase key/click handler so the app is always recoverable with
 * OK or BACK — no power-cycle required.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // Also emit to the index.html boot-overlay channel, for good measure.
    try {
      console.error(
        "[Flixor] Uncaught render error:",
        error,
        info.componentStack,
      );
    } catch {
      /* ignore */
    }
  }

  componentDidMount() {
    // Always listening, but only acts while an error is displayed — so it never
    // interferes with normal spatial navigation.
    window.addEventListener("keydown", this.onKeyDown, { capture: true });
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.onKeyDown, { capture: true });
  }

  private reload = () => {
    // Reset to the app root first (hash routing) so we don't reload straight
    // back into the same broken route.
    try {
      window.location.hash = "#/";
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.state.error) return;
    const kc = e.keyCode || e.which;
    // OK/Enter (13) or Tizen BACK (10009) recovers.
    if (
      kc === 13 ||
      kc === 10009 ||
      e.key === "Enter" ||
      e.key === "Backspace" ||
      e.key === "Escape"
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.reload();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const { error, componentStack } = this.state;
    const message = error?.message || String(error);
    const stack = error?.stack || "";

    return (
      <div
        role="alert"
        onClick={this.reload}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100000,
          background: "#0a0a0a",
          color: "#fff",
          padding: "64px",
          overflowY: "auto",
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        <h1 style={{ color: "#e50914", fontSize: "48px", margin: "0 0 8px" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "24px", color: "#aaa", margin: "0 0 32px" }}>
          Press <strong style={{ color: "#fff" }}>OK</strong> or{" "}
          <strong style={{ color: "#fff" }}>BACK</strong> to restart the app.
        </p>

        <div
          style={{
            background: "#151515",
            borderLeft: "6px solid #e50914",
            padding: "24px",
            fontSize: "22px",
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {message}
        </div>

        {stack && (
          <pre
            style={{
              marginTop: "24px",
              fontSize: "16px",
              lineHeight: 1.4,
              color: "#8a8a8a",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {stack}
          </pre>
        )}

        {componentStack && (
          <pre
            style={{
              marginTop: "16px",
              fontSize: "16px",
              lineHeight: 1.4,
              color: "#6a6a6a",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {componentStack}
          </pre>
        )}
      </div>
    );
  }
}
