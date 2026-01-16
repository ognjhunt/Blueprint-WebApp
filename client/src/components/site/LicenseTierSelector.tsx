import { Check, GraduationCap, Building2, Building, ChevronDown, Info } from "lucide-react";
import {
  licenseTiers,
  type LicenseTier,
  type LicenseTierConfig,
  calculateLicensePrice,
} from "@/data/content";

interface LicenseTierSelectorProps {
  basePrice: number;
  selectedTier: LicenseTier;
  onTierChange: (tier: LicenseTier) => void;
  showPrices?: boolean;
  compact?: boolean;
}

const tierIcons: Record<LicenseTier, React.ReactNode> = {
  research: <GraduationCap className="h-4 w-4" />,
  commercial: <Building2 className="h-4 w-4" />,
  enterprise: <Building className="h-4 w-4" />,
};

const tierColors: Record<LicenseTier, { bg: string; border: string; text: string; badge: string }> = {
  research: {
    bg: "bg-blue-50",
    border: "border-blue-500",
    text: "text-blue-700",
    badge: "bg-blue-100 text-blue-700",
  },
  commercial: {
    bg: "bg-indigo-50",
    border: "border-indigo-500",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
  },
  enterprise: {
    bg: "bg-amber-50",
    border: "border-amber-500",
    text: "text-amber-700",
    badge: "bg-amber-100 text-amber-700",
  },
};

export function LicenseTierSelector({
  basePrice,
  selectedTier,
  onTierChange,
  showPrices = true,
  compact = false,
}: LicenseTierSelectorProps) {
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            License Type
          </p>
          <div className="group relative">
            <Info className="h-3.5 w-3.5 text-zinc-400 cursor-help" />
            <div className="absolute right-0 top-full z-10 mt-1 hidden w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg group-hover:block">
              <p className="text-xs text-zinc-600">
                Choose based on your use case. Research is for academic/R&D, Commercial for product development, Enterprise for large-scale deployment.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {licenseTiers.map((tier) => {
            const isSelected = selectedTier === tier.tier;
            const colors = tierColors[tier.tier];
            const price = calculateLicensePrice(basePrice, tier.tier);

            return (
              <button
                key={tier.tier}
                type="button"
                onClick={() => onTierChange(tier.tier)}
                className={`flex-1 rounded-lg border-2 p-2 text-left transition-all ${
                  isSelected
                    ? `${colors.border} ${colors.bg} ring-2 ring-${tier.tier === 'research' ? 'blue' : tier.tier === 'commercial' ? 'indigo' : 'amber'}-500/20`
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`${isSelected ? colors.text : "text-zinc-500"}`}>
                    {tierIcons[tier.tier]}
                  </div>
                  <span className={`text-xs font-medium ${isSelected ? colors.text : "text-zinc-700"}`}>
                    {tier.shortName}
                  </span>
                </div>
                {showPrices && (
                  <div className={`mt-1 text-sm font-bold ${isSelected ? "text-zinc-900" : "text-zinc-700"}`}>
                    ${price.toLocaleString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">Select License Type</p>
        <a
          href="/docs/licensing"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          Compare licenses
        </a>
      </div>

      <div className="space-y-2">
        {licenseTiers.map((tier) => {
          const isSelected = selectedTier === tier.tier;
          const colors = tierColors[tier.tier];
          const price = calculateLicensePrice(basePrice, tier.tier);

          return (
            <button
              key={tier.tier}
              type="button"
              onClick={() => onTierChange(tier.tier)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? `${colors.border} ${colors.bg} ring-2 ring-${tier.tier === 'research' ? 'blue' : tier.tier === 'commercial' ? 'indigo' : 'amber'}-500/20`
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    isSelected ? `${colors.border} ${colors.bg.replace('50', '500')} text-white` : "border-zinc-300"
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className={`${isSelected ? colors.text : "text-zinc-500"}`}>
                    {tierIcons[tier.tier]}
                  </div>
                  <span className="font-semibold text-zinc-900">{tier.name}</span>
                  {tier.tier === "commercial" && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      POPULAR
                    </span>
                  )}
                </div>
                {showPrices && (
                  <span className="text-lg font-bold text-zinc-900">
                    ${price.toLocaleString()}
                  </span>
                )}
              </div>

              <p className="text-xs text-zinc-600 mb-3">{tier.description}</p>

              <div className="space-y-1">
                {tier.features.slice(0, 3).map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-xs text-zinc-600">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
                {tier.features.length > 3 && (
                  <div className="text-xs text-zinc-400 pl-5">
                    +{tier.features.length - 3} more features
                  </div>
                )}
              </div>

              {tier.tier === "enterprise" && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs text-amber-700 font-medium">
                    Contact sales for custom terms, SLA, and volume pricing
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact badge display of selected license
export function LicenseTierBadge({ tier }: { tier: LicenseTier }) {
  const config = licenseTiers.find((t) => t.tier === tier);
  const colors = tierColors[tier];

  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
      {tierIcons[tier]}
      {config.shortName}
    </span>
  );
}
