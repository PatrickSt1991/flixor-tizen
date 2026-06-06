import { useState, useEffect, useCallback } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { init } from "@noriginmedia/norigin-spatial-navigation";
import { useTizenRemote } from "./hooks/useTizenRemote";
import { flixor } from "./services/flixor";
import { loadSettings } from "./services/settings";

// Pages
import { UpdateBanner } from "./components/UpdateBanner";
import { Home } from "./pages/Home";
import { LibraryPage } from "./pages/Library";
import { DetailsPage } from "./pages/Details";
import { PlayerPage } from "./pages/Player";
import { SearchPage } from "./pages/Search";
import { Login } from "./pages/Login";
import { SettingsPage } from "./pages/Settings";
import { MyListPage } from "./pages/MyList";
import { PersonPage } from "./pages/Person";
import { NewPopularPage } from "./pages/NewPopular";
import { Onboarding } from "./pages/Onboarding";
import { ServerSelect } from "./pages/ServerSelect";
import { ProfileSelect } from "./pages/ProfileSelect";
import { BrowsePage } from "./pages/Browse";
import { useToastState, ToastContext } from "./hooks/useToast";
import { ToastContainer } from "./components/Toast";

init({ debug: false, visualDebug: false });

type InitPhase = "loading" | "onboarding" | "login" | "server-select" | "profile-select" | "ready";

function AppRoutes() {
  useTizenRemote();
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<InitPhase>("loading");

  const runInitFlow = useCallback(async () => {
    // Step 1: Check onboarding
    const settings = loadSettings();
    if (!settings.onboardingCompleted) {
      setPhase("onboarding");
      navigate("/onboarding", { replace: true });
      return;
    }

    // Step 2: Check auth
    const authenticated = await flixor.initialize();
    if (!authenticated) {
      setPhase("login");
      return;
    }

    // Step 3: Server selection
    try {
      const servers = await flixor.getPlexServers();
      if (servers.length === 0) {
        // No servers — go to server select to show empty state
        setPhase("server-select");
        navigate("/server-select", { replace: true });
        return;
      }
      if (servers.length > 1) {
        setPhase("server-select");
        navigate("/server-select", { replace: true });
        return;
      }
      // Single server — auto-connect
      await flixor.connectToPlexServer(servers[0]);
    } catch {
      // Server fetch failed — let ServerSelect handle the error
      setPhase("server-select");
      navigate("/server-select", { replace: true });
      return;
    }

    // Step 4: Profile selection
    try {
      const users = await flixor.getHomeUsers();
      if (users.length > 1) {
        setPhase("profile-select");
        navigate("/profile-select", { replace: true });
        return;
      }
      // No Plex Home or single user — skip profile select
    } catch {
      // Profile fetch failed — skip, go to Home
    }

    // Step 5: Ready — go Home
    setPhase("ready");
    if (location.pathname === "/") {
      // Already at root, no need to navigate
    } else {
      navigate("/", { replace: true });
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    runInitFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setPhase("server-select");
    navigate("/server-select", { replace: true });
  }, [navigate]);

  if (phase === "loading") {
    return (
      <div
        className="tv-container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <h1 className="logo">FLIXOR</h1>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Init flow routes */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/login"
          element={<Login onLogin={handleLoginSuccess} />}
        />
        <Route path="/server-select" element={<ServerSelect />} />
        <Route path="/profile-select" element={<ProfileSelect />} />

        {/* Main app routes */}
        <Route
          path="/"
          element={
            phase === "login" ? (
              <Login onLogin={handleLoginSuccess} />
            ) : (
              <Home />
            )
          }
        />
        <Route path="/library/:type" element={<LibraryPage />} />
        <Route path="/details/:ratingKey" element={<DetailsPage />} />
        <Route path="/player/:ratingKey" element={<PlayerPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/mylist" element={<MyListPage />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/person" element={<PersonPage />} />
        <Route path="/new-popular" element={<NewPopularPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/browse/:source" element={<BrowsePage />} />
      </Routes>
      {phase === "ready" && <UpdateBanner />}
    </>
  );
}

function App() {
  const toastState = useToastState();

  // Apply performance-mode class to <body> based on settings
  useEffect(() => {
    const settings = loadSettings();
    if (settings.performanceModeEnabled) {
      document.body.classList.add("performance-mode");
    } else {
      document.body.classList.remove("performance-mode");
    }
  }, []);

  // Listen for storage changes so toggling the setting takes effect immediately
  useEffect(() => {
    const onStorage = () => {
      const settings = loadSettings();
      if (settings.performanceModeEnabled) {
        document.body.classList.add("performance-mode");
      } else {
        document.body.classList.remove("performance-mode");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ToastContext.Provider value={toastState}>
      <AppRoutes />
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export default App;
