import type { PublicSiteWorldRecord } from "@/types/inbound-request";

export async function fetchSiteWorldCatalog(limit = 24): Promise<PublicSiteWorldRecord[]> {
  const response = await fetch(`/api/site-worlds?limit=${encodeURIComponent(String(limit))}`);
  if (!response.ok) {
    throw new Error("Failed to load site worlds");
  }
  const payload = (await response.json()) as { items?: PublicSiteWorldRecord[] };
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function fetchSiteWorldDetail(siteWorldId: string): Promise<PublicSiteWorldRecord> {
  const response = await fetch(`/api/site-worlds/${encodeURIComponent(siteWorldId)}`);
  if (!response.ok) {
    throw new Error("Failed to load site world");
  }
  return (await response.json()) as PublicSiteWorldRecord;
}
