/**
 * ServiceIcons — Horizontal row of streaming service availability icons.
 *
 * Displays provider logos (Netflix, Disney+, etc.) from TMDB watch providers data.
 * Purely presentational — data fetching is handled by the parent.
 */

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface ServiceIconsProps {
  providers: WatchProvider[] | undefined | null;
  maxIcons?: number;
}

export default function ServiceIcons({ providers, maxIcons = 6 }: ServiceIconsProps) {
  if (!providers?.length) return null;

  const visible = providers.slice(0, maxIcons);

  return (
    <div style={styles.row}>
      {visible.map((p) => (
        <img
          key={p.provider_id}
          src={`${TMDB_LOGO_BASE}${p.logo_path}`}
          alt={p.provider_name}
          title={p.provider_name}
          style={styles.icon}
          loading="lazy"
        />
      ))}
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    margin: '0 -8px -8px 0',
  },
  icon: {
    margin: '0 8px 8px 0',
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover' as const,
    background: 'rgba(255,255,255,0.08)',
  },
} as const;
