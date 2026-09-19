import type { TaskListingDetails } from "@/types/taskBrowse";
export function TaskFacts({ details }: { details: TaskListingDetails }) {
  const facts = [["Objects", details.objects], ["Site", details.siteType], ["Region", details.region],
    ["Cycle target", details.cycleTarget], ["Pilot timing", details.pilotTiming], ["Pilot budget", details.pilotBudget]];
  return <dl className="ms-task-facts">{facts.filter(([, value]) => value).map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

