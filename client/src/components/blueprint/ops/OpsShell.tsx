import * as React from "react";
import { Link } from "wouter";
import {
  Inbox,
  Camera,
  Map,
  ClipboardCheck,
  PackageCheck,
  Wallet,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * OpsShell — the OPS CONSOLE chrome.
 *
 * Dark (#0d0d0b) OPS-badged sidebar with the six ops surfaces, a white topbar
 * (opsHdr: H1 1.2rem/600 + mono sub + actions slot), and a scrolling content
 * area. Mobile (<~900px) collapses the sidebar into a slide-in drawer.
 *
 * Ops pages route with shell:"bare" — they render <OpsShell> directly (no
 * SiteLayout). Pass `active` to mark the current surface; navigation uses
 * wouter <Link href>.
 */

export type OpsSurface =
  | "queue"
  | "supply"
  | "city-launch"
  | "evidence"
  | "handoff"
  | "spend";

interface OpsNavItem {
  key: OpsSurface;
  label: string;
  href: string;
  icon: LucideIcon;
}

const OPS_NAV: OpsNavItem[] = [
  { key: "queue", label: "Queue", href: "/ops", icon: Inbox },
  { key: "supply", label: "Capture supply", href: "/ops/supply", icon: Camera },
  { key: "city-launch", label: "City launch", href: "/ops/city-launch", icon: Map },
  {
    key: "evidence",
    label: "Evidence review",
    href: "/ops/evidence",
    icon: ClipboardCheck,
  },
  { key: "handoff", label: "Buyer handoff", href: "/ops/handoff", icon: PackageCheck },
  { key: "spend", label: "Spend controls", href: "/ops/spend", icon: Wallet },
];

export interface OpsShellProps {
  /** Which surface is active — drives the brass active treatment. */
  active: OpsSurface;
  /** Topbar H1. */
  title: React.ReactNode;
  /** Mono sub-line under the title. */
  sub?: React.ReactNode;
  /** Right-aligned actions slot in the topbar (buttons, chips). */
  actions?: React.ReactNode;
  /** Page content. */
  children: React.ReactNode;
}

interface OpsSidebarProps {
  active: OpsSurface;
  /** Called when a nav link is followed (closes the mobile drawer). */
  onNavigate?: () => void;
}

function OpsSidebar({ active, onNavigate }: OpsSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-ink text-[color:var(--text-on-ink)]">
      {/* Brand + OPS badge */}
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
        <span
          aria-hidden="true"
          className="h-7 w-7 shrink-0 bg-brass"
          style={{
            clipPath:
              "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
          }}
        />
        <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-[#f3efe6]">
          Blueprint
        </span>
        <span className="ml-1 border border-brass/60 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-brass">
          Ops
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        {OPS_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-[0.875rem] font-semibold transition-colors duration-150",
                isActive
                  ? "bg-brass text-ink"
                  : "text-[rgba(243,239,230,0.72)] hover:bg-white/5 hover:text-[#f3efe6]",
              )}
            >
              <Icon
                className="h-[1.05rem] w-[1.05rem] shrink-0"
                strokeWidth={isActive ? 2 : 1.75}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer note */}
      <div className="border-t border-white/10 px-5 py-4">
        <p className="font-mono text-[0.65rem] leading-[1.5] text-[rgba(243,239,230,0.45)]">
          Internal ops console. Illustrative data — not live supply or
          readiness.
        </p>
      </div>
    </div>
  );
}

const OpsShell = React.forwardRef<HTMLDivElement, OpsShellProps>(
  ({ active, title, sub, actions, children }, ref) => {
    const [drawerOpen, setDrawerOpen] = React.useState(false);

    // Close the drawer on Escape.
    React.useEffect(() => {
      if (!drawerOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setDrawerOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [drawerOpen]);

    return (
      <div ref={ref} className="flex h-screen w-full overflow-hidden bg-canvas">
        {/* Desktop sidebar (>=900px) */}
        <aside className="hidden w-[15.5rem] shrink-0 min-[900px]:block">
          <OpsSidebar active={active} />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 min-[900px]:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-ink/60"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[15.5rem] shadow-ink">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
                className="absolute right-3 top-4 z-10 flex h-8 w-8 items-center justify-center text-[rgba(243,239,230,0.72)] hover:text-[#f3efe6]"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
              <OpsSidebar
                active={active}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar (opsHdr) */}
          <header className="flex shrink-0 items-center gap-4 border-b border-line bg-white px-5 py-3 min-[900px]:px-7">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-line text-ink-600 hover:bg-inset min-[900px]:hidden"
            >
              <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </button>

            <div className="flex min-w-0 flex-col">
              <h1 className="truncate text-[1.2rem] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
                {title}
              </h1>
              {sub != null && (
                <span className="truncate font-mono text-[0.75rem] leading-tight text-ink-500">
                  {sub}
                </span>
              )}
            </div>

            {actions != null && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {actions}
              </div>
            )}
          </header>

          {/* Scrolling content */}
          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-6 min-[900px]:px-7 min-[900px]:py-8">
            {children}
          </main>
        </div>
      </div>
    );
  },
);
OpsShell.displayName = "OpsShell";

export { OpsShell, OPS_NAV };
