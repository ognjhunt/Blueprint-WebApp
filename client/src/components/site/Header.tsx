import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { publicDemoHref } from "@/lib/marketingProof";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { headerUtilityLinks, primaryNavLinks } from "./navigation";

export function Header() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();

  const isActive = useMemo(
    () =>
      (href: string) => {
        return location === href || (href !== "/" && location.startsWith(href));
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

  const handleSignOut = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[80rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a
          href="/"
          className="inline-flex min-h-11 items-center gap-3 text-slate-950 transition hover:opacity-90"
        >
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.92))] shadow-[0_14px_30px_-24px_rgba(15,23,42,0.6)]">
            <span className="absolute inset-[5px] rounded-xl border border-slate-200/80" />
            <span className="absolute left-[12px] top-[10px] h-5 w-[3px] rounded-full bg-slate-950" />
            <span className="absolute left-[18px] top-[10px] h-3.5 w-[3px] rounded-full bg-slate-500" />
            <span className="absolute left-[24px] top-[10px] h-6 w-[3px] rounded-full bg-slate-300" />
          </span>
          <span className="text-[1.32rem] font-semibold tracking-[-0.04em]">Blueprint</span>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-7 xl:flex">
          {primaryNavLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-[-0.01em] transition ${
                  active ? "text-slate-950" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 xl:flex">
          {headerUtilityLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-[-0.01em] transition ${
                  active ? "text-slate-950" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                {link.label}
              </a>
            );
          })}
          <a
            href={publicDemoHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[1rem] bg-slate-950 px-4.5 py-2.5 text-[13px] font-semibold leading-none text-white shadow-[0_18px_36px_-24px_rgba(15,23,42,0.85)] transition hover:bg-slate-800"
          >
            Inspect a real site
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
              <DropdownMenuContent align="end" className="w-44">
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
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white p-0 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.8)] xl:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-slate-200 bg-white xl:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 text-sm font-medium text-slate-700">
            <div className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Explore
              </p>
              {primaryNavLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 transition hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <div className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Support
              </p>
              {headerUtilityLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 transition hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <a
              href={publicDemoHref}
              className="inline-flex min-h-11 items-center justify-center rounded-[1rem] bg-slate-950 px-4 py-2.5 text-center font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Inspect a real site
            </a>

            {currentUser ? (
              <>
                <a
                  href="/settings"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-4 py-2.5 text-center text-slate-700"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </a>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 px-4 py-2.5 text-center text-red-600"
                  onClick={async () => {
                    await handleSignOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
