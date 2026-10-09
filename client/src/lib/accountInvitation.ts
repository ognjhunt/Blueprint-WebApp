import { withCsrfHeader } from "./csrf";
export type AccountInvitation = { email: string; name: string; organization: string; workspaceType: "site_operator" | "robot_team"; returnTo: string };
export async function invitationRequest<T>(path: "inspect" | "redeem", invitation: string, details: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`/api/account-invitations/${path}`, { method: "POST", credentials: "include", headers: await withCsrfHeader({ "Content-Type": "application/json" }), body: JSON.stringify({ invitation, ...details }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "We could not check your invitation. Please try again.");
  return data as T;
}
