import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ProfileSelect } from "../../pages/ProfileSelect";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@noriginmedia/norigin-spatial-navigation", () => ({
  useFocusable: (opts?: { onEnterPress?: () => void }) => ({
    ref: { current: null },
    focused: false,
    focusKey: "test-key",
    focusSelf: vi.fn(),
    ...opts,
  }),
  FocusContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
}));

const mockGetHomeUsers = vi.fn();
const mockSwitchToProfile = vi.fn();

vi.mock("../../services/flixor", () => ({
  flixor: {
    getHomeUsers: (...a: unknown[]) => mockGetHomeUsers(...a),
    switchToProfile: (...a: unknown[]) => mockSwitchToProfile(...a),
  },
}));

describe("ProfileSelect", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockGetHomeUsers.mockReset();
    mockSwitchToProfile.mockReset();
  });

  it("shows loading state initially", () => {
    mockGetHomeUsers.mockReturnValue(new Promise(() => {}));
    render(<ProfileSelect />);
    expect(screen.getByText("Loading profiles…")).toBeInTheDocument();
  });

  it("shows profiles after loading", async () => {
    mockGetHomeUsers.mockResolvedValue([
      { id: "1", title: "Alice", username: "alice", admin: true, protected: false },
      { id: "2", title: "Bob", username: "bob", admin: false, protected: false },
    ]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    expect(screen.getByText("Who's Watching?")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows empty state when no profiles", async () => {
    mockGetHomeUsers.mockResolvedValue([]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    expect(screen.getByText("No Profiles Found")).toBeInTheDocument();
  });

  it("shows error when fetch fails", async () => {
    mockGetHomeUsers.mockRejectedValue(new Error("Network error"));
    await act(async () => {
      render(<ProfileSelect />);
    });
    expect(screen.getByText("Network error")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("switches profile on click and navigates to /", async () => {
    const user = { id: "1", title: "Alice", username: "alice", admin: false, protected: false };
    mockGetHomeUsers.mockResolvedValue([user]);
    mockSwitchToProfile.mockResolvedValue(undefined);
    await act(async () => {
      render(<ProfileSelect />);
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Alice"));
    });
    expect(mockSwitchToProfile).toHaveBeenCalledWith(user, undefined);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("shows PIN dialog for protected profiles", async () => {
    mockGetHomeUsers.mockResolvedValue([
      { id: "1", title: "Kid", username: "kid", admin: false, protected: true },
    ]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    fireEvent.click(screen.getByText("Kid"));
    expect(screen.getByText("Enter PIN for Kid")).toBeInTheDocument();
    // On-screen D-pad keypad: digits + backspace + cancel keys
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("✕")).toBeInTheDocument();
  });

  it("shows lock icon for protected profiles", async () => {
    mockGetHomeUsers.mockResolvedValue([
      { id: "1", title: "Kid", username: "kid", admin: false, protected: true },
    ]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    expect(screen.getByText("🔒")).toBeInTheDocument();
  });

  it("shows avatar initial when no thumb", async () => {
    mockGetHomeUsers.mockResolvedValue([
      { id: "1", title: "Alice", username: "alice", admin: false, protected: false },
    ]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("cancels PIN dialog", async () => {
    mockGetHomeUsers.mockResolvedValue([
      { id: "1", title: "Kid", username: "kid", admin: false, protected: true },
    ]);
    await act(async () => {
      render(<ProfileSelect />);
    });
    fireEvent.click(screen.getByText("Kid"));
    expect(screen.getByText("Enter PIN for Kid")).toBeInTheDocument();
    fireEvent.click(screen.getByText("✕"));
    expect(screen.queryByText("Enter PIN for Kid")).not.toBeInTheDocument();
  });
});
