import { useWorkspace } from "@/lib/workspace";
import { Frame } from "@/components/workspace/WorkspaceUI";
import { TaskBrowse } from "@/components/site/TaskBrowse";

/** The task library inside the workspace, so a signed-in team never drops back to the public site. */
export default function Library() {
  const query = useWorkspace();
  return (
    <Frame query={query} active="opportunities" title="Task library">
      <div className="ws-library"><TaskBrowse inWorkspace /></div>
    </Frame>
  );
}
