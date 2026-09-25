import type { TaskListingDetails } from "@/types/taskBrowse";
export function TaskFacts({ details }: { details: TaskListingDetails }) {
  const facts: [string, string | undefined][] = [["Objects", details.objects], ["Site", details.siteType], ["Region", details.region],
    ["Cycle target", details.cycleTarget], ["Pilot timing", details.pilotTiming],
    [details.pilotPriceStatus === "site_offer" ? "Site's proposed pilot price" : "Target pilot budget", details.pilotBudget],
    ["Pilot conditions", details.pilotConditions], ["Ongoing price target", details.ongoingTarget]];
  return <dl className="ms-task-facts">{facts.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
