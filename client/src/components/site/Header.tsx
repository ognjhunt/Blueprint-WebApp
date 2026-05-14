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
import { BrandLockup } from "./BrandMark";
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

        <div className="hidden items-center gap-4 xl:flex">
          <a
            href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=header"
            className="inline-flex items-center justify-center whitespace-nowrap border border-[#c7a775]/55 bg-[#c7a775] px-[1.125rem] py-2.5 text-[13px] font-semibold leading-none text-[#0d0d0b] transition hover:bg-[#d8bd8d]"
          >
            Request world model
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
              href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=mobile-header"
              className="inline-flex min-h-11 items-center justify-center rounded-none border border-[#c7a775]/55 bg-[#c7a775] px-4 py-2.5 text-center font-semibold text-[#0d0d0b]"
              onClick={() => setOpen(false)}
            >
              Request world model
            </a>

            {currentUser ? (
              <>
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
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
