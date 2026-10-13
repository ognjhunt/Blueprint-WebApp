import ProtectedRoute from "@/components/ProtectedRoute";
import type { AccessRole } from "@/lib/adminAccess";
import { resolveTaskEvaluationLaunchLabToken } from "@/lib/taskEvaluationLaunchLabAccess";
import AdminTaskEvaluationLaunches from "./AdminTaskEvaluationLaunches";

const OPS_ROLES: AccessRole[] = ["admin", "ops"];

/**
 * The launch control room is ops tooling, not a public page. A deployment-gated
 * launch-lab bearer link (enforced server-side) replaces Firebase sign-in in
 * the tab that opened it; everyone else needs an admin or ops role.
 */
export default function TaskEvaluationLaunchesGate() {
  const launchLab = typeof window !== "undefined" && Boolean(resolveTaskEvaluationLaunchLabToken());
  return launchLab
    ? <AdminTaskEvaluationLaunches />
    : <ProtectedRoute requireRoles={OPS_ROLES}><AdminTaskEvaluationLaunches /></ProtectedRoute>;
}
