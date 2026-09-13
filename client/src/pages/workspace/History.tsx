import { useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import {
  Frame,
  Empty,
  EvaluationTable,
} from "@/components/workspace/WorkspaceUI";
import { TaskRows } from "./Overview";
export default function History() {
  const query = useWorkspace(),
    [filter, setFilter] = useState("all");
  const site = query.data?.role === "site_operator";
  const tasks = (query.data?.tasks || []).filter(
    (task) =>
      (task.archived ||
        ["pilot", "pilot_complete", "deployed"].includes(task.pilot.state)) &&
      (filter === "all" ||
        (filter === "pilot"
          ? ["pilot", "pilot_complete"].includes(task.pilot.state)
          : task.pilot.state === filter)),
  );
  const evaluations = (query.data?.evaluations || []).filter(
    (item) =>
      item.archived &&
      (filter === "all" ||
        (filter === "selected" ? item.selected : item.outcome === filter)),
  );
  return (
    <Frame query={query} active="history" title="History">
      <div className="ws-tabs" role="tablist" aria-label="History filter">
        {(site
          ? [
              ["all", "All"],
              ["pilot", "Pilots"],
              ["deployed", "Deployments"],
            ]
          : [
              ["all", "All"],
              ["selected", "Selected"],
              ["not_selected", "Not selected"],
            ]
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            tabIndex={filter === value ? 0 : -1}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {site ? (
        tasks.length ? (
          <TaskRows tasks={tasks} />
        ) : (
          <Empty title="No past tasks yet">
            Closed tasks, pilot records, and deployment outcomes will be kept
            here.
          </Empty>
        )
      ) : evaluations.length ? (
        <EvaluationTable evaluations={evaluations} />
      ) : (
        <Empty title="No past evaluations yet">
          Your completed evaluations and pilot decisions will be kept here.
        </Empty>
      )}
    </Frame>
  );
}
