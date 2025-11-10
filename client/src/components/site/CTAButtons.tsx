interface CTAButtonsProps {
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
}

export function CTAButtons({
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: CTAButtonsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <a
        href={primaryHref}
        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
      >
        {primaryLabel}
      </a>
      <a
        href={secondaryHref}
        className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-500"
      >
        {secondaryLabel}
      </a>
    </div>
  );
}
