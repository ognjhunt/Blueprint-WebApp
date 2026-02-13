const footerLinks = [
  { label: "How We Certify", href: "/how-it-works" },
  { label: "Solutions", href: "/solutions" },
  { label: "Benchmarks", href: "/evals" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
  { label: "Learn Simulation", href: "/learn" },
  { label: "Docs", href: "/docs" },
  { label: "Artist Portal", href: "/portal" },
  { label: "Pilot Exchange", href: "/pilot-exchange" },
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
            Certified simulation scenes, datasets, and benchmarks for robot learning. Physics gates, quality scores, and provenance metadata in every delivery.
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
          <p>SimReady is a service mark of Blueprint.</p>
        </div>
      </div>
    </footer>
  );
}
