import { SEO } from "@/components/SEO";
import {
  bundleTiers,
  bundleFeatureMatrix,
  premiumCapabilities,
  type BundleTier,
} from "@/data/content";
import {
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Hand,
  Layers,
  MessageSquare,
  Move,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from "lucide-react";

// Icon mapping for premium capabilities
const iconMap: Record<string, React.ReactNode> = {
  brain: <Brain className="h-6 w-6" />,
  "message-square": <MessageSquare className="h-6 w-6" />,
  "check-circle": <CheckCircle2 className="h-6 w-6" />,
  target: <Target className="h-6 w-6" />,
  hand: <Hand className="h-6 w-6" />,
  users: <Users className="h-6 w-6" />,
  layers: <Layers className="h-6 w-6" />,
  cpu: <Cpu className="h-6 w-6" />,
  move: <Move className="h-6 w-6" />,
};

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-pricing"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern-pricing)"
      />
    </svg>
  );
}

function PricingCard({
  tier,
}: {
  tier: (typeof bundleTiers)[0];
}) {
  const isPopular = tier.isFeatured;
  const isEnterprise = tier.isEnterprise;

  return (
    <div
      className={`relative flex flex-col rounded-3xl p-8 shadow-sm ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
        isPopular
          ? "bg-indigo-600 text-white ring-indigo-600 scale-[1.02]"
          : isEnterprise
          ? "bg-zinc-900 text-white ring-zinc-800"
          : "bg-white ring-zinc-200 hover:ring-indigo-200"
      }`}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-4 py-1 text-xs font-bold uppercase tracking-wider text-zinc-900">
            <Sparkles className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3
          className={`text-xl font-bold ${
            isPopular || isEnterprise ? "text-white" : "text-zinc-900"
          }`}
        >
          {tier.name}
        </h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span
            className={`text-4xl font-bold tracking-tight ${
              isPopular || isEnterprise ? "text-white" : "text-zinc-900"
            }`}
          >
            {tier.price}
          </span>
          {tier.priceNote && (
            <span
              className={`text-sm ${
                isPopular || isEnterprise ? "text-white/70" : "text-zinc-500"
              }`}
            >
              /{tier.priceNote}
            </span>
          )}
        </div>
        <p
          className={`mt-4 text-sm leading-relaxed ${
            isPopular || isEnterprise ? "text-white/80" : "text-zinc-600"
          }`}
        >
          {tier.description}
        </p>
      </div>

      {/* Key Stats */}
      <div
        className={`mb-6 grid grid-cols-2 gap-4 rounded-xl p-4 ${
          isPopular
            ? "bg-indigo-500/30"
            : isEnterprise
            ? "bg-zinc-800"
            : "bg-zinc-50"
        }`}
      >
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${
              isPopular || isEnterprise ? "text-white" : "text-zinc-900"
            }`}
          >
            {tier.episodeCount}
          </p>
          <p
            className={`text-xs ${
              isPopular || isEnterprise ? "text-white/70" : "text-zinc-500"
            }`}
          >
            Episodes
          </p>
        </div>
        <div className="text-center border-l border-current/10">
          <p
            className={`text-2xl font-bold ${
              isPopular || isEnterprise ? "text-white" : "text-zinc-900"
            }`}
          >
            {tier.variationCount}
          </p>
          <p
            className={`text-xs ${
              isPopular || isEnterprise ? "text-white/70" : "text-zinc-500"
            }`}
          >
            Variations
          </p>
        </div>
      </div>

      {/* Highlights */}
      <ul className="mb-8 space-y-3 flex-1">
        {tier.highlights.map((highlight) => (
          <li key={highlight} className="flex items-start gap-3 text-sm">
            <CheckCircle2
              className={`mt-0.5 h-5 w-5 shrink-0 ${
                isPopular
                  ? "text-amber-400"
                  : isEnterprise
                  ? "text-emerald-400"
                  : "text-emerald-500"
              }`}
            />
            <span
              className={
                isPopular || isEnterprise ? "text-white/90" : "text-zinc-700"
              }
            >
              {highlight}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href={tier.ctaHref}
        className={`inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
          isPopular
            ? "bg-white text-indigo-600 hover:bg-zinc-100"
            : isEnterprise
            ? "bg-white text-zinc-900 hover:bg-zinc-100"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
      >
        {tier.ctaLabel}
        <ChevronRight className="ml-1 h-4 w-4" />
      </a>
    </div>
  );
}

function FeatureComparisonTable() {
  const tiers: BundleTier[] = ["standard", "pro", "enterprise", "foundation"];
  const tierNames = {
    standard: "Standard",
    pro: "Pro",
    enterprise: "Enterprise",
    foundation: "Foundation",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200">
            <th className="py-4 pr-4 text-left font-semibold text-zinc-900">
              Feature
            </th>
            {tiers.map((tier) => (
              <th
                key={tier}
                className={`px-4 py-4 text-center font-semibold ${
                  tier === "pro" ? "text-indigo-600" : "text-zinc-900"
                }`}
              >
                {tierNames[tier]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bundleFeatureMatrix.map((feature) => (
            <tr
              key={feature.name}
              className="border-b border-zinc-100 hover:bg-zinc-50"
            >
              <td className="py-4 pr-4">
                <p className="font-medium text-zinc-900">{feature.name}</p>
                <p className="text-xs text-zinc-500">{feature.description}</p>
              </td>
              {tiers.map((tier) => (
                <td key={tier} className="px-4 py-4 text-center">
                  {feature.includedIn.includes(tier) ? (
                    <Check className="mx-auto h-5 w-5 text-emerald-500" />
                  ) : (
                    <X className="mx-auto h-5 w-5 text-zinc-300" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PremiumCapabilitiesSection() {
  const immediateCapabilities = premiumCapabilities.filter(
    (c) => c.tier === "immediate"
  );
  const strategicCapabilities = premiumCapabilities.filter(
    (c) => c.tier === "strategic"
  );

  return (
    <section className="space-y-16">
      {/* Immediate Impact */}
      <div className="space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
            <Zap className="h-3 w-3" />
            High-Impact Add-ons
          </div>
          <h3 className="mt-4 text-2xl font-bold text-zinc-900">
            Immediate Value Upgrades
          </h3>
          <p className="mt-2 text-zinc-600">
            Premium capabilities that dramatically enhance your training data
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {immediateCapabilities.map((capability) => (
            <div
              key={capability.slug}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                    {iconMap[capability.icon] || (
                      <Sparkles className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">
                      {capability.title}
                    </h4>
                    <p className="text-sm font-semibold text-indigo-600">
                      {capability.priceRange}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-zinc-600 leading-relaxed mb-4">
                {capability.description}
              </p>

              <ul className="space-y-2">
                {capability.benefits.slice(0, 3).map((benefit) => (
                  <li
                    key={benefit}
                    className="flex items-start gap-2 text-xs text-zinc-600"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Additions */}
      <div className="space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <Layers className="h-3 w-3" />
            Strategic Capabilities
          </div>
          <h3 className="mt-4 text-2xl font-bold text-zinc-900">
            Advanced Training Features
          </h3>
          <p className="mt-2 text-zinc-600">
            Specialized capabilities for complex robotics applications
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
          {strategicCapabilities.map((capability) => (
            <div
              key={capability.slug}
              className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                {iconMap[capability.icon] || <Sparkles className="h-5 w-5" />}
              </div>
              <h4 className="font-bold text-zinc-900 text-sm">
                {capability.shortTitle}
              </h4>
              <p className="mt-1 text-xs font-semibold text-emerald-600">
                {capability.priceRange}
              </p>
              <p className="mt-2 text-xs text-zinc-500 line-clamp-3">
                {capability.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint - SimReady Training Data Bundles"
        description="Choose the right Blueprint bundle for your robotics training needs. From Standard scenes to Foundation-scale datasets with VLA fine-tuning, sim2real validation, and advanced capabilities."
        canonical="/pricing"
      />

      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              Pricing & Bundles
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Training data bundles for every scale
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-zinc-600">
              From single-scene experiments to foundation model training.
              Physics-accurate environments with sim2real validation.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid gap-8 lg:grid-cols-4 mb-24">
            {bundleTiers.map((tier) => (
              <PricingCard key={tier.tier} tier={tier} />
            ))}
          </div>

          {/* Feature Comparison */}
          <section className="mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-zinc-900">
                Compare all features
              </h2>
              <p className="mt-2 text-zinc-600">
                Detailed breakdown of what's included in each tier
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <FeatureComparisonTable />
            </div>
          </section>

          {/* Premium Capabilities */}
          <section className="mb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-zinc-900">
                Premium capabilities
              </h2>
              <p className="mt-2 text-zinc-600">
                Add-on features available with Pro, Enterprise, and Foundation
                tiers
              </p>
            </div>
            <PremiumCapabilitiesSection />
          </section>

          {/* Sim2Real Guarantee Section */}
          <section className="relative overflow-hidden rounded-3xl bg-zinc-900 p-8 sm:p-12 lg:p-16 mb-24">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Sim2Real Validated
                </div>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  85%+ real-world transfer rates
                </h2>
                <p className="text-lg text-zinc-400">
                  Our sim2real validation service guarantees your trained
                  policies will transfer to real hardware. Based on NVIDIA
                  research showing proper domain randomization improves transfer
                  from 5% to 87%.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/contact?interest=sim2real"
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-emerald-600"
                  >
                    Learn about Sim2Real Validation
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white/10 p-6 text-center backdrop-blur-sm">
                  <p className="text-3xl font-bold text-emerald-400">50%</p>
                  <p className="mt-1 text-sm text-zinc-400">Basic Tier</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Domain randomization validation
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-6 text-center backdrop-blur-sm ring-2 ring-emerald-500/50">
                  <p className="text-3xl font-bold text-emerald-400">70%</p>
                  <p className="mt-1 text-sm text-zinc-400">Standard Tier</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    + Physics validation
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-6 text-center backdrop-blur-sm">
                  <p className="text-3xl font-bold text-emerald-400">85%+</p>
                  <p className="mt-1 text-sm text-zinc-400">Premium Tier</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    + Partner lab testing
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ or Contact CTA */}
          <section className="text-center">
            <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-12">
              <h2 className="text-2xl font-bold text-zinc-900">
                Need a custom solution?
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                We work with teams of all sizes, from research labs to
                foundation model companies. Let's discuss your specific
                requirements.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-indigo-700"
                >
                  Talk to Sales
                </a>
                <a
                  href="/environments"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 shadow-sm transition-colors hover:bg-zinc-50"
                >
                  Browse Marketplace
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
