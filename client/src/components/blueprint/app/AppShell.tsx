import * as React from "react";
import { Link } from "wouter";
import {
  Bell,
  Boxes,
  Database,
  KeySquare,
  LayoutDashboard,
  ListChecks,
  Menu,
  Cpu,
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
  | "runs"
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
  { key: "runs", label: "Evaluation Runs", href: "/app/runs", Icon: ListChecks },
  { key: "packs", label: "Site & Task Packs", href: "/app/packs", Icon: Boxes },
  { key: "policies", label: "Policies", href: "/app/policies", Icon: Cpu },
  { key: "data", label: "Data Packages", href: "/app/data", Icon: Database },
  {
    key: "entitlements",
    label: "Entitlements",
    href: "/app/entitlements",
    Icon: KeySquare,
  },
];

const OPERATOR_NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Site status", href: "/app", Icon: LayoutDashboard },
  { key: "packs", label: "Submit another site", href: "/contact/site-operator", Icon: Boxes },
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
      className="flex items-center gap-2.5 px-5 py-5 text-[#f3efe6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60"
      aria-label="Blueprint — buyer app home"
    >
      <BrandMark tone="paper" className="h-7 w-7" />
      <span className="text-[1.15rem] font-semibold leading-none tracking-[-0.035em]">
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
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60",
              isActive
                ? "bg-brass text-ink"
                : "text-[#cdc9bb] hover:bg-white/[0.06] hover:text-[#f3efe6]",
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
      <div className="mx-3 mb-4 mt-auto rounded-none border border-white/10 bg-white/[0.04] p-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a496]">Operator record</div>
        <div className="mt-1 font-mono text-[0.78rem] text-[#f3efe6]">Request-backed</div>
        <div className="mt-3 text-[0.78rem] leading-[1.45] text-[#cdc9bb]">Status comes from the linked intake and ops record; no buyer demand or approval is implied.</div>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-4 mt-auto rounded-none border border-white/10 bg-white/[0.04] p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8a496]">
        Entitlement access
      </div>
      <div className="mt-1 font-mono text-[0.78rem] text-[#f3efe6]">
        Stripe-backed
      </div>

      <div className="mt-3 text-[0.78rem] leading-[1.45] text-[#cdc9bb]">
        Routes unlock from marketplace entitlements written after payment
        provisioning.
      </div>
    </div>
  );
}

function SidebarBody({ active, onNavigate }: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col bg-ink text-[#f3efe6]">
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-white px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-none text-ink-700 hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
        <div className="min-w-0 truncate font-mono text-[0.78rem] text-ink-500">
          <span className="text-ink-400">blueprint</span>
          <span className="px-1.5 text-ink-300">/</span>
          <span className="text-ink-800">{breadcrumb}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-none text-ink-600 hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
          aria-label="Notifications"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-info-bg font-mono text-[0.72rem] font-semibold text-info-fg"
          >
            {initials}
          </span>
          <span className="hidden text-[0.82rem] font-semibold leading-none text-ink-800 sm:inline">
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
 * AppShell — buyer-app chrome: dark fixed sidebar (15.5rem) + white topbar
 * (3.5rem) + scrolling content. Under ~900px the sidebar collapses into a
 * left drawer (shadcn Sheet) opened from the topbar hamburger.
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
      <aside className="hidden w-[15.5rem] shrink-0 border-r border-white/10 lg:block">
        <SidebarBody active={active} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="w-[15.5rem] border-0 bg-ink p-0 text-[#f3efe6] sm:max-w-[15.5rem]"
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
