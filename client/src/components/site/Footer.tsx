const footerLinks = [
  { label: "World Models", href: "/world-models" },
  { label: "For Robot Teams", href: "/for-robot-teams" },
  { label: "Pricing", href: "/pricing" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "For Site Operators", href: "/for-site-operators" },
  { label: "Capture App", href: "/capture-app" },
  { label: "Careers", href: "/careers" },
  { label: "FAQ", href: "/faq" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Governance", href: "/governance" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact?persona=robot-team" },
  { label: "Sign In", href: "/sign-in" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-sm space-y-3">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Blueprint
          </a>
          <p className="text-sm text-slate-500">
            Blueprint helps robot teams train, evaluate, and generate data on the real site before
            travel or customer time starts.
          </p>
        </div>
        <nav className="grid flex-1 grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-3">
          {footerLinks.map((link) => (
            <a key={link.href} href={link.href} className="transition hover:text-slate-900">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} Blueprint, Inc. All rights reserved.</p>
          <p>Real sites. Grounded world models. Hosted access when the workflow matters.</p>
        </div>
      </div>
    </footer>
  );
}
