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
import { BrandLockup } from "./BrandMark";
import { primaryNavLinks } from "./navigation";

const signupLinks = [
  {
    href: "/signup/business?buyerType=robot_team&source=header-signup",
    label: "Robot team",
    description: "Create an account to scope evaluations and policy improvement.",
    Icon: Bot,
  },
  {
    href: "/signup/business?buyerType=site_operator&source=header-signup",
    label: "Site operator",
    description: "Submit a facility and set access boundaries for free.",
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
        workspaceHref: "/capture-app",
        workspaceLabel: "Open capture app",
        secondaryHref: "/capture",
        secondaryLabel: "View capture jobs",
        requestHref,
      };
    }

    if (userData?.buyerType === "site_operator") {
      return {
        label: "Site operator",
        badge: "Site operator",
        workspaceHref: userData.finishedOnboarding ? "/dashboard" : "/onboarding",
        workspaceLabel: userData.finishedOnboarding ? "Open site workspace" : "Finish site onboarding",
        secondaryHref: "/contact/site-operator",
        secondaryLabel: "Submit another site",
        requestHref,
      };
    }

    return {
      label: "Robot team",
      badge: "Robot team",
      workspaceHref: userData?.finishedOnboarding ? "/dashboard" : "/onboarding",
      workspaceLabel: userData?.finishedOnboarding ? "Open robot-team workspace" : "Finish robot-team onboarding",
      secondaryHref: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=signed-in-header",
      secondaryLabel: "Request another evaluation",
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

    return {
      href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=policy-evaluation-run&source=header",
      label: "Request evaluation",
    };
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d0d0b] text-white">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a
          href="/"
          className="inline-flex min-h-11 items-center text-white transition hover:opacity-90"
          aria-label="Blueprint home"
        >
          <BrandLockup tone="paper" compact />
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 xl:flex">
          {primaryNavLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative pb-1.5 text-sm font-semibold tracking-[-0.01em] transition ${
                  active ? "text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-px origin-center bg-white transition ${
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <a
            href={visibleHeaderCta.href}
            className="inline-flex items-center justify-center whitespace-nowrap border border-[#c7a775]/55 bg-[#c7a775] px-[1.125rem] py-2.5 text-[13px] font-semibold leading-none text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
          >
            {visibleHeaderCta.label}
          </a>
          {currentUser ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full ring-1 ring-slate-200 transition hover:ring-slate-300"
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
                    <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-700">
                      {userInitials || "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {userPersona.badge}
                  </span>
                  <span className="mt-1 block truncate text-sm text-slate-950">
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
          ) : (
            <>
              <a
                href="/sign-in"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap border border-white/15 px-4 py-2.5 text-[13px] font-semibold leading-none text-white/80 transition hover:border-white/35 hover:text-white"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap border border-white/15 bg-white/5 px-4 py-2.5 text-[13px] font-semibold leading-none text-white transition hover:border-white/35 hover:bg-white/10"
                  >
                    <UserPlus className="h-4 w-4" />
                    Sign up
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Choose access path</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {signupLinks.map(({ href, label, description, Icon }) => (
                    <DropdownMenuItem key={href} asChild>
                      <a href={href} className="flex items-start gap-3 py-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          <span className="block font-semibold">{label}</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {description}
                          </span>
                        </span>
                      </a>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-none border border-white/20 bg-white/5 p-0 text-white xl:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-[#0d0d0b] xl:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 text-sm font-medium text-white">
            <div className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Explore
              </p>
              {primaryNavLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-none border-b border-white/15 px-1 py-3 text-white/85 transition hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <a
              href={visibleHeaderCta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-none border border-[#c7a775]/55 bg-[#c7a775] px-4 py-2.5 text-center font-semibold text-[#0d0d0b]"
              onClick={() => setOpen(false)}
            >
              {visibleHeaderCta.label}
            </a>

            {currentUser ? (
              <>
                <div className="border border-white/15 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Signed in as
                  </p>
                  <p className="mt-1 text-sm text-white">{userPersona.badge}</p>
                </div>
                {userPersona.requestHref ? (
                  <a
                    href={userPersona.requestHref}
                    className="inline-flex min-h-11 items-center justify-center rounded-none border border-white/20 px-4 py-2.5 text-center text-white"
                    onClick={() => setOpen(false)}
                  >
                    Request room
                  </a>
                ) : null}
                <a
                  href={userPersona.secondaryHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-none border border-white/20 px-4 py-2.5 text-center text-white"
                  onClick={() => setOpen(false)}
                >
                  {userPersona.secondaryLabel}
                </a>
                <a
                  href="/settings"
                  className="inline-flex min-h-11 items-center justify-center rounded-none border border-white/20 px-4 py-2.5 text-center text-white"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </a>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-none border border-red-500/30 px-4 py-2.5 text-center text-red-200"
                  onClick={async () => {
                    await handleSignOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="space-y-3 border-t border-white/10 pt-5">
                <a
                  href="/sign-in"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-none border border-white/20 px-4 py-2.5 text-center text-white"
                  onClick={() => setOpen(false)}
                >
                  Sign in
                </a>
                <div className="grid gap-2">
                  {signupLinks.map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      className="inline-flex min-h-11 items-center justify-center rounded-none border border-white/20 px-4 py-2.5 text-center text-white"
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
