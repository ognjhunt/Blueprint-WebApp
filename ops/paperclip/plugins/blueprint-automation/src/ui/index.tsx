import {
  useHostContext,
  usePluginAction,
  usePluginData,
  type PluginPageProps,
  type PluginWidgetProps,
} from "@paperclipai/plugin-sdk/ui";
import type { ReactNode } from "react";

type DashboardData = {
  companyId: string;
  companyName: string;
  pluginId: string;
  lastScan: {
    scannedAt?: string;
    repoSummaries?: Array<{
      repoKey: string;
      branch: string;
      changedFiles: number;
      ahead: number;
      behind: number;
    }>;
    errors?: string[];
  } | null;
  recentEvents: Array<{
    id: string;
    kind: string;
    title: string;
    createdAt: string;
    detail?: string;
  }>;
  openManagedIssues: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: string;
  }>;
  sourceMappings: Array<{
    externalId: string | null;
    title: string | null;
    status: string | null;
    issueId: string | null;
    hits: number;
    lastSeenAt: string | null;
  }>;
};

function Surface({ children }: { children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid rgba(15, 23, 42, 0.12)",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      {children}
    </section>
  );
}

function DashboardInner() {
  const context = useHostContext();
  const dashboard = usePluginData<DashboardData>("dashboard", context.companyId ? { companyId: context.companyId } : {});
  const scanNow = usePluginAction("scan-now");

  if (dashboard.loading) return <div>Loading Blueprint automation status...</div>;
  if (dashboard.error) return <div>Blueprint automation error: {dashboard.error.message}</div>;
  if (!dashboard.data) return <div>No Blueprint automation data available.</div>;

  const { data } = dashboard;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Surface>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <strong>{data.companyName}</strong>
            <div style={{ color: "#475569", marginTop: 4 }}>
              Watch updates, not terminals. This page shows the latest automation scan, managed issues, and ingress activity.
            </div>
          </div>
          <button onClick={() => void scanNow({ companyId: data.companyId })}>Run scan now</button>
        </div>
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Surface>
          <strong>Managed issues</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>{data.openManagedIssues.length}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>Open issues created or maintained by Blueprint automation.</div>
        </Surface>
        <Surface>
          <strong>Tracked signals</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>{data.sourceMappings.length}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>External or repo fingerprints currently mapped to Paperclip work.</div>
        </Surface>
        <Surface>
          <strong>Last scan</strong>
          <div style={{ marginTop: 8 }}>{data.lastScan?.scannedAt ?? "Never"}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            {data.lastScan?.errors?.length
              ? `${data.lastScan.errors.length} scan error(s) need review`
              : "Most recent repo and workflow reconciliation timestamp."}
          </div>
        </Surface>
      </div>

      <Surface>
        <strong>Repo scan summary</strong>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {(data.lastScan?.repoSummaries ?? []).map((repo) => (
            <div
              key={repo.repoKey}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr repeat(4, minmax(0, 1fr))",
                gap: 8,
                padding: 10,
                borderRadius: 10,
                background: "#f8fafc",
              }}
            >
              <div>
                <strong>{repo.repoKey}</strong>
                <div style={{ color: "#475569" }}>{repo.branch}</div>
              </div>
              <div>changes: {repo.changedFiles}</div>
              <div>ahead: {repo.ahead}</div>
              <div>behind: {repo.behind}</div>
              <div>{repo.changedFiles || repo.ahead || repo.behind ? "needs attention" : "clean"}</div>
            </div>
          ))}
        </div>
      </Surface>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Surface>
          <strong>Recent ingress</strong>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {data.recentEvents.slice(0, 8).map((event) => (
              <div key={event.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <div style={{ fontWeight: 600 }}>{event.title}</div>
                <div style={{ color: "#475569" }}>{event.kind}</div>
                {event.detail ? <div style={{ marginTop: 4 }}>{event.detail}</div> : null}
                <div style={{ color: "#64748b", marginTop: 4 }}>{event.createdAt}</div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface>
          <strong>Open automation issues</strong>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {data.openManagedIssues.slice(0, 8).map((issue) => (
              <div key={issue.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <div style={{ fontWeight: 600 }}>{issue.title}</div>
                <div style={{ color: "#475569" }}>
                  {issue.status} · {issue.priority}
                </div>
                <div style={{ color: "#64748b", marginTop: 4 }}>{issue.updatedAt}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}

export function BlueprintAutomationPage(_props: PluginPageProps) {
  return <DashboardInner />;
}

export function BlueprintAutomationDashboardWidget(_props: PluginWidgetProps) {
  return (
    <Surface>
      <strong>Blueprint automation</strong>
      <div style={{ color: "#475569", marginTop: 4, marginBottom: 12 }}>
        Automation status for repo drift, CI failures, and operator signal intake.
      </div>
      <DashboardInner />
    </Surface>
  );
}
