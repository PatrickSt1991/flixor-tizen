import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { SmartImage } from './SmartImage';
import { scrollFocusedIntoView } from '../utils/tvScroll';

export interface EpisodeItemProps {
  title: string;
  episodeNumber: number;
  seasonNumber: number;
  thumbUrl?: string;
  duration?: number;
  summary?: string;
  watched?: boolean;
  onClick: () => void;
}

export function EpisodeItem({
  title,
  episodeNumber,
  seasonNumber,
  thumbUrl,
  duration,
  summary,
  watched,
  onClick,
}: EpisodeItemProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: onClick,
    onFocus: () => scrollFocusedIntoView(ref.current as HTMLElement | null),
  });

  const formattedDuration = duration ? `${Math.round(duration / 60000)}m` : null;

  return (
    <button
      ref={ref}
      className={`episode-card${focused ? ' spatial-focused' : ''}${watched ? ' watched' : ''}`}
      tabIndex={0}
      onClick={onClick}
    >
      <div className="episode-thumb-container">
        {thumbUrl ? (
          <SmartImage src={thumbUrl} alt={title} className="episode-thumb" />
        ) : (
          <div className="episode-thumb-placeholder" />
        )}
        <div className="episode-play-overlay">▶</div>
        {watched && <div className="episode-watched-indicator">✓</div>}
      </div>
      <div className="episode-info">
        <div className="episode-number">
          S{seasonNumber}:E{episodeNumber}
          {formattedDuration && <span className="episode-duration"> · {formattedDuration}</span>}
        </div>
        <div className="episode-title">{title}</div>
        {summary && <div className="episode-summary">{summary}</div>}
      </div>
    </button>
  );
}
