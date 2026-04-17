import type { SiteWorldCard } from "@/data/siteWorlds";
import { getSiteWorldCommercialStatus } from "@/lib/siteWorldCommercialStatus";

type SiteWorldBadge = {
  label: string;
  tone: string;
};

export function getSiteWorldBadge(site: SiteWorldCard): SiteWorldBadge {
  const status = getSiteWorldCommercialStatus(site);
  return {
    label: status.label,
    tone: status.tone,
  };
}
