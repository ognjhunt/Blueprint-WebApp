import type { SiteWorldCard } from "@/data/siteWorlds";

type SiteWorldBadge = {
  label: string;
  tone: string;
};

export function getSiteWorldBadge(site: SiteWorldCard): SiteWorldBadge {
  if (site.id === "siteworld-f5fd54898cfb") {
    return {
      label: "Public walkthrough",
      tone: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  if (site.deploymentReadiness?.qualification_state === "qualified_ready") {
    return {
      label: "Ready to review",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (site.deploymentReadiness?.recapture_required) {
    return {
      label: "Needs refresh",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  if (site.deploymentReadiness?.provider_fallback_only || site.worldLabsPreview?.launchUrl) {
    return {
      label: "Preview available",
      tone: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }

  return {
    label: "Package available",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
  };
}
