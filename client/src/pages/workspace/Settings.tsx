import { useState } from "react";
import { Link, useSearch } from "wouter";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { WorkspaceSetup } from "@/components/workspace/WorkspaceSetup";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace";
import {
  Frame,
  Field,
  Feedback,
  Modal,
  Tag,
  useAction,
} from "@/components/workspace/WorkspaceUI";
import type { RobotSetup } from "@/types/workspace";
function WorkspaceSettings() {
  const query = useWorkspace(),
    action = useAction(query),
    { currentUser, userData, tokenClaims } = useAuth(),
    [tab, setTab] = useState(
      new URLSearchParams(window.location.search).get("tab") === "robots"
        ? "robots"
        : "account",
    ),
    [editing, setEditing] = useState<RobotSetup | "new" | null>(null),
    [removing, setRemoving] = useState<RobotSetup | null>(null);
  const robot = query.data?.role === "robot_team";
  return (
    <Frame query={query} active="settings" title="Settings">
      <Feedback error={action.error} notice={action.notice} />
      {robot && (
        <div className="ws-tabs" role="tablist" aria-label="Settings sections">
          {[
            ["account", "Account"],
            ["robots", "Robots & policies"],
          ].map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => {
                setTab(value);
                setEditing(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {(tab === "account" || !robot) && (
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
            <Field label="Organization">
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
          <section className="ws-section">
            <h2>Security</h2>
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
            <div className="ws-section-title">
              <h2>Workspace</h2>
              <Link className="ws-link" href="/settings?setup=1">
                Change workspace type →
              </Link>
            </div>
            <p className="ws-section">
              {robot ? "Robot-team workspace" : "Site workspace"}
            </p>
            <p className="ws-muted">
              {robot
                ? "Find openings, evaluate your robot, and track pilot decisions."
                : "Manage captures, task evaluations, and pilot decisions."}
            </p>
            {(tokenClaims?.admin === true ||
              tokenClaims?.ops === true ||
              userData?.admin ||
              userData?.ops ||
              ["admin", "ops"].includes(String(userData?.role))) && (
              <p className="ws-note">
                <Link className="ws-link" href="/admin/leads">
                  Open operations →
                </Link>
              </p>
            )}
            {userData?.role === "capturer" && (
              <p className="ws-note">
                <Link className="ws-link" href="/capture-app/account">
                  Open capture account →
                </Link>
              </p>
            )}
          </section>
        </>
      )}
      {tab === "robots" && robot && (
        <>
          <div className="ws-section-title">
            <h2>Saved setups</h2>
            <button className="ws-primary" onClick={() => setEditing("new")}>
              + Add setup
            </button>
          </div>
          {query.data?.setups.length ? (
            <div className="ws-table-wrap">
              <table className="ws-table">
                <thead>
                  <tr>
                    <th>Setup</th>
                    <th>Delivery method</th>
                    <th>Reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.setups.map((setup) => (
                    <tr key={setup.id}>
                      <td>
                        <strong>{setup.name}</strong>
                        <small>
                          {setup.embodiment} · {setup.policyName}{" "}
                          {setup.version}
                        </small>
                      </td>
                      <td>
                        <Tag>{setup.delivery}</Tag>
                      </td>
                      <td style={{ maxWidth: 360, overflowWrap: "anywhere" }}>
                        {setup.reference}
                      </td>
                      <td>
                        <div className="ws-setup-actions">
                          <button onClick={() => setEditing(setup)}>
                            Edit
                          </button>
                          <button onClick={() => setRemoving(setup)}>
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ws-muted">
              Save a robot and policy to use when requesting evaluations.
            </p>
          )}
          {editing && (
            <form
              method="post"
              className="ws-section"
              key={typeof editing === "string" ? "new" : editing.id}
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget),
                  value = (name: string) => String(values.get(name) || "");
                void action.perform(
                  "/setups",
                  {
                    id:
                      editing === "new"
                        ? `setup-${crypto.randomUUID()}`
                        : editing.id,
                    name: value("name"),
                    embodiment: value("embodiment"),
                    policyName: value("policyName"),
                    version: value("version"),
                    delivery: value("delivery"),
                    reference: value("reference"),
                    notes: value("notes"),
                  },
                  () => setEditing(null),
                );
              }}
            >
              <h2>{editing === "new" ? "Add a setup" : "Edit setup"}</h2>
              <div className="ws-fields ws-section">
                {[
                  ["name", "Setup name", "e.g. Atlas M2"],
                  ["embodiment", "Embodiment", "e.g. Mobile manipulator"],
                  ["policyName", "Policy name", "e.g. Packing policy"],
                  ["version", "Version or checkpoint", "e.g. v4.2"],
                ].map(([name, label, placeholder]) => (
                  <Field key={name} label={label}>
                    <input
                      name={name}
                      required
                      maxLength={160}
                      placeholder={placeholder}
                      defaultValue={
                        editing === "new"
                          ? ""
                          : editing[name as keyof RobotSetup]
                      }
                    />
                  </Field>
                ))}
                <Field label="Delivery method" wide>
                  <select
                    name="delivery"
                    defaultValue={
                      editing === "new" ? "checkpoint" : editing.delivery
                    }
                  >
                    <option value="checkpoint">Downloadable checkpoint</option>
                    <option value="container">Container</option>
                    <option value="endpoint">Hosted endpoint</option>
                  </select>
                </Field>
                <Field
                  label="Reference URL"
                  wide
                  hint="Use an HTTPS, OCI, or Docker URL without credentials or query parameters. Keep credentials in the approved secret store."
                >
                  <input
                    name="reference"
                    required
                    maxLength={1000}
                    defaultValue={editing === "new" ? "" : editing.reference}
                    placeholder="https://registry.example.com/team/policy"
                  />
                </Field>
              </div>
              <details className="ws-section">
                <summary>Additional notes</summary>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    maxLength={3000}
                    defaultValue={editing === "new" ? "" : editing.notes}
                  />
                </Field>
              </details>
              <div className="ws-form-actions">
                <button className="ws-primary" disabled={action.pending}>
                  {action.pending ? "Saving…" : "Save setup"}
                </button>
                <button
                  type="button"
                  className="ws-link"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <p className="ws-note">
            Your configurations stay private to your team. Saving a reference
            does not start a test or authorize compute.
          </p>
        </>
      )}
      {removing && (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
        >
          <p>
            Existing evaluation requests keep the configuration submitted at the
            time. This removes it from your saved setups.
          </p>
          <div className="ws-form-actions">
            <button
              className="ws-primary"
              disabled={action.pending}
              onClick={() =>
                action.perform(
                  `/setups/${removing.id}`,
                  undefined,
                  () => setRemoving(null),
                  "DELETE",
                )
              }
            >
              Remove setup
            </button>
            <button className="ws-link" onClick={() => setRemoving(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </Frame>
  );
}

export default function Settings() {
  const search = useSearch();
  const manage = new URLSearchParams(search).get("setup") === "1";
  if (manage)
    return (
      <AppShell active="settings" breadcrumb="Workspace setup">
        <WorkspaceSetup manage />
      </AppShell>
    );
  return <WorkspaceSettings />;
}
