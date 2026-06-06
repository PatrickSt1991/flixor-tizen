import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  useFocusable,
  FocusContext,
} from "@noriginmedia/norigin-spatial-navigation";
import {
  loadSettings,
  saveSettings,
  setDiscoveryDisabled,
} from "../services/settings";

const TOTAL_SLIDES = 4;

// ── Slide icons (inline SVG paths for zero-dependency illustrations) ───

const ICONS: Record<string, React.ReactNode> = {
  welcome: (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="38" stroke="#e50914" strokeWidth="3" />
      <polygon points="32,24 60,40 32,56" fill="#e50914" />
    </svg>
  ),
  discovery: (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="34" cy="34" r="20" stroke="#e5e5e5" strokeWidth="3" />
      <line
        x1="48"
        y1="48"
        x2="68"
        y2="68"
        stroke="#e5e5e5"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  ),
  library: (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="10"
        y="16"
        width="18"
        height="48"
        rx="3"
        stroke="#e5e5e5"
        strokeWidth="3"
      />
      <rect
        x="32"
        y="10"
        width="18"
        height="54"
        rx="3"
        stroke="#e5e5e5"
        strokeWidth="3"
      />
      <rect
        x="54"
        y="20"
        width="18"
        height="44"
        rx="3"
        stroke="#e5e5e5"
        strokeWidth="3"
      />
    </svg>
  ),
  config: (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="40" cy="40" r="14" stroke="#e5e5e5" strokeWidth="3" />
      <circle cx="40" cy="40" r="6" fill="#e5e5e5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="40"
          y1="12"
          x2="40"
          y2="20"
          stroke="#e5e5e5"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${deg} 40 40)`}
        />
      ))}
    </svg>
  ),
};

// ── Slide background gradients ─────────────────────────────────────────

const SLIDE_BACKGROUNDS: string[] = [
  "radial-gradient(ellipse at 50% 30%, rgba(229,9,20,0.15) 0%, transparent 70%)",
  "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)",
  "radial-gradient(ellipse at 70% 50%, rgba(168,85,247,0.12) 0%, transparent 70%)",
  "radial-gradient(ellipse at 50% 60%, rgba(34,197,94,0.12) 0%, transparent 70%)",
];

// ── Toggle descriptions ────────────────────────────────────────────────

const TOGGLE_DESCRIPTIONS: Record<string, string> = {
  "Library Only Mode":
    "Only show your Plex library content, hide all external sources.",
  "Show Trending Rows":
    "Display trending movies and shows from TMDB on the home screen.",
  "Show Trakt Rows":
    "Show your Trakt watchlist, recommendations, and trending content.",
  "Include TMDB in Search":
    "Include TMDB results alongside Plex when searching.",
};

// ── OnboardingToggle ───────────────────────────────────────────────────

interface ToggleItemProps {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (val: boolean) => void;
}

function OnboardingToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleItemProps) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => {
      if (!disabled) onChange(!checked);
    },
  });

  const isOn = checked && !disabled;

  return (
    <div
      ref={ref}
      role="switch"
      aria-checked={isOn}
      aria-disabled={disabled}
      tabIndex={0}
      style={{
        ...toggleStyles.item,
        ...(focused ? toggleStyles.itemFocused : undefined),
        ...(disabled ? toggleStyles.itemDisabled : undefined),
      }}
    >
      <div style={toggleStyles.labelBlock}>
        <span
          style={{
            ...toggleStyles.label,
            ...(disabled ? toggleStyles.labelDisabled : undefined),
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              ...toggleStyles.description,
              ...(disabled ? toggleStyles.descDisabled : undefined),
            }}
          >
            {description}
          </span>
        )}
      </div>
      <span
        style={{
          ...toggleStyles.indicator,
          ...(isOn ? toggleStyles.indicatorOn : toggleStyles.indicatorOff),
        }}
      >
        {isOn ? "ON" : "OFF"}
      </span>
    </div>
  );
}

const toggleStyles = {
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    padding: "14px 20px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s ease",
  } as React.CSSProperties,
  itemFocused: {
    borderColor: "#e50914",
    background: "rgba(229,9,20,0.08)",
    transform: "scale(1.02)",
  } as React.CSSProperties,
  itemDisabled: {
    opacity: 0.4,
    cursor: "default",
  } as React.CSSProperties,
  labelBlock: {
    display: "grid",
    gap: 4,
    flex: 1,
  } as React.CSSProperties,
  label: {
    fontSize: 22,
    fontWeight: 600,
    color: "#e5e5e5",
  } as React.CSSProperties,
  labelDisabled: {
    textDecoration: "line-through",
    color: "rgba(255,255,255,0.35)",
  } as React.CSSProperties,
  description: {
    fontSize: 16,
    color: "rgba(255,255,255,0.45)",
  } as React.CSSProperties,
  descDisabled: {
    color: "rgba(255,255,255,0.2)",
  } as React.CSSProperties,
  indicator: {
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 700,
    flexShrink: 0,
    marginLeft: 16,
  } as React.CSSProperties,
  indicatorOn: {
    background: "#16a34a",
    color: "#ffffff",
  } as React.CSSProperties,
  indicatorOff: {
    background: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.4)",
  } as React.CSSProperties,
} as const;

// ── NavButton ──────────────────────────────────────────────────────────

const NavButton = forwardRef<
  HTMLButtonElement,
  {
    label: string;
    variant: "primary" | "secondary";
    onClick: () => void;
  }
>(function NavButton({ label, variant, onClick }, fwdRef) {
  const { ref, focused } = useFocusable({ onEnterPress: onClick });

  useImperativeHandle(fwdRef, () => ref.current as HTMLButtonElement);

  return (
    <button
      ref={ref}
      style={{
        ...navBtnStyles.base,
        ...(variant === "primary"
          ? navBtnStyles.primary
          : navBtnStyles.secondary),
        ...(focused ? navBtnStyles.focused : undefined),
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
});

const navBtnStyles = {
  base: {
    padding: "16px 40px",
    fontSize: 22,
    fontWeight: 700,
    borderRadius: 10,
    border: "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    outline: "none",
  } as React.CSSProperties,
  primary: {
    background: "#ffffff",
    color: "#000000",
  } as React.CSSProperties,
  secondary: {
    background: "rgba(255,255,255,0.08)",
    color: "#e5e5e5",
    borderColor: "rgba(255,255,255,0.15)",
  } as React.CSSProperties,
  focused: {
    transform: "scale(1.1)",
    boxShadow: "0 0 0 4px #e50914",
    borderColor: "#e50914",
  } as React.CSSProperties,
} as const;

// ── Main Onboarding Component ──────────────────────────────────────────

export function Onboarding() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">(
    "right",
  );

  const initial = loadSettings();
  const [libraryOnlyMode, setLibraryOnlyMode] = useState(
    initial.libraryOnlyMode ?? false,
  );
  const [showTrendingRows, setShowTrendingRows] = useState(
    initial.showTrendingRows ?? true,
  );
  const [showTraktRows, setShowTraktRows] = useState(
    initial.showTraktRows ?? true,
  );
  const [includeTmdbInSearch, setIncludeTmdbInSearch] = useState(
    initial.includeTmdbInSearch ?? true,
  );

  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  const {
    ref: containerRef,
    focusKey: containerFocusKey,
    focusSelf,
  } = useFocusable({
    trackChildren: true,
    isFocusBoundary: true,
    onArrowPress: (direction) => {
      // D-PAD left/right for slide navigation (task 13.4)
      // Only intercept when NOT on the config slide's toggles
      if (currentSlide !== 3) {
        if (direction === "left" && currentSlide > 0) {
          prevSlide();
          return false;
        }
        if (direction === "right" && currentSlide < TOTAL_SLIDES - 1) {
          nextSlide();
          return false;
        }
      }
      return true; // allow normal spatial nav
    },
  });

  // Auto-focus primary action when slide changes (task 13.3 fix: use focusSelf)
  useEffect(() => {
    const timer = setTimeout(() => {
      focusSelf();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentSlide, focusSelf]);

  const handleLibraryOnlyToggle = useCallback((val: boolean) => {
    setLibraryOnlyMode(val);
    if (val) {
      setShowTrendingRows(false);
      setShowTraktRows(false);
      setIncludeTmdbInSearch(false);
      setDiscoveryDisabled(true);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    saveSettings({
      libraryOnlyMode,
      showTrendingRows,
      showTraktRows,
      includeTmdbInSearch,
      onboardingCompleted: true,
    });
    navigate("/login");
  }, [
    libraryOnlyMode,
    showTrendingRows,
    showTraktRows,
    includeTmdbInSearch,
    navigate,
  ]);

  const skipOnboarding = useCallback(() => {
    saveSettings({ onboardingCompleted: true });
    navigate("/login");
  }, [navigate]);

  const nextSlide = useCallback(() => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setSlideDirection("right");
      setCurrentSlide((s) => s + 1);
    }
  }, [currentSlide]);

  const prevSlide = useCallback(() => {
    if (currentSlide > 0) {
      setSlideDirection("left");
      setCurrentSlide((s) => s - 1);
    }
  }, [currentSlide]);

  const isLastSlide = currentSlide === TOTAL_SLIDES - 1;

  return (
    <FocusContext.Provider value={containerFocusKey}>
      <div
        ref={containerRef}
        style={{
          ...pageStyles.container,
          backgroundImage: SLIDE_BACKGROUNDS[currentSlide],
        }}
      >
        {/* Slide content with transition (task 13.2) */}
        <div
          key={currentSlide}
          style={{
            ...pageStyles.slideWrapper,
            animation: `${slideDirection === "right" ? "slideInRight" : "slideInLeft"} 0.35s ease-out`,
          }}
        >
          {currentSlide === 0 && <SlideWelcome />}
          {currentSlide === 1 && <SlideDiscovery />}
          {currentSlide === 2 && <SlideLibrary />}
          {currentSlide === 3 && (
            <SlideConfiguration
              libraryOnlyMode={libraryOnlyMode}
              showTrendingRows={showTrendingRows}
              showTraktRows={showTraktRows}
              includeTmdbInSearch={includeTmdbInSearch}
              onLibraryOnlyChange={handleLibraryOnlyToggle}
              onTrendingChange={setShowTrendingRows}
              onTraktChange={setShowTraktRows}
              onTmdbSearchChange={setIncludeTmdbInSearch}
            />
          )}
        </div>

        {/* Dot indicators (task 13.2) */}
        <div style={pageStyles.dots}>
          {Array.from({ length: TOTAL_SLIDES }, (_, i) => (
            <span
              key={i}
              style={{
                ...pageStyles.dot,
                ...(i === currentSlide ? pageStyles.dotActive : undefined),
              }}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div style={pageStyles.actions}>
          {currentSlide > 0 && (
            <NavButton label="Back" variant="secondary" onClick={prevSlide} />
          )}
          <NavButton
            label="Skip"
            variant="secondary"
            onClick={skipOnboarding}
          />
          {isLastSlide ? (
            <NavButton
              ref={primaryBtnRef}
              label="Get Started"
              variant="primary"
              onClick={completeOnboarding}
            />
          ) : (
            <NavButton
              ref={primaryBtnRef}
              label="Next"
              variant="primary"
              onClick={nextSlide}
            />
          )}
        </div>
      </div>
    </FocusContext.Provider>
  );
}

// ── Page styles ────────────────────────────────────────────────────────

const pageStyles = {
  container: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    overflow: "hidden",
    position: "relative" as const,
    transition: "background-image 0.5s ease",
  } as React.CSSProperties,
  slideWrapper: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as const,
    maxWidth: 720,
    padding: "0 40px",
    flex: 1,
  } as React.CSSProperties,
  dots: {
    display: "grid",
    gridAutoFlow: "column",
    justifyContent: "start",
    gap: 12,
    marginBottom: 32,
  } as React.CSSProperties,
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.2)",
    transition: "all 0.3s ease",
  } as React.CSSProperties,
  dotActive: {
    background: "#e50914",
    transform: "scale(1.3)",
    boxShadow: "0 0 8px rgba(229,9,20,0.5)",
  } as React.CSSProperties,
  actions: {
    display: "grid",
    gridAutoFlow: "column",
    justifyContent: "center",
    gap: 20,
    paddingBottom: 60,
  } as React.CSSProperties,
} as const;

// ── Slide content styles ───────────────────────────────────────────────

const slideStyles = {
  icon: {
    marginBottom: 24,
  } as React.CSSProperties,
  logo: {
    fontSize: 56,
    fontWeight: 900,
    color: "#e50914",
    letterSpacing: 6,
    marginBottom: 16,
  } as React.CSSProperties,
  heading: {
    fontSize: 48,
    fontWeight: 700,
    color: "#ffffff",
    margin: "0 0 16px",
  } as React.CSSProperties,
  body: {
    fontSize: 24,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 1.5,
    margin: 0,
    maxWidth: 600,
  } as React.CSSProperties,
  toggleGroup: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: 560,
    marginTop: 24,
  } as React.CSSProperties,
  toggleLabel: {
    fontSize: 18,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 4,
  } as React.CSSProperties,
} as const;

// ── CSS keyframes (injected once) ──────────────────────────────────────

const KEYFRAMES_ID = "onboarding-keyframes";
if (typeof document !== "undefined" && !document.getElementById(KEYFRAMES_ID)) {
  const style = document.createElement("style");
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes slideInRight {
      from { opacity: 0; transform: translateX(60px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideInLeft {
      from { opacity: 0; transform: translateX(-60px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

// ── Slide content components ───────────────────────────────────────────

function SlideWelcome() {
  return (
    <>
      <div style={slideStyles.icon}>{ICONS.welcome}</div>
      <h1 style={slideStyles.logo}>FLIXOR</h1>
      <h2 style={slideStyles.heading}>Welcome to Flixor</h2>
      <p style={slideStyles.body}>
        Your all-in-one media companion. Flixor integrates with Trakt, TMDB,
        MDBList, and Overseerr to give you the best streaming experience on your
        Samsung TV.
      </p>
    </>
  );
}

function SlideDiscovery() {
  return (
    <>
      <div style={slideStyles.icon}>{ICONS.discovery}</div>
      <h2 style={slideStyles.heading}>Discover New Content</h2>
      <p style={slideStyles.body}>
        Browse trending movies and shows, get personalized recommendations, and
        explore rich metadata from TMDB — all without leaving your couch.
      </p>
    </>
  );
}

function SlideLibrary() {
  return (
    <>
      <div style={slideStyles.icon}>{ICONS.library}</div>
      <h2 style={slideStyles.heading}>Your Plex Library</h2>
      <p style={slideStyles.body}>
        Browse your full Plex library, continue watching where you left off, and
        explore your collections — all optimized for your TV remote.
      </p>
    </>
  );
}

interface ConfigSlideProps {
  libraryOnlyMode: boolean;
  showTrendingRows: boolean;
  showTraktRows: boolean;
  includeTmdbInSearch: boolean;
  onLibraryOnlyChange: (val: boolean) => void;
  onTrendingChange: (val: boolean) => void;
  onTraktChange: (val: boolean) => void;
  onTmdbSearchChange: (val: boolean) => void;
}

function SlideConfiguration({
  libraryOnlyMode,
  showTrendingRows,
  showTraktRows,
  includeTmdbInSearch,
  onLibraryOnlyChange,
  onTrendingChange,
  onTraktChange,
  onTmdbSearchChange,
}: ConfigSlideProps) {
  return (
    <>
      <div style={slideStyles.icon}>{ICONS.config}</div>
      <h2 style={slideStyles.heading}>Configure Your Experience</h2>
      <p style={slideStyles.body}>
        Choose which features to enable. You can change these later in Settings.
      </p>
      <div style={slideStyles.toggleGroup}>
        <span style={slideStyles.toggleLabel}>Features</span>
        <OnboardingToggle
          label="Library Only Mode"
          description={TOGGLE_DESCRIPTIONS["Library Only Mode"]}
          checked={libraryOnlyMode}
          onChange={onLibraryOnlyChange}
        />
        <OnboardingToggle
          label="Show Trending Rows"
          description={TOGGLE_DESCRIPTIONS["Show Trending Rows"]}
          checked={showTrendingRows}
          disabled={libraryOnlyMode}
          onChange={onTrendingChange}
        />
        <OnboardingToggle
          label="Show Trakt Rows"
          description={TOGGLE_DESCRIPTIONS["Show Trakt Rows"]}
          checked={showTraktRows}
          disabled={libraryOnlyMode}
          onChange={onTraktChange}
        />
        <OnboardingToggle
          label="Include TMDB in Search"
          description={TOGGLE_DESCRIPTIONS["Include TMDB in Search"]}
          checked={includeTmdbInSearch}
          disabled={libraryOnlyMode}
          onChange={onTmdbSearchChange}
        />
      </div>
    </>
  );
}
