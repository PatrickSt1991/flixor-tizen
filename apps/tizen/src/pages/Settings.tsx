import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { flixor } from "../services/flixor";
import { loadSettings, saveSettings, setDiscoveryDisabled, type TizenSettings } from "../services/settings";
import { TopNav } from "../components/TopNav";
import { SettingsCard } from "../components/SettingsCard";
import { SettingItem } from "../components/SettingItem";
import { HomeScreenSettings } from "../components/settings/HomeScreenSettings";
import { PlaybackSettings } from "../components/settings/PlaybackSettings";
import { IntegrationSettings } from "../components/settings/IntegrationSettings";
import { AppearanceSettings } from "../components/settings/AppearanceSettings";
import { CatalogSettings } from "../components/settings/CatalogSettings";
import { ContinueWatchingSettings } from "../components/settings/ContinueWatchingSettings";
import { DetailsScreenSettings } from "../components/settings/DetailsScreenSettings";
import { PlexSettings } from "../components/settings/PlexSettings";
import { TraktSettings } from "../components/settings/TraktSettings";
import { TMDBSettings } from "../components/settings/TMDBSettings";
import { MDBListSettings } from "../components/settings/MDBListSettings";
import { OverseerrSettings } from "../components/settings/OverseerrSettings";
import { PerformanceSettings } from "../components/settings/PerformanceSettings";

type SettingsScreen = "main" | "homeScreen" | "playback" | "integrations" | "appearance"
  | "catalog" | "continueWatching" | "detailsScreen" | "plex" | "trakt" | "tmdb" | "mdblist" | "overseerr" | "performance";

interface MenuItem {
  key: SettingsScreen;
  label: string;
}

const SUB_SCREENS: MenuItem[] = [
  { key: "homeScreen", label: "Home Screen" },
  { key: "catalog", label: "Catalog" },
  { key: "continueWatching", label: "Continue Watching" },
  { key: "detailsScreen", label: "Details Screen" },
  { key: "playback", label: "Playback" },
  { key: "appearance", label: "Appearance" },
  { key: "plex", label: "Plex" },
  { key: "trakt", label: "Trakt" },
  { key: "tmdb", label: "TMDB" },
  { key: "mdblist", label: "MDBList" },
  { key: "overseerr", label: "Overseerr" },
  { key: "integrations", label: "Integrations" },
  { key: "performance", label: "Performance" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [traktAuth, setTraktAuth] = useState(flixor.trakt.isAuthenticated());
  const [traktPin, setTraktPin] = useState<{ user_code: string; verification_url: string } | null>(null);
  const [loadingTrakt, setLoadingTrakt] = useState(false);
  const [settings, setSettings] = useState<TizenSettings>(loadSettings);
  const [screen, setScreen] = useState<SettingsScreen>("main");

  const { ref: pageRef, focusKey: pageFocusKey, focusSelf } = useFocusable({ trackChildren: true });

  const updateSetting = useCallback(<K extends keyof TizenSettings>(key: K, value: TizenSettings[K]) => {
    const next = saveSettings({ [key]: value });
    setSettings(next);

    // Sync performance-mode class on body immediately
    if (key === "performanceModeEnabled") {
      if (value) {
        document.body.classList.add("performance-mode");
      } else {
        document.body.classList.remove("performance-mode");
      }
    }
  }, []);

  const handleDiscoveryToggle = useCallback((disabled: boolean) => {
    setDiscoveryDisabled(disabled);
    setSettings(loadSettings());
  }, []);

  const handleLogout = useCallback(async () => {
    await flixor.signOutPlex();
    globalThis.location.href = "/";
  }, []);

  const handleTraktLogin = useCallback(async () => {
    setLoadingTrakt(true);
    try {
      const code = await flixor.trakt.generateDeviceCode();
      setTraktPin(code);
      const tokens = await flixor.trakt.waitForDeviceCode(code, {
        onPoll: () => console.log("Polling Trakt..."),
      });
      if (tokens) {
        setTraktAuth(true);
        setTraktPin(null);
      }
    } catch (err) {
      console.error("Trakt login failed:", err);
    } finally {
      setLoadingTrakt(false);
    }
  }, []);

  const handleTraktSignOut = useCallback(async () => {
    await flixor.trakt.signOut();
    setTraktAuth(false);
  }, []);

  const handleClearCache = useCallback(async () => {
    await flixor.clearAllCaches();
    alert("All caches cleared.");
  }, []);

  // Back key: sub-screen → main, main → previous page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "XF86Back" || e.key === "Backspace" || e.key === "GoBack") {
        e.preventDefault();
        if (screen !== "main") {
          setScreen("main");
        } else {
          navigate(-1);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, navigate]);

  // Focus the page on mount so D-PAD navigation works
  useEffect(() => {
    const timer = setTimeout(() => focusSelf(), 100);
    return () => clearTimeout(timer);
  }, [focusSelf]);

  // Render sub-screen content
  if (screen !== "main") {
    return (
      <FocusContext.Provider value={pageFocusKey}>
        <div ref={pageRef} className="tv-container pt-nav">
          <TopNav />
          <div className="settings-content">
            <BackButton onBack={() => setScreen("main")} />
            <h1 className="settings-title">
              {SUB_SCREENS.find((s) => s.key === screen)?.label}
            </h1>
            {screen === "homeScreen" && (
              <HomeScreenSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "playback" && (
              <PlaybackSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "integrations" && (
              <IntegrationSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "appearance" && (
              <AppearanceSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "catalog" && (
              <CatalogSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "continueWatching" && (
              <ContinueWatchingSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "detailsScreen" && (
              <DetailsScreenSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "plex" && (
              <PlexSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "trakt" && (
              <TraktSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "tmdb" && (
              <TMDBSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "mdblist" && (
              <MDBListSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "overseerr" && (
              <OverseerrSettings settings={settings} onChange={updateSetting} />
            )}
            {screen === "performance" && (
              <PerformanceSettings settings={settings} onChange={updateSetting} />
            )}
          </div>
        </div>
      </FocusContext.Provider>
    );
  }

  // Main settings screen
  return (
    <FocusContext.Provider value={pageFocusKey}>
      <div ref={pageRef} className="tv-container pt-nav">
        <TopNav />
        <div className="settings-content">
          <h1 className="settings-title">Settings</h1>

          {/* Plex Account */}
          <SettingsCard title="Plex Account">
            <SettingItem
              label="Server"
              description={flixor.server?.name || "None"}
              control={{ type: "button", buttonLabel: "Sign Out", onPress: handleLogout }}
            />
            <SettingItem
              label="Switch Profile"
              control={{ type: "button", buttonLabel: "Select ›", onPress: () => navigate("/profile-select") }}
            />
            <SettingItem
              label="Ask for profile at startup"
              description="Show Who's Watching (and PIN) on every launch instead of restoring the last profile"
              control={{
                type: "toggle",
                checked: !!settings.alwaysAskProfile,
                onChange: (v) => updateSetting("alwaysAskProfile", v),
              }}
            />
          </SettingsCard>

          {/* Trakt Integration */}
          <SettingsCard title="Trakt Integration">
            {traktAuth ? (
              <>
                <SettingItem
                  label="Status"
                  description="Connected"
                  control={{ type: "button", buttonLabel: "Sign Out", onPress: handleTraktSignOut }}
                />
              </>
            ) : traktPin ? (
              <div className="trakt-pin-box">
                <p>Go to <strong>{traktPin.verification_url}</strong> and enter:</p>
                <div className="pin-display small">{traktPin.user_code}</div>
              </div>
            ) : (
              <SettingItem
                label="Status"
                description="Not Connected"
                control={{
                  type: "button",
                  buttonLabel: loadingTrakt ? "Initializing..." : "Link Trakt Account",
                  onPress: handleTraktLogin,
                }}
                disabled={loadingTrakt}
              />
            )}
          </SettingsCard>

          {/* Discovery */}
          <SettingsCard title="Discovery">
            <SettingItem
              label="Library Only Mode"
              description="Disable all external content sources"
              control={{
                type: "toggle",
                checked: settings.discoveryDisabled === true,
                onChange: handleDiscoveryToggle,
              }}
            />
            <SettingItem
              label="Include TMDB in Search"
              description="Show TMDB results alongside Plex library search"
              control={{
                type: "toggle",
                checked: settings.includeTmdbInSearch !== false && !settings.discoveryDisabled,
                onChange: (v) => updateSetting("includeTmdbInSearch", v),
              }}
              disabled={settings.discoveryDisabled}
            />
          </SettingsCard>

          {/* Sub-screen navigation */}
          <SettingsCard title="Content & Display">
            {SUB_SCREENS.map((item) => (
              <NavItem key={item.key} label={item.label} onPress={() => setScreen(item.key)} />
            ))}
          </SettingsCard>

          {/* Cache */}
          <SettingsCard title="Cache">
            <SettingItem
              label="Clear All Caches"
              description="Remove cached data from all services"
              control={{ type: "button", buttonLabel: "Clear", onPress: handleClearCache }}
            />
          </SettingsCard>

          {/* Support the Tizen port */}
          <SettingsCard title="Support the Tizen Port">
            <div className="support-card">
              <img
                className="support-qr"
                src={`${import.meta.env.BASE_URL}ko-fi-qr.webp`}
                alt="Ko-fi donation QR code"
              />
              <div className="support-text">
                <p className="support-lead">Enjoying Flixor on your TV?</p>
                <p className="support-sub">
                  Scan the code to support the Samsung Tizen port on Ko-fi.
                  Flixor itself is by the upstream Flixor project — this only
                  helps with the TV port.
                </p>
              </div>
            </div>
          </SettingsCard>

          {/* About */}
          <SettingsCard title="About">
            <SettingItem
              label="Version"
              description="1.0.0-tizen"
              control={{ type: "button", buttonLabel: "", onPress: () => {} }}
            />
            <SettingItem
              label="Platform"
              description="Tizen OS"
              control={{ type: "button", buttonLabel: "", onPress: () => {} }}
            />
          </SettingsCard>
        </div>
      </div>
    </FocusContext.Provider>
  );
}


function NavItem({ label, onPress }: { label: string; onPress: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress });

  return (
    <button
      ref={ref}
      className={`setting-item setting-item-button${focused ? " spatial-focused" : ""}`}
      tabIndex={0}
      onClick={onPress}
    >
      <div className="setting-item-text">
        <span className="setting-item-label">{label}</span>
      </div>
      <span className="setting-item-action">›</span>
    </button>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const { ref, focused } = useFocusable({ onEnterPress: onBack });

  return (
    <button
      ref={ref}
      className={`btn-back${focused ? " spatial-focused" : ""}`}
      tabIndex={0}
      onClick={onBack}
    >
      ← Back
    </button>
  );
}
