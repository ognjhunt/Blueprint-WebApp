import type {
  MarketplaceSearchRequest,
  MarketplaceSearchResponse,
} from "@/types/marketplace-search";
import { withCsrfHeader } from "@/lib/csrf";

export async function searchMarketplace(
  req: MarketplaceSearchRequest,
): Promise<MarketplaceSearchResponse> {
  const response = await fetch("/api/marketplace/search", {
    method: "POST",
    credentials: "include",
    headers: await withCsrfHeader({ "Content-Type": "application/json" }),
    body: JSON.stringify(req),
  });

  const data = (await response.json().catch(() => null)) as
    | MarketplaceSearchResponse
    | { error?: string; details?: unknown }
    | null;

  if (!response.ok) {
    const message =
      (data && typeof (data as any).error === "string" && (data as any).error) ||
      `Marketplace search failed (${response.status})`;
    throw new Error(message);
  }

  if (!data) {
    throw new Error("Marketplace search returned an empty response");
  }

  return data as MarketplaceSearchResponse;
}

