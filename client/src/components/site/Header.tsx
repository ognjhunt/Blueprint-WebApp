import { useLocation } from "wouter";
import { useMemo, useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/environments", label: "Environments" },
  // { href: "/recipes", label: "Scene Recipes" }, // Hidden: recipes temporarily removed from offerings
  { href: "/solutions", label: "Solutions" },
  { href: "/pricing", label: "Pricing" },
  { href: "/learn", label: "New to Simulation?" },
  { href: "/docs", label: "Docs" },
  { href: "/portal", label: "Portal" },
 // { href: "/case-studies", label: "Case Studies" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = useMemo(
    () =>
      (href: string) =>
        location === href || (href !== "/" && location.startsWith(href)),
    [location],
  );

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
        <div className="hidden md:flex">
          <a
            href="/contact"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Request a Scene
          </a>
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
              Request a Scene
            </a>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
