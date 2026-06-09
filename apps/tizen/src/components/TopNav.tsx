import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { UserAvatar } from "./UserAvatar";
import { flixor } from "../services/flixor";

interface NavButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
  focusKey: string;
}

function NavButton({ label, active, onPress, focusKey }: NavButtonProps) {
  const { ref, focused } = useFocusable({ focusKey, onEnterPress: onPress });

  return (
    <button
      ref={ref}
      className={`nav-item${active ? " active" : ""}${focused ? " spatial-focused" : ""}`}
      tabIndex={0}
      onClick={onPress}
    >
      {label}
    </button>
  );
}

export function TopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const [userName, setUserName] = useState(
    () => flixor.currentProfile?.title || "User",
  );
  const [userThumb, setUserThumb] = useState(
    () => flixor.currentProfile?.thumb,
  );

  // Which nav item is active for the current route — so entering the nav from
  // below lands on it (e.g. up from the Shows grid → "Shows", not "Home").
  const activeNavKey =
    currentPath.includes("/library/movie")
      ? "nav-movies"
      : currentPath.includes("/library/show")
        ? "nav-shows"
        : currentPath === "/mylist"
          ? "nav-mylist"
          : currentPath === "/new-popular"
            ? "nav-newpopular"
            : currentPath === "/search"
              ? "nav-search"
              : currentPath === "/settings"
                ? "nav-settings"
                : "nav-home";

  const { ref: navRef, focusKey } = useFocusable({
    focusKey: "top-nav",
    trackChildren: true,
    // When focus enters the nav, prefer the active item over the first child.
    preferredChildFocusKey: activeNavKey,
    // Left/right cycle the menu only; Down leaves toward the page content.
    isFocusBoundary: true,
    focusBoundaryDirections: ["left", "right"],
  });

  useEffect(() => {
    if (flixor.currentProfile) return;

    flixor
      .getHomeUsers()
      .then((users) => {
        if (users.length > 0) {
          const admin = users.find((u) => u.admin) || users[0];
          setUserName(admin.title);
          setUserThumb(admin.thumb);
        }
      })
      .catch(() => {
        // Silently keep defaults
      });
  }, []);

  const handleAvatarPress = useCallback(() => {
    navigate("/profile-select");
  }, [navigate]);

  return (
    <FocusContext.Provider value={focusKey}>
    <nav ref={navRef} className="tv-nav">
      <h1 className="logo">FLIXOR</h1>
      <div className="nav-items">
        <NavButton
          label="Home"
          focusKey="nav-home"
          active={currentPath === "/"}
          onPress={() => navigate("/")}
        />
        <NavButton
          label="My List"
          focusKey="nav-mylist"
          active={currentPath === "/mylist"}
          onPress={() => navigate("/mylist")}
        />
        <NavButton
          label="New & Popular"
          focusKey="nav-newpopular"
          active={currentPath === "/new-popular"}
          onPress={() => navigate("/new-popular")}
        />
        <NavButton
          label="Movies"
          focusKey="nav-movies"
          active={currentPath.includes("/library/movie")}
          onPress={() => navigate("/library/movie")}
        />
        <NavButton
          label="Shows"
          focusKey="nav-shows"
          active={currentPath.includes("/library/show")}
          onPress={() => navigate("/library/show")}
        />
        <NavButton
          label="Search"
          focusKey="nav-search"
          active={currentPath === "/search"}
          onPress={() => navigate("/search")}
        />
        <NavButton
          label="⚙ Settings"
          focusKey="nav-settings"
          active={currentPath === "/settings"}
          onPress={() => navigate("/settings")}
        />
      </div>
      <div className="nav-user">
        <UserAvatar
          thumb={userThumb}
          title={userName}
          onPress={handleAvatarPress}
        />
      </div>
    </nav>
    </FocusContext.Provider>
  );
}
