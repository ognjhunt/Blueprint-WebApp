import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import {
  Bot,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  Menu,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  headerRequestEvaluation,
  headerUtilityLinks,
  primaryNavLinks,
} from "./navigation";

const signupLinks = [
  {
    href: "/signup/business?buyerType=robot_team&source=header-signup",
    label: "Robot team",
    description: "Real site jobs with a budget behind them. Test robot fit before you commit deployment engineers.",
    Icon: Bot,
  },
  {
    href: "/signup/business?buyerType=site_operator&source=header-signup",
    label: "Site operator",
    description: "Show us one job you want a robot to do. We find which robots can actually do it.",
    Icon: ShieldCheck,
  },
] as const;

export function Header() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();

  const isActive = useMemo(
    () =>
      (href: string) => {
        const normalizedHref = href.split("?")[0];
        return (
          location === normalizedHref
          || (normalizedHref !== "/" && location.startsWith(normalizedHref))
        );
      },
    [location],
  );

  const userInitials = useMemo(() => {
    const name = userData?.name || userData?.displayName || "";
    if (!name) {
      return "";
    }
    return name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }, [userData?.name, userData?.displayName]);

  const userPersona = useMemo(() => {
    const roleData = userData as
      | (NonNullable<typeof userData> & { role?: string; roles?: string[] })
      | null;
    const isCapturer =
      roleData?.role === "capturer" || roleData?.roles?.includes("capturer") === true;
    const requestHref = userData?.structuredIntakeRequestId
      ? `/requests/${encodeURIComponent(userData.structuredIntakeRequestId)}`
      : null;

    if (isCapturer) {
      return {
        label: "Capture operator",
        badge: "Capture",
        workspaceHref: "/capture-app/account",
        workspaceLabel: "Open capture account",
        secondaryHref: "/capture",
        secondaryLabel: "Get paid to capture",
        requestHref,
      };
    }

    if (userData?.buyerType === "site_operator") {
      return {
        label: "Site operator",
        badge: "Site operator",
        workspaceHref: userData.finishedOnboarding ? "/app" : "/onboarding",
        workspaceLabel: userData.finishedOnboarding ? "Open site workspace" : "Finish site onboarding",
        secondaryHref: "/contact/site-operator",
        secondaryLabel: "Submit another site",
        requestHref,
      };
    }

    return {
      label: "Robot team",
      badge: "Robot team",
      workspaceHref: userData?.finishedOnboarding ? "/app" : "/onboarding",
      workspaceLabel: userData?.finishedOnboarding ? "Open robot-team workspace" : "Finish robot-team onboarding",
      secondaryHref: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=task-evaluation-run&path=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=signed-in-header",
      secondaryLabel: "Request another Task Evaluation Run",
      requestHref,
    };
  }, [userData]);

  const headerCta = useMemo(() => {
    if (
      location === "/capture"
      || location.startsWith("/capture-app")
      || location.startsWith("/signup/capturer")
    ) {
      return {
        href: "/capture-app/launch-access?role=capturer&source=header",
        label: "Check capture access",
      };
    }

    if (location === "/contact/site-operator" || location === "/governance") {
      return {
        href: "/contact/site-operator",
        label: "Submit site boundaries",
      };
    }

    if (location === "/agents" || location.startsWith("/developers/agents")) {
      return {
        href: "/agent-access.openapi.json",
        label: "Open agent contract",
      };
    }

    return headerRequestEvaluation;
  }, [location]);

  const visibleHeaderCta = currentUser
    ? {
        href: userPersona.workspaceHref,
        label: userPersona.workspaceLabel,
      }
    : headerCta;

  const handleSignOut = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-runway-line bg-runway-black/85 text-runway-text backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.25rem] max-w-[94rem] items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <a
          href="/"
          className="inline-flex min-h-11 items-center transition hover:opacity-70"
          aria-label="Blueprint home"
        >
          <span className="text-[1.18rem] font-bold uppercase leading-none tracking-[0.16em] text-runway-signal">
            Blueprint
          </span>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-8 xl:flex">
          {primaryNavLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative py-2 text-[13px] font-medium tracking-[-0.01em] transition ${
                  active ? "text-runway-signal" : "text-runway-mute hover:text-runway-text"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-px origin-center bg-runway-signal transition ${
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 xl:flex">
          <span aria-hidden className="h-5 w-px bg-runway-line" />
          {headerUtilityLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-[13px] font-medium transition ${
                isActive(link.href)
                  ? "text-runway-signal"
                  : "text-runway-mute hover:text-runway-text"
              }`}
            >
              {link.label}
            </a>
          ))}
          {currentUser ? (
            <>
              <a
                href={visibleHeaderCta.href}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm bg-runway-signal px-[1.125rem] py-2.5 text-[13px] font-semibold leading-none text-runway-black transition hover:bg-runway-signal-deep"
              >
                {visibleHeaderCta.label}
              </a>
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full ring-1 ring-runway-line transition hover:ring-runway-signal/60"
                  aria-label="Open user menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={userData?.photoURL || ""}
                      alt={userData?.name || userData?.displayName || "User profile"}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                    <AvatarFallback className="bg-[#2563a6]/15 text-xs font-semibold text-[#2563a6]">
                      {userInitials || "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-none border-runway-line">
                <DropdownMenuLabel>
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0d0d0b]/55">
                    {userPersona.badge}
                  </span>
                  <span className="mt-1 block truncate text-sm text-[#0d0d0b]">
                    {userData?.organizationName || userData?.name || userData?.email || userPersona.label}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href={userPersona.workspaceHref} className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    {userPersona.workspaceLabel}
                  </a>
                </DropdownMenuItem>
                {userPersona.requestHref ? (
                  <DropdownMenuItem asChild>
                    <a href={userPersona.requestHref} className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      Request room
                    </a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <a href={userPersona.secondaryHref}>
                    {userPersona.secondaryLabel}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/settings">
                    Settings
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <a
                href="/sign-in"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-medium leading-none text-runway-mute transition hover:text-runway-text"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm border border-runway-line bg-runway-panel px-4 py-2.5 text-[13px] font-medium leading-none text-runway-text transition hover:border-runway-signal/60"
                  >
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 rounded-none border-runway-line">
                  <DropdownMenuLabel>Choose access path</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {signupLinks.map(({ href, label, description, Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <a href={href} className="flex items-start gap-3 py-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          <span className="block font-semibold">{label}</span>
                          <span className="mt-1 block text-xs leading-5 text-[#0d0d0b]/55">
                            {description}
                          </span>
                        </span>
                      </a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <a
                href={headerRequestEvaluation.href}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm bg-runway-signal px-[1.125rem] py-2.5 text-[13px] font-semibold leading-none text-runway-black transition hover:bg-runway-signal-deep"
              >
                {headerRequestEvaluation.label}
              </a>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-runway-line bg-runway-panel p-0 text-runway-text xl:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-runway-line bg-runway-deep xl:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-6 text-sm font-medium text-runway-text">
            <div className="space-y-2">
              <p className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-runway-faint">
                Explore
              </p>
              {[...primaryNavLinks, ...headerUtilityLinks].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center border-b border-runway-line px-1 py-3 text-runway-mute transition hover:text-runway-signal"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <a
              href={visibleHeaderCta.href}
              className="inline-flex min-h-12 items-center justify-center rounded-sm bg-runway-signal px-4 py-2.5 text-center font-semibold text-runway-black"
              onClick={() => setOpen(false)}
            >
              {visibleHeaderCta.label}
            </a>

            {currentUser ? (
              <>
                <div className="rounded-sm border border-runway-line px-4 py-3">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-runway-faint">
                    Signed in as
                  </p>
                  <p className="mt-1 text-sm text-runway-text">{userPersona.badge}</p>
                </div>
                {userPersona.requestHref ? (
                  <a
                    href={userPersona.requestHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-sm border border-runway-line px-4 py-2.5 text-center text-runway-text"
                    onClick={() => setOpen(false)}
                  >
                    Request room
                  </a>
                ) : null}
                <a
                  href={userPersona.secondaryHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-sm border border-runway-line px-4 py-2.5 text-center text-runway-text"
                  onClick={() => setOpen(false)}
                >
                  {userPersona.secondaryLabel}
                </a>
                <a
                  href="/settings"
                  className="inline-flex min-h-11 items-center justify-center rounded-sm border border-runway-line px-4 py-2.5 text-center text-runway-text"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </a>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-sm border border-runway-red/45 px-4 py-2.5 text-center text-runway-red"
                  onClick={async () => {
                    await handleSignOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="space-y-3 border-t border-runway-line pt-5">
                <a
                  href="/sign-in"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-sm border border-runway-line px-4 py-2.5 text-center text-runway-text"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </a>
                <div className="grid gap-2">
                  {signupLinks.map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      className="inline-flex min-h-11 items-center justify-center rounded-sm border border-runway-line px-4 py-2.5 text-center text-runway-text"
                      onClick={() => setOpen(false)}
                    >
                      Sign up: {label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
