const footerLinks = [
  { label: "Environments", href: "/environments" },
  { label: "Solutions", href: "/solutions" },
  { label: "Docs", href: "/docs" },
//  { label: "Case Studies", href: "/case-studies" },
  { label: "Pricing", href: "/solutions#pricing" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
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
            Procedural and real-world SimReady environments delivered on robotics timelines.
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
          <p>© {new Date().getFullYear()} Blueprint Labs, Inc. All rights reserved.</p>
          <p>SimReady is a service mark of Blueprint Labs.</p>
        </div>
      </div>
    </footer>
  );
}
