import { useState } from "react";
import { Check, Clock, Building, Users, Crown, ChevronDown, Info, Lock } from "lucide-react";
import {
  exclusivityOptions,
  type ExclusivityType,
  type ExclusivityOption,
  calculateExclusivityPrice,
} from "@/data/content";

interface ExclusivityOptionsProps {
  basePrice: number;
  selectedExclusivity: ExclusivityType;
  onExclusivityChange: (type: ExclusivityType) => void;
  showPrices?: boolean;
  collapsed?: boolean;
}

const exclusivityIcons: Record<ExclusivityType, React.ReactNode> = {
  "non-exclusive": <Users className="h-4 w-4" />,
  "time-limited": <Clock className="h-4 w-4" />,
  "category": <Building className="h-4 w-4" />,
  "semi-exclusive": <Lock className="h-4 w-4" />,
  "full-exclusive": <Crown className="h-4 w-4" />,
};

const exclusivityColors: Record<ExclusivityType, { bg: string; border: string; text: string }> = {
  "non-exclusive": {
    bg: "bg-zinc-50",
    border: "border-zinc-400",
    text: "text-zinc-700",
  },
  "time-limited": {
    bg: "bg-blue-50",
    border: "border-blue-500",
    text: "text-blue-700",
  },
  "category": {
    bg: "bg-purple-50",
    border: "border-purple-500",
    text: "text-purple-700",
  },
  "semi-exclusive": {
    bg: "bg-orange-50",
    border: "border-orange-500",
    text: "text-orange-700",
  },
  "full-exclusive": {
    bg: "bg-amber-50",
    border: "border-amber-500",
    text: "text-amber-700",
  },
};

export function ExclusivityOptions({
  basePrice,
  selectedExclusivity,
  onExclusivityChange,
  showPrices = true,
  collapsed: initialCollapsed = true,
}: ExclusivityOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(!initialCollapsed);
  const selectedOption = exclusivityOptions.find((o) => o.type === selectedExclusivity);

  const formatPriceMultiplier = (multiplier: number) => {
    if (multiplier === 1) return "Base price";
    return `${multiplier}x`;
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-900">Exclusivity Options</span>
          {selectedExclusivity !== "non-exclusive" && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
              {selectedOption?.shortName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedExclusivity !== "non-exclusive" && showPrices && (
            <span className="text-xs font-medium text-purple-600">
              +{((selectedOption?.priceMultiplier || 1) - 1) * 100}%
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-2 pt-2">
          <div className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3 border border-zinc-100">
            <Info className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
            <p className="text-xs text-zinc-600">
              By default, datasets are non-exclusive and available to all buyers. Optional exclusivity adds competitive protection at an additional cost.
            </p>
          </div>

          <div className="space-y-2">
            {exclusivityOptions.map((option) => {
              const isSelected = selectedExclusivity === option.type;
              const colors = exclusivityColors[option.type];
              const additionalCost = option.priceMultiplier > 1
                ? calculateExclusivityPrice(basePrice, option.type) - basePrice
                : 0;

              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => onExclusivityChange(option.type)}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? `${colors.border} ${colors.bg} ring-2 ring-${option.type === 'full-exclusive' ? 'amber' : option.type === 'category' ? 'purple' : option.type === 'time-limited' ? 'blue' : option.type === 'semi-exclusive' ? 'orange' : 'zinc'}-500/20`
                      : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        isSelected ? `${colors.border} bg-white` : "border-zinc-300"
                      }`}>
                        {isSelected && (
                          <div className={`h-2 w-2 rounded-full ${colors.border.replace('border', 'bg')}`} />
                        )}
                      </div>
                      <div className={`${isSelected ? colors.text : "text-zinc-500"}`}>
                        {exclusivityIcons[option.type]}
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? "text-zinc-900" : "text-zinc-700"}`}>
                        {option.name}
                      </span>
                    </div>
                    {showPrices && (
                      <span className={`text-sm font-bold ${
                        additionalCost > 0 ? "text-purple-600" : "text-zinc-500"
                      }`}>
                        {additionalCost > 0 ? `+$${additionalCost.toLocaleString()}` : "Included"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 ml-6 text-xs text-zinc-500">{option.description}</p>

                  {option.duration && (
                    <div className="mt-2 ml-6 flex items-center gap-1 text-xs text-blue-600">
                      <Clock className="h-3 w-3" />
                      <span>Duration: {option.duration}</span>
                    </div>
                  )}
                  {option.maxLicenses && (
                    <div className="mt-2 ml-6 flex items-center gap-1 text-xs text-orange-600">
                      <Users className="h-3 w-3" />
                      <span>Max {option.maxLicenses} licenses total</span>
                    </div>
                  )}
                  {option.type === "full-exclusive" && (
                    <div className="mt-2 ml-6 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700">
                      Contact sales for full exclusivity terms
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple badge display of exclusivity status
export function ExclusivityBadge({ type }: { type: ExclusivityType }) {
  const option = exclusivityOptions.find((o) => o.type === type);
  const colors = exclusivityColors[type];

  if (!option || type === "non-exclusive") return null;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
      {exclusivityIcons[type]}
      {option.shortName}
    </span>
  );
}
