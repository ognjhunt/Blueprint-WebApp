import { useState, type ReactNode, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { WorkspaceContext } from "@/components/workspace/WorkspaceContext";
import type { WorkspaceRole } from "@/types/workspace";
import "@/components/workspace/workspace.css";

export type AppView =
  | "overview"
  | "captures"
  | "runs"
  | "opportunities"
  | "packs"
  | "policies"
  | "data"
  | "entitlements"
  | "tasks"
  | "history"
  | "settings";
export interface AppShellProps {
  active: AppView;
  breadcrumb: string;
  children: ReactNode;
  contentClassName?: string;
  publicView?: boolean;
  role?: WorkspaceRole;
  organization?: string;
}
function handleWorkspaceTabs(event: KeyboardEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement;
  const list = target.closest(".ws-tabs");
  if (
    !list ||
    target.getAttribute("role") !== "tab" ||
    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
  )
    return;
  const tabs = Array.from(
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = tabs.indexOf(target as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
          tabs.length;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}

export function AppShell({
  active,
  breadcrumb,
  children,
  contentClassName = "",
  publicView = false,
  role,
  organization,
}: AppShellProps) {
  const { currentUser, userData, logout } = useAuth();
  const [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const workspaceType = role || userData?.buyerType;
  const configured =
    workspaceType === "site_operator" || workspaceType === "robot_team";
  const isSite = workspaceType === "site_operator";
  const account =
    organization ||
    String(
      userData?.company ||
        userData?.organizationName ||
        userData?.name ||
        currentUser?.displayName ||
        "Your workspace",
    );
  const items = !configured
    ? [
        ["overview", "Overview", "/app"],
        ["settings", "Settings", "/settings"],
      ]
    : isSite
      ? [
          ["overview", "Overview", "/app"],
          ["tasks", "Tasks", "/app/tasks"],
          ["history", "History", "/app/history"],
          ["settings", "Settings", "/settings"],
        ]
      : [
          ["overview", "Overview", "/app"],
          // The $99 task library, not the pilot-openings list the capture-first
          // intake never fills; and the runs and balance a team paid for.
          ["opportunities", "Task library", "/sites"],
          ["runs", "Runs & balance", "/settings?tab=agent"],
          ["history", "History", "/app/history"],
          ["settings", "Settings", "/settings"],
        ];
  const selected = ["captures", "packs"].includes(active)
    ? isSite
      ? "tasks"
      : "opportunities"
    : ["policies", "entitlements", "data"].includes(active)
      ? "settings"
      : active === "runs"
        ? "overview"
        : active;
  const brand = (
    <Link
      href={publicView ? "/" : "/app"}
      className="ws-brand"
      aria-label="Blueprint home"
    >
      <span aria-hidden="true" />
      Blueprint
    </Link>
  );
  return (
    <WorkspaceContext.Provider value={true}>
      <div
        className={`workspace-shell ${publicView ? "ws-public" : ""}`}
        onKeyDown={handleWorkspaceTabs}
      >
        <a className="ws-skip" href="#workspace-main">
          Skip to content
        </a>
        <header className="ws-mobile-header">
          {brand}
          {!publicView ? (
            <button
              type="button"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="workspace-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          ) : (
            <Link href="/sign-in">Sign in</Link>
          )}
        </header>
        {!publicView ? (
          <aside className={`ws-sidebar ${open ? "is-open" : ""}`}>
            <div className="ws-desktop-brand">{brand}</div>
            <nav
              id="workspace-navigation"
              aria-label={
                !configured
                  ? "Workspace setup"
                  : isSite
                    ? "Site workspace"
                    : "Robot-team workspace"
              }
            >
              {items.map(([key, label, href]) => (
                <Link
                  key={key}
                  href={href}
                  aria-current={selected === key ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ws-account">
              <span>{account}</span>
              <small>
                {!configured
                  ? "Workspace setup"
                  : isSite
                    ? "Site workspace"
                    : "Robot-team workspace"}
              </small>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await logout();
                  } catch {
                    setError("Could not sign out. Please try again.");
                  }
                }}
              >
                Sign out
              </button>
              {error && <p role="alert">{error}</p>}
            </div>
          </aside>
        ) : (
          <div className="ws-public-brand">{brand}</div>
        )}
        <div className="ws-content">
          <main
            id="workspace-main"
            className={`ws-main ${contentClassName}`}
            aria-label={breadcrumb}
          >
            {children}
          </main>
          <footer className="ws-footer">
            <span>© {new Date().getFullYear()} Blueprint Robotics, Inc.</span>
            <div>
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </div>
          </footer>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
export default AppShell;
