import { UpdatePreferencesForm } from "@/components/workspace/UpdatePreferencesForm";
import AccountDeletion from "@/components/AccountDeletion";
import { Link, useSearch } from "wouter";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { WorkspaceSetup } from "@/components/workspace/WorkspaceSetup";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace";
import {
  Frame,
  Field,
  Feedback,
  useAction,
} from "@/components/workspace/WorkspaceUI";
function WorkspaceSettings() {
  const query = useWorkspace(),
    action = useAction(query),
    { currentUser } = useAuth();
  const robot = query.data?.role === "robot_team";
  return (
    <Frame query={query} active="settings" title="Settings">
      <Feedback error={action.error} notice={action.notice} />
      <>
          <h2>Account</h2>
          <form
            method="post"
            className="ws-form ws-account-form ws-section"
            key={query.data?.profile.email}
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              void action.perform(
                "/profile",
                {
                  name: String(values.get("name") || ""),
                  organization: String(values.get("organization") || ""),
                },
                undefined,
                "PATCH",
              );
            }}
          >
            <Field label="Your name">
              <input
                name="name"
                autoComplete="name"
                required
                maxLength={160}
                defaultValue={query.data?.profile.name}
              />
            </Field>
            <Field label={robot ? "Company" : "Business name"}>
              <input
                name="organization"
                autoComplete="organization"
                required
                maxLength={160}
                defaultValue={query.data?.profile.organization}
              />
            </Field>
            <Field label="Email" hint="Your sign-in email">
              <input
                type="email"
                value={query.data?.profile.email || ""}
                readOnly
              />
            </Field>
            <div className="ws-form-actions">
              <button className="ws-primary" disabled={action.pending}>
                {action.pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
          <UpdatePreferencesForm preferences={query.data?.profile.updatePreferences} pending={action.pending} jobEmails={robot} save={input => { void action.perform("/update-preferences", input, undefined, "PATCH"); }} />
          <section className="ws-section">
            <h2>Security</h2>
            <p className="ws-note"><Link className="ws-link" href="/settings?privacy=1">Delete my account and data →</Link></p>
            <dl className="ws-facts">
              <div>
                <dt>Password</dt>
                <dd>
                  <Link href="/forgot-password" className="ws-link">
                    Reset password →
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Email status</dt>
                <dd>
                  {currentUser?.emailVerified ? (
                    "Verified"
                  ) : (
                    <button
                      className="ws-link"
                      onClick={async () => {
                        try {
                          if (!currentUser) return;
                          const { sendEmailVerification } =
                            await import("firebase/auth");
                          await sendEmailVerification(currentUser);
                          action.setNotice(
                            "Verification email sent. Follow the link, then sign in again.",
                          );
                        } catch {
                          action.setError(
                            "Could not send a verification email. Please try again.",
                          );
                        }
                      }}
                    >
                      Send verification email
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="ws-section">
            <h2>Account type</h2>
            <p className="ws-section">
              {robot ? "Deployment company account" : "Site account"}
            </p>
          </section>
      </>
    </Frame>
  );
}

export default function Settings() {
  const search = useSearch();
  if (new URLSearchParams(search).get("privacy") === "1")
    return <AppShell active="settings" breadcrumb="Account privacy"><AccountDeletion /></AppShell>;
  const manage = new URLSearchParams(search).get("setup") === "1";
  if (manage)
    return (
      <AppShell active="settings" breadcrumb="Account setup">
        <WorkspaceSetup manage />
        <p className="ws-note"><Link className="ws-link" href="/settings?privacy=1">Delete my account and data →</Link></p>
      </AppShell>
    );
  return <WorkspaceSettings />;
}
