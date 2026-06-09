import type { ReactNode } from 'react';
import { SmartImage } from './SmartImage';
import ContentRatingBadge from './ContentRatingBadge';

export interface DetailsHeroProps {
  title: string;
  year?: string | number;
  contentRating?: string;
  duration?: number;
  overview?: string;
  tagline?: string;
  backdropUrl?: string;
  posterUrl?: string;
  logoUrl?: string;
  techBadges?: string[];
  director?: string;
  writers?: string[];
  children?: ReactNode;
}

export function DetailsHero({
  title,
  year,
  contentRating,
  duration,
  overview,
  tagline,
  backdropUrl,
  posterUrl,
  logoUrl,
  techBadges = [],
  director,
  writers = [],
  children,
}: DetailsHeroProps) {
  const formattedDuration = duration ? `${Math.round(duration / 60000)}m` : null;

  return (
    <div className="details-hero">
      {backdropUrl && (
        <div className="details-hero__backdrop">
          <SmartImage src={backdropUrl} alt="" className="details-hero__backdrop-img" />
          <div className="backdrop-overlay" />
        </div>
      )}

      <div className="details-hero__content">
        {posterUrl && (
          <SmartImage
            src={posterUrl}
            alt={title}
            kind="poster"
            className="details-hero__poster"
          />
        )}

        <div className="details-hero__info">
          {logoUrl ? (
            <img src={logoUrl} alt={title} style={{ maxWidth: 400, maxHeight: 120, objectFit: 'contain' }} />
          ) : (
            <h1 className="details-title">{title}</h1>
          )}

          {techBadges.length > 0 && (
            <div className="tech-badges">
              {techBadges.map((badge) => (
                <span
                  key={badge}
                  className={`tech-badge ${badge.toLowerCase().replace(/\s/g, '-').replace(/^(\d)/, 'res-$1')}`}
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          <div className="hero-meta">
            {year && <span className="meta-badge">{year}</span>}
            {contentRating && <ContentRatingBadge rating={contentRating} size="md" />}
            {formattedDuration && <span className="meta-badge">{formattedDuration}</span>}
          </div>

          {tagline && <p className="details-tagline">&ldquo;{tagline}&rdquo;</p>}

          {overview && <p className="details-summary">{overview}</p>}

          {(director || writers.length > 0) && (
            <div className="details-crew">
              {director && <span className="crew-item">Director: {director}</span>}
              {writers.length > 0 && (
                <span className="crew-item">Writers: {writers.join(', ')}</span>
              )}
            </div>
          )}

          {/* Metadata (genres, mood tags, chips, badges, ratings) and the
              action-buttons row are passed as children. Stack them VERTICALLY
              — they were previously dumped into a flex ROW (.hero-actions),
              which crammed everything side-by-side and stretched the chip rows
              into tall grey blocks. The action buttons keep their own
              .hero-actions row inside this column. */}
          {children && <div className="details-hero__meta">{children}</div>}
        </div>
      </div>
    </div>
  );
}
