const coreLinks = [
  { label: "World Models", href: "/world-models" },
  { label: "Proof", href: "/proof" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Compatibility", href: "/docs" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact?persona=robot-team" },
];

const supportLinks = [
  { label: "Open Public Demo", href: "/world-models/siteworld-f5fd54898cfb" },
  { label: "Capture App", href: "/capture-app" },
  { label: "Governance", href: "/governance" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Sign In", href: "/sign-in" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <div className="max-w-sm space-y-3">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Blueprint
          </a>
          <p className="text-sm leading-6 text-slate-500">
            Blueprint helps robot teams inspect one exact site, choose between the site package and
            hosted evaluation, and move toward deployment with fewer bad assumptions.
          </p>
        </div>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            For Robot Teams
          </p>
          {coreLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="space-y-3 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Support
          </p>
          {supportLinks.map((link) => (
            <a key={link.href} href={link.href} className="block transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Blueprint, Inc. All rights reserved.</p>
          <p>Exact sites. Clear packaging. Fewer surprises before deployment.</p>
        </div>
      </div>
    </footer>
  );
}
