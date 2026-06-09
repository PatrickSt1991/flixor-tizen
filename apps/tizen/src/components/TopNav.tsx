import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useFocusable, FocusContext } from "@noriginmedia/norigin-spatial-navigation";
import { UserAvatar } from "./UserAvatar";
import { flixor } from "../services/flixor";

interface NavButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function NavButton({ label, active, onPress }: NavButtonProps) {
  const { ref, focused } = useFocusable({ onEnterPress: onPress });

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

  const { ref: navRef, focusKey } = useFocusable({
    focusKey: "top-nav",
    trackChildren: true,
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
          active={currentPath === "/"}
          onPress={() => navigate("/")}
        />
        <NavButton
          label="My List"
          active={currentPath === "/mylist"}
          onPress={() => navigate("/mylist")}
        />
        <NavButton
          label="New & Popular"
          active={currentPath === "/new-popular"}
          onPress={() => navigate("/new-popular")}
        />
        <NavButton
          label="Movies"
          active={currentPath.includes("/library/movie")}
          onPress={() => navigate("/library/movie")}
        />
        <NavButton
          label="Shows"
          active={currentPath.includes("/library/show")}
          onPress={() => navigate("/library/show")}
        />
        <NavButton
          label="Search"
          active={currentPath === "/search"}
          onPress={() => navigate("/search")}
        />
        <NavButton
          label="⚙ Settings"
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
