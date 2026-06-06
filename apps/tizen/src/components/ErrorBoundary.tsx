import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary. There is no usable inspector on retail Tizen sets,
 * so besides rendering a fallback UI it mirrors the error to the on-screen
 * #debug-overlay in index.html (the same overlay that catches pre-React
 * script/resource failures).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const el = document.getElementById("debug-overlay");
    if (el) {
      el.style.display = "block";
      const p = document.createElement("p");
      p.textContent =
        "React error: " +
        (error.stack || error.message || String(error)) +
        (info.componentStack || "");
      el.appendChild(p);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            background: "#050505",
            color: "white",
            textAlign: "center",
            padding: "40px",
            boxSizing: "border-box",
          }}
        >
          <h1 className="logo">FLIXOR</h1>
          <p style={{ fontSize: "28px", margin: "20px 0" }}>
            Something went wrong.
          </p>
          <pre
            style={{
              fontFamily: "monospace",
              fontSize: "18px",
              color: "#ff6b6b",
              maxWidth: "80vw",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ fontSize: "20px", opacity: 0.7 }}>
            Press EXIT and relaunch the app.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
