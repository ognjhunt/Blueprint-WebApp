import type { PublicLaunchCity, PublicLaunchCityStatus } from "@/lib/publicLaunchStatus";

export type LaunchAudienceAction = {
  audience: "Robot teams" | "Site operators" | "Capturers";
  label: string;
  href: string;
  note: string;
};

export const launchStatusMeta: Record<
  PublicLaunchCityStatus,
  {
    label: string;
    definition: string;
    markerClassName: string;
    badgeClassName: string;
    haloClassName: string;
  }
> = {
  live: {
    label: "Live",
    definition:
      "Public capture access and approved capture opportunities can be available here.",
    markerClassName: "fill-slate-950 stroke-white",
    badgeClassName: "bg-slate-950 text-white border-slate-950",
    haloClassName: "fill-slate-950/16",
  },
  planned: {
    label: "Planned",
    definition:
      "Blueprint has a launch path for this city, but public capture is not open yet.",
    markerClassName: "fill-slate-500 stroke-white",
    badgeClassName: "bg-slate-200 text-slate-900 border-slate-300",
    haloClassName: "fill-slate-500/18",
  },
  under_review: {
    label: "Under review",
    definition:
      "Research, qualification, and city-launch work are in progress. Public capture is not open.",
    markerClassName: "fill-white stroke-slate-950",
    badgeClassName: "bg-white text-slate-900 border-slate-300",
    haloClassName: "fill-slate-300/26",
  },
};

export function getLaunchAudienceActions(city: PublicLaunchCity): LaunchAudienceAction[] {
  if (city.status === "live") {
    return [
      {
        audience: "Robot teams",
        label: "Book hosted review",
        href: "/book-exact-site-review",
        note: "Start the exact-site evaluation path for this launch city.",
      },
      {
        audience: "Site operators",
        label: "Talk to Blueprint",
        href: "/contact?persona=launch-map",
        note: "Coordinate access, rights, or rollout conversations for this city.",
      },
      {
        audience: "Capturers",
        label: "Open capture app",
        href: "/capture-app",
        note: "Use the app handoff if you already have an invite or access code for a live city.",
      },
    ];
  }

  if (city.status === "planned") {
    return [
      {
        audience: "Robot teams",
        label: "Talk to Blueprint",
        href: "/contact?persona=launch-map",
        note: "Signal buyer demand without implying public capture is open.",
      },
      {
        audience: "Site operators",
        label: "Express site interest",
        href: "/contact?persona=site-operator",
        note: "Share site access or rights interest for a future launch path.",
      },
      {
        audience: "Capturers",
        label: "Join future-city waitlist",
        href: "/signup/capturer?intent=future-city",
        note: "Register interest for the next rollout wave in this city.",
      },
    ];
  }

  return [
    {
      audience: "Robot teams",
      label: "Request launch updates",
      href: "/contact?persona=launch-map",
      note: "Stay close to the review lane without treating the city as launched.",
    },
    {
      audience: "Site operators",
      label: "Talk to Blueprint",
      href: "/contact?persona=launch-map",
      note: "Share site context that could help the city move through review.",
    },
    {
      audience: "Capturers",
      label: "Join future-city waitlist",
      href: "/signup/capturer?intent=future-city",
      note: "Signal interest for later launch consideration. Public capture is not open yet.",
    },
  ];
}
