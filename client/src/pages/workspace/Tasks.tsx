import { useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { Frame, ActionLink, Empty } from "@/components/workspace/WorkspaceUI";
import { TaskRows } from "./Overview";
export default function Tasks() {
  const query = useWorkspace(),
    [search, setSearch] = useState("");
  const tasks = (query.data?.tasks || []).filter(
    (task) =>
      !task.archived &&
      `${task.title} ${task.siteName} ${task.location}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <Frame
      query={query}
      active="tasks"
      title="Your tasks"
      action={
        <ActionLink href="/contact/site-operator" primary>
          Request a task
        </ActionLink>
      }
    >
      {query.data?.role !== "site_operator" && !tasks.length ? (
        <Empty
          title="Browse site openings"
          href="/app/opportunities"
          action="Browse openings"
        >
          Openings are available in your robot-team workspace.
        </Empty>
      ) : (
        <>
          <input
            className="ws-search"
            type="search"
            aria-label="Search your tasks"
            placeholder="Search tasks or sites"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {tasks.length ? (
            <TaskRows tasks={tasks} />
          ) : (
            <Empty
              title={search ? "No matching tasks" : "Start with one task"}
              href={search ? undefined : "/contact/site-operator"}
              action="Request a task"
            >
              {search
                ? "Try another task name or site."
                : "Request a capture and evaluation for the work you want to automate."}
            </Empty>
          )}
        </>
      )}
    </Frame>
  );
}
