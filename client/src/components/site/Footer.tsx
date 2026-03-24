const coreLinks = [
  { label: "World Models", href: "/world-models" },
  { label: "Why It Works", href: "/how-it-works" },
  { label: "Public Demo", href: "/world-models/siteworld-f5fd54898cfb" },
  { label: "Sample Deliverables", href: "/sample-deliverables" },
  { label: "Results", href: "/case-studies" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact?persona=robot-team" },
];

const capturerLinks = [
  { label: "Capture Basics", href: "/capture" },
  { label: "Capture App", href: "/capture-app" },
];

const supportLinks = [
  { label: "Governance", href: "/governance" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Sign In", href: "/sign-in" },
];

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/70">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div className="max-w-sm space-y-3">
          <a href="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Blueprint
          </a>
          <p className="text-sm leading-6 text-slate-500">
            Blueprint helps robot teams ground evals on the exact site, compare the package with
            hosted runtime, and pull back the outputs they need before travel or deployment.
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
            For Capturers
          </p>
          {capturerLinks.map((link) => (
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
          <p>Exact sites. Controlled variation. Fewer surprises before deployment.</p>
        </div>
      </div>
    </footer>
  );
}
