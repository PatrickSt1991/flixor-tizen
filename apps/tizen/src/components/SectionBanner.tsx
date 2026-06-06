import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface SectionBannerProps {
  title?: string;
  message: string;
  cta: string;
  to: string;
}

export function SectionBanner({ title, message, cta, to }: SectionBannerProps) {
  const navigate = useNavigate();

  const onEnterPress = useCallback(() => {
    navigate(to);
  }, [navigate, to]);

  const { ref, focused } = useFocusable({ onEnterPress });

  return (
    <section style={styles.section}>
      <div style={styles.band}>
        <div style={styles.inner}>
          <div style={styles.textBlock}>
            {title && <h3 style={styles.title}>{title}</h3>}
            <p style={styles.message}>{message}</p>
          </div>
          <div
            ref={ref}
            role="button"
            tabIndex={0}
            style={{
              ...styles.button,
              ...(focused ? styles.buttonFocused : undefined),
            }}
          >
            {cta}
          </div>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    paddingTop: 8,
    paddingBottom: 8,
    marginTop: 40,
    marginBottom: 40,
  },
  band: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  inner: {
    padding: '32px 40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBlock: {
    flex: 1,
    marginRight: 24,
  },
  title: {
    color: '#e5e5e5',
    fontSize: 24,
    fontWeight: 600,
    marginBottom: 6,
    margin: 0,
    marginBlockEnd: 6,
  },
  message: {
    color: '#a3a3a3',
    fontSize: 18,
    margin: 0,
  },
  button: {
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: 18,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    border: '3px solid transparent',
    cursor: 'pointer',
  },
  buttonFocused: {
    borderColor: '#ffffff',
    boxShadow: '0 0 12px rgba(255, 255, 255, 0.5)',
  },
};
