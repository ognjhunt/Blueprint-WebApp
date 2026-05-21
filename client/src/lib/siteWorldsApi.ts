import type { PublicSiteWorldRecord } from "@/types/inbound-request";
import type { SiteWorldCard } from "@/data/siteWorlds";

export type PublicSiteWorldSearchResult = {
  siteWorld: SiteWorldCard;
  score: number;
  reasons: string[];
  matchedAliases: string[];
  matchedFields: string[];
};

export type PublicSiteWorldSearchResponse = {
  query: string;
  results: PublicSiteWorldSearchResult[];
  warnings: string[];
  meta: {
    backend: "firestore-live" | "static-fallback";
    embeddingModel: string;
    usedEmbeddings: boolean;
    totalCandidates: number;
    returned: number;
  };
};

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

export async function searchSiteWorldCatalog(
  query: string,
  limit = 8,
): Promise<PublicSiteWorldSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });
  const response = await fetch(`/api/site-worlds/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to search site worlds");
  }
  const payload = (await response.json()) as Partial<PublicSiteWorldSearchResponse>;
  return {
    query: payload.query || query,
    results: Array.isArray(payload.results) ? payload.results : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    meta: payload.meta || {
      backend: "static-fallback",
      embeddingModel: "",
      usedEmbeddings: false,
      totalCandidates: 0,
      returned: 0,
    },
  };
}
