import { listCityLaunchActivations, listCityLaunchProspects } from "./cityLaunchLedgers";

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
