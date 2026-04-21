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
import { primaryNavLinks } from "./navigation";

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

  const handleSignOut = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/94 backdrop-blur-md">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a
          href="/"
          className="inline-flex min-h-11 items-center text-slate-950 transition hover:opacity-90"
        >
          <span className="font-editorial text-[2.1rem] leading-none tracking-[-0.05em]">
            Blueprint
          </span>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-7 xl:flex">
          {primaryNavLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                className={`relative pb-1.5 text-sm font-medium tracking-[-0.01em] transition ${
                  active ? "text-slate-950" : "text-slate-500 hover:text-slate-950"
                }`}
              >
                {link.label}
                <span
                  className={`absolute inset-x-0 bottom-0 h-px origin-center bg-slate-950 transition ${
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 xl:flex">
          <a
            href={publicDemoHref}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-none border border-slate-950 bg-slate-950 px-4.5 py-2.5 text-[13px] font-semibold leading-none text-white shadow-[0_16px_34px_-24px_rgba(15,23,42,0.58)] transition hover:bg-slate-800"
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-none border border-black/10 bg-white p-0 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.5)] xl:hidden"
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
                  className="flex min-h-11 items-center rounded-none border-b border-black/8 px-1 py-3 transition hover:text-slate-950"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>

            <a
              href={publicDemoHref}
              className="inline-flex min-h-11 items-center justify-center rounded-none bg-slate-950 px-4 py-2.5 text-center font-semibold text-white"
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
