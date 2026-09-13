import { useState } from "react";
import { useWorkspace, money } from "@/lib/workspace";
import { usePilotOpportunities } from "@/lib/pilotOpportunities";
import {
  Frame,
  Empty,
  ActionLink,
  TargetLine,
} from "@/components/workspace/WorkspaceUI";
export default function Openings() {
  const query = useWorkspace(),
    feed = usePilotOpportunities(),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const types = Array.from(
    new Set(feed.opportunities.map((item) => item.site_type).filter(Boolean)),
  );
  const items = feed.opportunities.filter(
    (item) =>
      `${item.workflow} ${item.site_type}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "all" || item.site_type === filter),
  );
  return (
    <Frame query={query} active="opportunities" title="Openings">
      {query.data?.role !== "robot_team" ? (
        <Empty title="Your site tasks" href="/app/tasks" action="Your tasks">
          Manage openings and review robot-team results from your task pages.
        </Empty>
      ) : (
        <>
          <p className="ws-muted" style={{ marginBottom: 26 }}>
            Find a task for your robot.
          </p>
          <input
            className="ws-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search openings"
            placeholder="Search tasks or site types"
          />
          <div
            className="ws-tabs"
            role="tablist"
            aria-label="Opening categories"
          >
            <button
              role="tab"
              aria-selected={filter === "all"}
              tabIndex={filter === "all" ? 0 : -1}
              onClick={() => setFilter("all")}
            >
              All openings
            </button>
            {types.map((type) => (
              <button
                role="tab"
                key={type}
                aria-selected={filter === type}
                tabIndex={filter === type ? 0 : -1}
                onClick={() => setFilter(type!)}
              >
                {type}
              </button>
            ))}
          </div>
          {feed.isLoading ? (
            <p role="status">Loading openings…</p>
          ) : feed.error ? (
            <div role="alert" className="ws-alert">
              {feed.error.message}
            </div>
          ) : items.length ? (
            <div className="ws-openings">
              {items.map((item) => (
                <article className="ws-opening" key={item.opportunity_id}>
                  <figure className="ws-opening-art">
                    <img src="/images/site-led/auth/packing.webp" alt="" />
                    <figcaption>Illustration</figcaption>
                  </figure>
                  <h2>{item.workflow}</h2>
                  <p>{item.site_type || "Site task"}</p>
                  {item.anonymized_summary !== item.workflow && (
                    <p>{item.anonymized_summary}</p>
                  )}
                  <div className="ws-target-strip">
                    <TargetLine
                      terms={
                        item.task_targets || {
                          successRate: null,
                          cycleTimeSeconds: null,
                        }
                      }
                    />
                  </div>
                  <p style={{ marginTop: 18 }}>
                    Pilot budget: {money(item.pilot_budget_usd ?? null)}
                  </p>
                  <ActionLink
                    href={`/app/opportunities/${encodeURIComponent(item.opportunity_id)}`}
                  >
                    View opening
                  </ActionLink>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title={
                search || filter !== "all"
                  ? "No matching openings"
                  : "No openings available yet"
              }
            >
              {search || filter !== "all"
                ? "Try another task or site type."
                : "Openings appear here when the site has approved access and the task is ready for evaluation."}
            </Empty>
          )}
        </>
      )}
    </Frame>
  );
}
