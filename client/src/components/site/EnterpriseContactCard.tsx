import {
  Building,
  MessageSquare,
  Sparkles,
  Settings,
  FileText,
  Shield,
  Clock,
  ChevronRight,
  Layers,
  Zap,
} from "lucide-react";

interface EnterpriseContactCardProps {
  productTitle: string;
  productSlug: string;
  variant?: "inline" | "sidebar" | "full";
}

export function EnterpriseContactCard({
  productTitle,
  productSlug,
  variant = "sidebar",
}: EnterpriseContactCardProps) {
  const contactUrl = `/contact?product=${encodeURIComponent(productSlug)}&interest=enterprise`;

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-50 to-white p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">Need custom terms?</p>
            <p className="text-xs text-zinc-500">Talk to our team about enterprise options</p>
          </div>
        </div>
        <a
          href={contactUrl}
          className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
        >
          Contact Sales
          <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (variant === "full") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">Enterprise & Custom</p>
            <p className="text-sm text-zinc-400">Beyond self-serve options</p>
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-5">
          Need something different? Our team can help with custom requirements, volume licensing, and enterprise agreements.
        </p>

        <div className="grid gap-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Custom Scene Variants</p>
              <p className="text-xs text-zinc-400">New domains, layouts, object distributions</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Custom Annotations</p>
              <p className="text-xs text-zinc-400">Segmentation, keypoints, affordances, contact forces</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-purple-400">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Special License Terms</p>
              <p className="text-xs text-zinc-400">Indemnity, audit rights, on-prem delivery, DPA</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-amber-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Exclusivity Options</p>
              <p className="text-xs text-zinc-400">Time-limited, category, or full exclusivity</p>
            </div>
          </div>
        </div>

        <a
          href={contactUrl}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100"
        >
          <MessageSquare className="h-4 w-4" />
          Talk to Sales
        </a>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Response within 24 hours
        </p>
      </div>
    );
  }

  // Default sidebar variant
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
          <Building className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold text-zinc-900">Enterprise Options</p>
      </div>

      <p className="text-xs text-zinc-600">
        Need custom variants, special license terms, or volume pricing? Our team can help.
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
          <span>Custom scene variants</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Settings className="h-3.5 w-3.5 text-zinc-400" />
          <span>Different annotations</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <FileText className="h-3.5 w-3.5 text-zinc-400" />
          <span>Special license terms</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Shield className="h-3.5 w-3.5 text-zinc-400" />
          <span>Exclusivity options</span>
        </div>
      </div>

      <a
        href={contactUrl}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Contact Sales
      </a>
    </div>
  );
}

// Compact CTA for marketplace cards
export function EnterpriseQuickLink({ productSlug }: { productSlug: string }) {
  return (
    <a
      href={`/contact?product=${encodeURIComponent(productSlug)}&interest=enterprise`}
      className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
    >
      <Building className="h-3 w-3" />
      Enterprise options
      <ChevronRight className="h-2.5 w-2.5" />
    </a>
  );
}

// Banner for top of detail page
export function EnterpriseBanner({ productSlug }: { productSlug: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Need this at scale or with custom terms?</p>
          <p className="text-xs text-zinc-600">Foundation tier includes unlimited scenes, streaming delivery, and custom commissions</p>
        </div>
      </div>
      <a
        href={`/pricing?from=${encodeURIComponent(productSlug)}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shrink-0"
      >
        View Foundation Tier
        <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
