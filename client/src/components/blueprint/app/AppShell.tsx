import * as React from "react";
import { Link } from "wouter";
import {
  Bell,
  Boxes,
  LayoutDashboard,
  ListChecks,
  Handshake,
  Menu,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandMark } from "@/components/site/BrandMark";
import { useAuth } from "@/contexts/AuthContext";

/* -------------------------------------------------------------------------- */
/*  Nav model                                                                 */
/* -------------------------------------------------------------------------- */

/** Stable keys for the active nav item — screens pass one to `active`. */
export type AppView =
  | "overview"
  | "captures"
  | "runs"
  | "opportunities"
  | "packs"
  | "policies"
  | "data"
  | "entitlements";

interface NavItem {
  key: AppView;
  label: string;
  href: string;
  Icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", href: "/app", Icon: LayoutDashboard },
  { key: "captures", label: "Captures", href: "/app/captures", Icon: UploadCloud },
  { key: "packs", label: "Testbeds", href: "/app/packs", Icon: Boxes },
  { key: "runs", label: "Task Evaluation Runs", href: "/app/runs", Icon: ListChecks },
  { key: "opportunities", label: "Pilot opportunities", href: "/app/opportunities", Icon: Handshake },
];

const OPERATOR_NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", href: "/app", Icon: LayoutDashboard },
  { key: "captures", label: "Captures", href: "/app/captures", Icon: UploadCloud },
  { key: "packs", label: "Testbeds", href: "/app/packs", Icon: Boxes },
  { key: "runs", label: "Task Evaluation Runs", href: "/app/runs", Icon: ListChecks },
];

/* -------------------------------------------------------------------------- */
/*  Sidebar internals (shared between fixed rail + mobile drawer)             */
/* -------------------------------------------------------------------------- */

interface SidebarBodyProps {
  active: AppView;
  /** Invoked when a nav link is chosen (closes the mobile drawer). */
  onNavigate?: () => void;
}

function SidebarBrand() {
  return (
    <Link
      href="/app"
      className="flex items-center gap-2.5 px-5 py-5 text-runway-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal"
      aria-label="Blueprint — buyer app home"
    >
      <BrandMark tone="ink" className="h-7 w-7" />
      <span className="font-display uppercase text-[1.15rem] font-semibold leading-none tracking-[0.005em]">
        Blueprint
      </span>
    </Link>
  );
}

function SidebarNav({ active, onNavigate }: SidebarBodyProps) {
  const { userData } = useAuth();
  const isSiteOperator = userData?.buyerType === "site_operator";
  const navItems = isSiteOperator ? OPERATOR_NAV_ITEMS : NAV_ITEMS;
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label={isSiteOperator ? "Site operator app" : "Buyer app"}>
      {navItems.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-none px-3 py-2.5 text-[0.85rem] font-semibold leading-none transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal",
              isActive
                ? "bg-runway-signal text-runway-signal-ink"
                : "text-runway-body hover:bg-runway-raised hover:text-runway-text",
            )}
          >
            <Icon
              className="h-[1.05rem] w-[1.05rem] shrink-0"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarPlanCard() {
  const { userData } = useAuth();
  if (userData?.buyerType === "site_operator") {
    return (
      <div className="runway-panel mx-3 mb-4 mt-auto p-3.5">
        <div className="runway-meta font-semibold">Operator record</div>
        <div className="runway-num mt-1 text-[0.78rem] text-runway-text">Run-scoped</div>
        <div className="mt-3 text-[0.78rem] leading-[1.45] text-runway-body">Testbed, authorization, evidence, and decision states stay linked to each request.</div>
      </div>
    );
  }
  return (
    <div className="runway-panel mx-3 mb-4 mt-auto p-3.5">
      <div className="runway-meta font-semibold">
        Scoped engagement
      </div>
      <div className="runway-num mt-1 text-[0.78rem] text-runway-text">
        Quote required
      </div>

      <div className="mt-3 text-[0.78rem] leading-[1.45] text-runway-body">
        Each run is scoped to the decision, evidence, timing, compute, and any
        physical requirements. Existing entitlements remain readable.
      </div>
    </div>
  );
}

function SidebarBody({ active, onNavigate }: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col bg-runway-deep text-runway-text">
      <SidebarBrand />
      <div className="pt-1">
        <SidebarNav active={active} onNavigate={onNavigate} />
      </div>
      <SidebarPlanCard />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Topbar                                                                    */
/* -------------------------------------------------------------------------- */

interface TopbarProps {
  breadcrumb: string;
  onOpenMenu: () => void;
}

function displayNameForUser({
  currentUser,
  userData,
}: Pick<ReturnType<typeof useAuth>, "currentUser" | "userData">) {
  const metadataName = String(userData?.name || userData?.displayName || "").trim();
  return (
    metadataName ||
    currentUser?.displayName ||
    currentUser?.email ||
    "Blueprint buyer"
  );
}

function initialsForName(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return "BP";
  }
  const parts = normalized.includes("@")
    ? normalized.split("@")[0].split(/[._-]+/)
    : normalized.split(/\s+/);
  return parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .padEnd(2, "P")
    .slice(0, 2);
}

function Topbar({ breadcrumb, onOpenMenu }: TopbarProps) {
  const { currentUser, userData } = useAuth();
  const displayName = displayNameForUser({ currentUser, userData });
  const initials = initialsForName(displayName);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-runway-line bg-runway-panel px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-none text-runway-body hover:bg-runway-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0 truncate font-mono text-[0.78rem] text-runway-mute">
          <span className="text-runway-faint">blueprint</span>
          <span className="px-1.5 text-runway-faint">/</span>
          <span className="text-runway-text">{breadcrumb}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-none text-runway-mute hover:bg-runway-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal"
          aria-label="Notifications"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-runway-sky-dim font-mono text-[0.72rem] font-semibold text-runway-sky"
          >
            {initials}
          </span>
          <span className="hidden text-[0.82rem] font-semibold leading-none text-runway-text sm:inline">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  AppShell                                                                  */
/* -------------------------------------------------------------------------- */

export interface AppShellProps {
  /** Which nav item is highlighted. */
  active: AppView;
  /** Topbar breadcrumb leaf (rendered after "blueprint /"). */
  breadcrumb: string;
  /** Screen content (scrolls within the content area). */
  children: React.ReactNode;
  /** Optional class on the scrolling content wrapper. */
  contentClassName?: string;
}

/**
 * AppShell — buyer-app chrome: fixed sidebar (15.5rem) on the deep ground +
 * panel topbar (3.5rem) + scrolling content. Under ~900px the sidebar collapses
 * into a left drawer (shadcn Sheet) opened from the topbar hamburger.
 */
export function AppShell({
  active,
  breadcrumb,
  children,
  contentClassName,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas">
      {/* Fixed sidebar — desktop */}
      <aside className="hidden w-[15.5rem] shrink-0 border-r border-runway-line lg:block">
        <SidebarBody active={active} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[15.5rem] border-0 bg-runway-deep p-0 text-runway-text sm:max-w-[15.5rem]"
        >
          <SheetTitle className="sr-only">Buyer app navigation</SheetTitle>
          <SidebarBody active={active} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar breadcrumb={breadcrumb} onOpenMenu={() => setDrawerOpen(true)} />
        <main
          className={cn("flex-1 overflow-y-auto", contentClassName)}
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
