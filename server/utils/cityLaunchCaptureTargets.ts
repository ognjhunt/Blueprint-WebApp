import { listCityLaunchActivations, listCityLaunchCandidateSignals, listCityLaunchProspects } from "./cityLaunchLedgers";

const ACTIVE_ACTIVATION_STATUSES = new Set<string>([
  "activation_ready",
  "executing",
  "proof_live",
  "growth_live",
]);

const CAPTURE_SURFACE_PROSPECT_STATUSES = new Set<string>([
  "approved",
  "onboarded",
  "capturing",
]);

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMetersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function statusPriority(status: string) {
  switch (status) {
    case "capturing":
      return 3;
    case "onboarded":
      return 2;
    case "approved":
      return 1;
    default:
      return 0;
  }
}

export type CityLaunchCaptureTarget = {
  id: string;
  displayName: string;
  sku: "B";
  lat: number;
  lng: number;
  address: string | null;
  demandScore: number | null;
  sizeSqFt: number | null;
  category: string | null;
  launchContext: {
    city: string;
    citySlug: string;
    activationStatus: string;
    prospectStatus: string;
    sourceBucket: string;
    workflowFit: string | null;
    priorityNote: string | null;
    researchBacked: true;
  };
};

export type CreatorLaunchStatus = {
  cities: Array<{
    city: string;
    stateCode: string;
    displayName: string;
    citySlug: string;
    status: "live" | "planned" | "under_review";
    latitude: number | null;
    longitude: number | null;
  }>;
  supportedCities: Array<{
    city: string;
    stateCode: string;
    displayName: string;
    citySlug: string;
  }>;
  statusCounts: {
    live: number;
    planned: number;
    underReview: number;
  };
  currentCity: {
    city: string;
    stateCode: string | null;
    displayName: string;
    citySlug: string | null;
    isSupported: boolean;
    isPubliclyTracked: boolean;
    status: "live" | "planned" | "under_review" | null;
  } | null;
  sourceStatus: {
    cityLaunchActivations: "available" | "unavailable";
    cityLaunchProspects: "available" | "partial" | "unavailable";
    cityLaunchCandidateSignals: "available" | "unavailable";
    warnings: string[];
  };
};

function splitCityLabel(city: string) {
  const [name, stateCode] = city.split(",").map((part) => part.trim());
  return {
    city: name || city.trim(),
    stateCode: stateCode || null,
  };
}

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function averageCoordinates(points: Array<{ lat: number | null; lng: number | null }>) {
  const validPoints = points.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
  ) as Array<{ lat: number; lng: number }>;

  if (!validPoints.length) {
    return { latitude: null, longitude: null };
  }

  const totals = validPoints.reduce(
    (accumulator, point) => ({
      lat: accumulator.lat + point.lat,
      lng: accumulator.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    latitude: Number((totals.lat / validPoints.length).toFixed(4)),
    longitude: Number((totals.lng / validPoints.length).toFixed(4)),
  };
}

function ledgerErrorWarning(source: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return `${source}:${message}`;
}

export function buildUnavailableCreatorLaunchStatus(input: {
  resolvedCity?: { city: string; stateCode?: string | null } | null;
  warning: string;
}): CreatorLaunchStatus {
  const resolvedCity = input.resolvedCity || null;
  return {
    cities: [],
    supportedCities: [],
    statusCounts: {
      live: 0,
      planned: 0,
      underReview: 0,
    },
    currentCity: resolvedCity
      ? {
          city: resolvedCity.city,
          stateCode: resolvedCity.stateCode || null,
          displayName: resolvedCity.stateCode
            ? `${resolvedCity.city}, ${resolvedCity.stateCode}`
            : resolvedCity.city,
          citySlug: null,
          isSupported: false,
          isPubliclyTracked: false,
          status: null,
        }
      : null,
    sourceStatus: {
      cityLaunchActivations: "unavailable",
      cityLaunchProspects: "unavailable",
      cityLaunchCandidateSignals: "unavailable",
      warnings: [input.warning],
    },
  };
}

export async function buildCreatorLaunchStatus(input: {
  resolvedCity?: { city: string; stateCode?: string | null } | null;
}): Promise<CreatorLaunchStatus> {
  const sourceWarnings: string[] = [];
  let activations: Awaited<ReturnType<typeof listCityLaunchActivations>> = [];
  let cityLaunchActivations: CreatorLaunchStatus["sourceStatus"]["cityLaunchActivations"] = "available";
  let cityLaunchProspects: CreatorLaunchStatus["sourceStatus"]["cityLaunchProspects"] = "available";
  let cityLaunchCandidateSignals: CreatorLaunchStatus["sourceStatus"]["cityLaunchCandidateSignals"] = "available";

  try {
    activations = await listCityLaunchActivations();
  } catch (error) {
    cityLaunchActivations = "unavailable";
    cityLaunchProspects = "unavailable";
    sourceWarnings.push(ledgerErrorWarning("cityLaunchActivations", error));
  }

  const activationCoordinates = new Map<string, { latitude: number | null; longitude: number | null }>();
  await Promise.all(
    activations.map(async (activation) => {
      let prospects: Awaited<ReturnType<typeof listCityLaunchProspects>> = [];
      try {
        prospects = await listCityLaunchProspects(activation.city);
      } catch (error) {
        cityLaunchProspects = cityLaunchProspects === "unavailable" ? "unavailable" : "partial";
        sourceWarnings.push(ledgerErrorWarning(`cityLaunchProspects:${activation.citySlug}`, error));
      }
      activationCoordinates.set(
        activation.citySlug,
        averageCoordinates(
          prospects.map((prospect) => ({
            lat: prospect.lat,
            lng: prospect.lng,
          })),
        ),
      );
    }),
  );

  let underReviewSignals: Array<{
    city: string;
    citySlug: string;
    lat: number;
    lng: number;
  }> = [];
  try {
    underReviewSignals = await listCityLaunchCandidateSignals({
      statuses: ["queued", "in_review"],
    });
  } catch (error) {
    cityLaunchCandidateSignals = "unavailable";
    sourceWarnings.push(ledgerErrorWarning("cityLaunchCandidateSignals", error));
    underReviewSignals = [];
  }

  const underReviewCoordinates = new Map<string, { latitude: number | null; longitude: number | null }>();
  const underReviewCities = new Map<string, { city: string; stateCode: string; displayName: string; citySlug: string }>();

  for (const signal of underReviewSignals) {
    const parts = splitCityLabel(signal.city);
    underReviewCities.set(signal.citySlug, {
      city: parts.city,
      stateCode: parts.stateCode || "",
      displayName: signal.city,
      citySlug: signal.citySlug,
    });
  }

  for (const [citySlug] of underReviewCities.entries()) {
    const matchingSignals = underReviewSignals.filter((signal) => signal.citySlug === citySlug);
    underReviewCoordinates.set(
      citySlug,
      averageCoordinates(
        matchingSignals.map((signal) => ({
          lat: signal.lat,
          lng: signal.lng,
        })),
      ),
    );
  }

  const citiesBySlug = new Map<
    string,
    {
      city: string;
      stateCode: string;
      displayName: string;
      citySlug: string;
      status: "live" | "planned" | "under_review";
      latitude: number | null;
      longitude: number | null;
    }
  >();

  for (const activation of activations) {
    const parts = splitCityLabel(activation.city);
    const isLive =
      activation.founderApproved
      || ACTIVE_ACTIVATION_STATUSES.has(activation.status);
    const coordinates = activationCoordinates.get(activation.citySlug)
      || underReviewCoordinates.get(activation.citySlug)
      || { latitude: null, longitude: null };

    citiesBySlug.set(activation.citySlug, {
      city: parts.city,
      stateCode: parts.stateCode || "",
      displayName: activation.city,
      citySlug: activation.citySlug,
      status: isLive ? "live" : "planned",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  }

  for (const [citySlug, city] of underReviewCities.entries()) {
    if (citiesBySlug.has(citySlug)) {
      continue;
    }
    const coordinates = underReviewCoordinates.get(citySlug) || {
      latitude: null,
      longitude: null,
    };
    citiesBySlug.set(citySlug, {
      ...city,
      status: "under_review",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  }

  const cities = Array.from(citiesBySlug.values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName),
  );

  const supportedCities = cities
    .filter((city) => city.status === "live")
    .map((city) => ({
      city: city.city,
      stateCode: city.stateCode,
      displayName: city.displayName,
      citySlug: city.citySlug,
    }));

  const currentCity = input.resolvedCity
    ? (() => {
        const normalizedCity = normalizeToken(input.resolvedCity?.city);
        const normalizedState = normalizeToken(input.resolvedCity?.stateCode || null);
        const match = cities.find((city) =>
          normalizeToken(city.city) === normalizedCity
          && normalizeToken(city.stateCode) === normalizedState,
        );
        return {
          city: input.resolvedCity.city,
          stateCode: input.resolvedCity.stateCode || null,
          displayName: input.resolvedCity.stateCode
            ? `${input.resolvedCity.city}, ${input.resolvedCity.stateCode}`
            : input.resolvedCity.city,
          citySlug: match?.citySlug || null,
          isSupported: match?.status === "live",
          isPubliclyTracked: Boolean(match),
          status: match?.status || null,
        };
      })()
    : null;

  return {
    cities,
    supportedCities,
    statusCounts: {
      live: cities.filter((city) => city.status === "live").length,
      planned: cities.filter((city) => city.status === "planned").length,
      underReview: cities.filter((city) => city.status === "under_review").length,
    },
    currentCity,
    sourceStatus: {
      cityLaunchActivations,
      cityLaunchProspects,
      cityLaunchCandidateSignals,
      warnings: sourceWarnings,
    },
  };
}

export async function buildCityLaunchCaptureTargetFeed(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}) {
  const activations = await listCityLaunchActivations();
  const activeCities = activations.filter((activation) =>
    activation.founderApproved
    || ACTIVE_ACTIVATION_STATUSES.has(activation.status),
  );

  const cityResults = await Promise.all(
    activeCities.map(async (activation) => {
      const prospects = await listCityLaunchProspects(activation.city, {
        statuses: ["approved", "onboarded", "capturing"],
      });
      return { activation, prospects };
    }),
  );

  const targets = cityResults
    .flatMap(({ activation, prospects }) =>
      prospects
        .filter((prospect) =>
          CAPTURE_SURFACE_PROSPECT_STATUSES.has(prospect.status)
          && prospect.lat !== null
          && prospect.lng !== null,
        )
        .map((prospect) => {
          const distanceMeters = distanceMetersBetween(
            { lat: input.lat, lng: input.lng },
            { lat: prospect.lat!, lng: prospect.lng! },
          );
          return {
            distanceMeters,
            target: {
              id: prospect.id,
              displayName: prospect.name,
              sku: "B",
              lat: prospect.lat!,
              lng: prospect.lng!,
              address: prospect.siteAddress || prospect.locationSummary,
              demandScore: prospect.status === "capturing" ? 0.98 : prospect.status === "onboarded" ? 0.92 : 0.85,
              sizeSqFt: null,
              category: prospect.siteCategory,
              launchContext: {
                city: prospect.city,
                citySlug: prospect.citySlug,
                activationStatus: activation.status,
                prospectStatus: prospect.status,
                sourceBucket: prospect.sourceBucket,
                workflowFit: prospect.workflowFit,
                priorityNote: prospect.priorityNote,
                researchBacked: true as const,
              },
            } satisfies CityLaunchCaptureTarget,
          };
        }),
    )
    .filter((entry) => entry.distanceMeters <= input.radiusMeters)
    .sort((left, right) =>
      statusPriority(right.target.launchContext.prospectStatus)
      - statusPriority(left.target.launchContext.prospectStatus)
      || left.distanceMeters - right.distanceMeters,
    )
    .slice(0, input.limit);

  return {
    generatedAt: new Date().toISOString(),
    targets: targets.map((entry) => entry.target),
  };
}

export async function buildCityLaunchUnderReviewFeed(input: {
  lat: number;
  lng: number;
  radiusMeters: number;
  limit: number;
}) {
  const allowedStatuses = new Set(["queued", "in_review"]);
  const candidates = await listCityLaunchCandidateSignals({
    statuses: ["queued", "in_review"],
  });

  return {
    generatedAt: new Date().toISOString(),
    candidates: candidates
      .filter((candidate) => allowedStatuses.has(candidate.status))
      .map((candidate) => ({
        ...candidate,
        distanceMeters: distanceMetersBetween(
          { lat: input.lat, lng: input.lng },
          { lat: candidate.lat, lng: candidate.lng },
        ),
      }))
      .filter((candidate) => candidate.distanceMeters <= input.radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, input.limit),
    };
}
