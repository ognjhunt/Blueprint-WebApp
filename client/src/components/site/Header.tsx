import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCOUNT_LINK, primaryNavLinks, SIGN_IN_LABEL } from "./navigation";

/**
 * The Runway header (staff operations pages, and a moment on a redirect). It carries the same links as the public
 * pages' header (`MinimalSiteLayout`), from the same model (`navigation.ts`): How it works, Find jobs, and Your account
 * or Sign in (launch copy, 2026-11-20).
 */
export function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { currentUser } = useAuth();
  const signedIn = Boolean(currentUser);
  const links = primaryNavLinks(signedIn);
  const account = signedIn ? ACCOUNT_LINK : { href: "/sign-in", label: SIGN_IN_LABEL };

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

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-8 xl:flex" aria-label="Main navigation">
          {links.map((link) => {
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

        <nav className="hidden items-center gap-4 xl:flex" aria-label="Account">
          <a
            href={account.href}
            className="inline-flex items-center justify-center whitespace-nowrap text-[13px] font-medium leading-none text-runway-mute transition hover:text-runway-text"
          >
            {account.label}
          </a>
        </nav>

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
          <nav className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-sm font-medium text-runway-text" aria-label="Menu">
            {[...links, account].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex min-h-11 items-center border-b border-runway-line px-1 py-3 text-runway-mute transition hover:text-runway-signal"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
