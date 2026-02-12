import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navLinks = [
  { href: "/marketplace/scenes", label: "Scenes" },
  { href: "/marketplace/datasets", label: "Datasets" },
  { href: "/pilot-exchange", label: "Pilot Exchange" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/evals", label: "Benchmarks" },
  { href: "/partners", label: "Partners" },
  { href: "/careers", label: "Careers" },
];

export function Header() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { currentUser, userData, logout } = useAuth();

  const isActive = useMemo(
    () =>
      (href: string) => {
        if (href === "/marketplace/scenes") {
          return (
            location === "/marketplace" ||
            location.startsWith("/marketplace/scenes") ||
            (location.startsWith("/marketplace/") &&
              !location.startsWith("/marketplace/datasets")) ||
            location === "/environments" ||
            location.startsWith("/environments/")
          );
        }
        if (href === "/marketplace/datasets") {
          return location.startsWith("/marketplace/datasets");
        }
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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="/" className="text-lg font-semibold tracking-tight">
          Blueprint
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`transition hover:text-slate-900 ${
                isActive(link.href) ? "text-slate-900" : ""
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/contact"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Request Data
          </a>
          {!currentUser ? (
            <>
              <a
                href="/login"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                Log in
              </a>
            </>
          ) : (
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
          )}
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-slate-200 p-2 md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-sm font-medium text-slate-700">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="py-1"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/contact"
              className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-center text-white"
              onClick={() => setOpen(false)}
            >
              Request Data
            </a>
            {!currentUser ? (
              <>
                <a
                  href="/login"
                  className="rounded-full border border-slate-200 px-4 py-2 text-center text-slate-700"
                  onClick={() => setOpen(false)}
                >
                  Log in
                </a>
              </>
            ) : (
              <>
                <a
                  href="/settings"
                  className="rounded-full border border-slate-200 px-4 py-2 text-center text-slate-700"
                  onClick={() => setOpen(false)}
                >
                  Settings
                </a>
                <button
                  type="button"
                  className="rounded-full border border-red-200 px-4 py-2 text-center text-red-600"
                  onClick={async () => {
                    await handleSignOut();
                    setOpen(false);
                  }}
                >
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
