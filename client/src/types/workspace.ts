import type { UpdatePreferences } from "./updatePreferences";
export type WorkspaceRole = "site_operator" | "robot_team";
/**
 * A development-only 3D preview made from the site's own recording (beta,
 * unscaled). Absent once recording consent is withdrawn. `statusText` is plain
 * copy; `downloadAvailable` only while the preview is ready and consent stands.
 */
export type AtlasPreviewView = {
  captureId: string;
  label: string;
  state: "processing" | "ready" | "needs_input" | "failed";
  statusText: string;
  developmentOnly: true;
  splatAvailable: boolean;
  meshAvailable: boolean;
  sizeBytes: number | null;
  updatedAtIso: string | null;
  downloadAvailable: boolean;
  /** View-only, in the vendored SuperSplat viewer: a ready preview with a splat. */
  viewAvailable: boolean;
};
/** One row of the account's "Your jobs" list; the job page holds everything else. */
export type WorkspaceTask = {
  id: string;
  title: string;
  siteName: string;
  location: string;
  archived: boolean;
  recordingPermissionWithdrawn: boolean;
  createdAt: string | null;
};
export type WorkspaceSnapshot = {
  role: WorkspaceRole;
  profile: { name: string; organization: string; email: string; updatePreferences?: UpdatePreferences | null };
  tasks: WorkspaceTask[];
};

export type WorkspaceAccountSetup = {
  workspaceType: WorkspaceRole | null;
  siteIntakeRequired?: boolean;
  profile: { name: string; organization: string; email: string; updatePreferences?: UpdatePreferences | null };
  termsRequired: boolean;
  access: { operations: boolean };
};
