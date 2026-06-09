import { useEffect, type ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { scrollFocusedIntoView } from "../utils/tvScroll";

/**
 * A norigin-focusable <button> for TV. Plain <button autoFocus> does NOT work
 * with spatial navigation — norigin uses virtual focus, never calls
 * element.focus(), so a plain button is invisible to the D-pad and OK never
 * fires its onClick. Use this anywhere a button must be reachable by the remote.
 *
 * `focusOnMount` sets initial focus (replaces the desktop `autoFocus`); the
 * button scrolls itself into view on focus.
 */
export function FocusableButton({
  className = "",
  onClick,
  focusKey,
  focusOnMount,
  children,
}: {
  className?: string;
  onClick: () => void;
  focusKey?: string;
  focusOnMount?: boolean;
  children: ReactNode;
}) {
  const { ref, focused, focusSelf } = useFocusable({
    focusKey,
    onEnterPress: onClick,
    onFocus: () => scrollFocusedIntoView(ref.current as HTMLElement | null),
  });

  useEffect(() => {
    if (focusOnMount) focusSelf();
  }, [focusOnMount, focusSelf]);

  return (
    <button
      ref={ref}
      className={`${className}${focused ? " focused" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
