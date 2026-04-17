export type SupportedLaunchCity = {
  city: string;
  stateCode: string;
  displayName: string;
  citySlug: string;
};

export type PublicLaunchStatus = {
  ok: true;
  supportedCities: SupportedLaunchCity[];
  currentCity: {
    city: string;
    stateCode: string | null;
    displayName: string;
    citySlug: string | null;
    isSupported: boolean;
  } | null;
};

let cachedStatus: PublicLaunchStatus | null = null;
let inflightStatusRequest: Promise<PublicLaunchStatus> | null = null;

export async function fetchPublicLaunchStatus(input?: {
  city?: string | null;
  stateCode?: string | null;
}) {
  const city = input?.city?.trim() || "";
  const stateCode = input?.stateCode?.trim() || "";
  const isGenericRequest = !city && !stateCode;

  if (isGenericRequest && cachedStatus) {
    return cachedStatus;
  }

  if (isGenericRequest && inflightStatusRequest) {
    return inflightStatusRequest;
  }

  const query = new URLSearchParams();
  if (city) {
    query.set("city", city);
  }
  if (stateCode) {
    query.set("state_code", stateCode);
  }

  const request = fetch(`/api/public/launch/status${query.size ? `?${query.toString()}` : ""}`);
  const promise = request.then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to load launch status: ${response.status}`);
    }

    const payload = (await response.json()) as PublicLaunchStatus;
    if (isGenericRequest) {
      cachedStatus = payload;
    }
    return payload;
  });

  if (isGenericRequest) {
    inflightStatusRequest = promise.finally(() => {
      inflightStatusRequest = null;
    });
  }

  return promise;
}

export function joinLaunchCityLabels(cities: SupportedLaunchCity[]) {
  const labels = cities.map((city) => city.displayName);
  if (!labels.length) {
    return "city by city";
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function findLaunchCityBySlug(cities: SupportedLaunchCity[], citySlug: string) {
  return cities.find((city) => city.citySlug === citySlug) || null;
}
