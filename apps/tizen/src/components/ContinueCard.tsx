import type { PlexMediaItem } from "@flixor/core";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";
import { SmartImage } from "./SmartImage";
import { flixor } from "../services/flixor";
import { formatResumeLabel } from "../utils/media";
import { scrollFocusedIntoView } from "../utils/tvScroll";

export function ContinueCard({
  item,
  onClick,
  onFocus,
}: {
  item: PlexMediaItem;
  onClick: () => void;
  onFocus?: () => void;
}) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onClick(),
    onFocus: () => {
      scrollFocusedIntoView(ref.current as HTMLElement | null);
      onFocus?.();
    },
  });

  const thumb = item.thumb || item.art;
  const imgSrc = thumb ? flixor.plexServer.getImageUrl(thumb, 400) : "";
  const progress =
    item.viewOffset && item.duration
      ? Math.min(100, Math.round((item.viewOffset / item.duration) * 100))
      : 0;
  const resumeLabel =
    item.viewOffset && item.duration
      ? formatResumeLabel(item.viewOffset, item.duration)
      : null;

  return (
    <div className="tv-card-container landscape">
      <button
        ref={ref}
        className={`tv-card landscape${focused ? " spatial-focused" : ""}`}
        tabIndex={0}
        onClick={onClick}
      >
        <SmartImage src={imgSrc} alt={item.title} className="card-img-smart" />
        {resumeLabel && (
          <span className="continue-resume-label">{resumeLabel}</span>
        )}
        {progress > 0 && (
          <div className="card-progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
      </button>
      <div className={`tv-card-label${focused ? " spatial-focused" : ""}`}>
        {item.title}
      </div>
    </div>
  );
}
