import { useEffect, useState } from "react";

/**
 * TEMPORARY on-screen input diagnostic (retail Tizen sets have no dev console).
 *
 * Logs every key/pointer/click event to a fixed HUD so we can see, on a real
 * TV, whether input events even arrive and — for clicks — what element is
 * actually at the click point (document.elementFromPoint). If clicks land on
 * something other than the intended <button>, an overlay is intercepting them;
 * if no pointer events fire at all, it is a WebView/coordinate problem.
 *
 * The HUD is pointer-events:none so it can NEVER swallow input itself.
 * Toggle with the RED colour key (keyCode 403) or "d". REMOVE before merge.
 */

interface Entry {
  n: number;
  text: string;
}

function describe(el: Element | null): string {
  if (!el) return "null";
  const tag = el.tagName ? el.tagName.toLowerCase() : "?";
  const cls =
    typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  const id = el.id ? "#" + el.id : "";
  return tag + id + cls;
}

export function InputDiagnosticOverlay() {
  const [visible, setVisible] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    let counter = 0;
    const push = (text: string) => {
      counter += 1;
      const n = counter;
      setEntries((prev) => [{ n, text }, ...prev].slice(0, 16));
    };

    const onKey = (e: KeyboardEvent) => {
      const kc = e.keyCode || e.which;
      if (kc === 403 || e.key === "d" || e.key === "D") {
        setVisible((v) => !v);
      }
      push(`KEY ${kc} "${e.key}" @${describe(e.target as Element)}`);
    };

    const logPointer = (type: string) => (e: MouseEvent | PointerEvent) => {
      const x = Math.round(e.clientX);
      const y = Math.round(e.clientY);
      const hit = describe(document.elementFromPoint(x, y));
      push(`${type} (${x},${y}) tgt=${describe(e.target as Element)} top=${hit}`);
    };

    const onPointerDown = logPointer("PDOWN");
    const onMouseDown = logPointer("MDOWN");
    const onClick = logPointer("CLICK");

    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("mousedown", onMouseDown, { capture: true });
    window.addEventListener("click", onClick, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
      window.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        maxWidth: "900px",
        maxHeight: "60vh",
        overflow: "hidden",
        zIndex: 99999,
        background: "rgba(0, 0, 0, 0.82)",
        color: "#0f0",
        font: "18px/1.35 monospace",
        padding: "12px 16px",
        pointerEvents: "none",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div style={{ color: "#ff0", marginBottom: "6px" }}>
        INPUT DIAG — RED key or "d" to hide
      </div>
      {entries.map((en) => (
        <div key={en.n}>
          {en.n}. {en.text}
        </div>
      ))}
    </div>
  );
}
