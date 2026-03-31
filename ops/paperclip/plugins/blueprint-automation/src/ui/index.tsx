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
  handoffAnalytics: {
    summary: {
      openCount: number;
      stuckCount: number;
      resolvedCount: number;
      avgLatencyHours: number | null;
      bounceRate: number;
      maxBlockedDepth: number;
    };
    openHandoffs: Array<{
      id: string;
      title: string;
      projectName: string | null;
      status: string;
      priority: string;
      from: string;
      to: string;
      latencyHours: number | null;
      blockedDepth: number;
      isBounced: boolean;
      stuckReason: string | null;
      updatedAt: string;
    }>;
    stuckHandoffs: Array<{
      id: string;
      title: string;
      projectName: string | null;
      status: string;
      priority: string;
      from: string;
      to: string;
      latencyHours: number | null;
      blockedDepth: number;
      isBounced: boolean;
      stuckReason: string | null;
      updatedAt: string;
    }>;
    recentResolvedHandoffs: Array<{
      id: string;
      title: string;
      projectName: string | null;
      status: string;
      priority: string;
      from: string;
      to: string;
      latencyHours: number | null;
      blockedDepth: number;
      isBounced: boolean;
      stuckReason: string | null;
      updatedAt: string;
    }>;
  };
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
        <Surface>
          <strong>Open handoffs</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>{data.handoffAnalytics.summary.openCount}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            Structured cross-agent delegations currently in flight.
          </div>
        </Surface>
        <Surface>
          <strong>Stuck handoffs</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>{data.handoffAnalytics.summary.stuckCount}</div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            Automatically escalated when they stall or miss deadlines.
          </div>
        </Surface>
        <Surface>
          <strong>Handoff latency</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>
            {data.handoffAnalytics.summary.avgLatencyHours === null
              ? "n/a"
              : `${data.handoffAnalytics.summary.avgLatencyHours.toFixed(1)}h`}
          </div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            Average time from structured request to structured response.
          </div>
        </Surface>
        <Surface>
          <strong>Bounce rate</strong>
          <div style={{ fontSize: 28, marginTop: 8 }}>
            {(data.handoffAnalytics.summary.bounceRate * 100).toFixed(0)}%
          </div>
          <div style={{ color: "#475569", marginTop: 4 }}>
            Share of handoffs that moved beyond the originally intended owner.
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

      <Surface>
        <strong>Handoff board</strong>
        <div style={{ color: "#475569", marginTop: 4 }}>
          First-class collaboration view for structured agent-to-agent work.
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {data.handoffAnalytics.openHandoffs.slice(0, 10).map((handoff) => (
            <div
              key={handoff.id}
              style={{
                padding: 12,
                borderRadius: 10,
                background: handoff.stuckReason ? "#fff7ed" : "#f8fafc",
                border: handoff.stuckReason ? "1px solid rgba(249, 115, 22, 0.22)" : "1px solid rgba(15, 23, 42, 0.08)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{handoff.title}</div>
              <div style={{ color: "#475569", marginTop: 4 }}>
                {handoff.from} → {handoff.to} · {handoff.status} · {handoff.priority}
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                {handoff.projectName ?? "no project"} · blocked depth {handoff.blockedDepth} · bounce {handoff.isBounced ? "yes" : "no"}
              </div>
              {handoff.latencyHours !== null ? (
                <div style={{ color: "#64748b", marginTop: 4 }}>Latency: {handoff.latencyHours.toFixed(1)}h</div>
              ) : null}
              {handoff.stuckReason ? <div style={{ marginTop: 6 }}>{handoff.stuckReason}</div> : null}
              <div style={{ color: "#64748b", marginTop: 4 }}>{handoff.updatedAt}</div>
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

        <Surface>
          <strong>Resolved handoffs</strong>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {data.handoffAnalytics.recentResolvedHandoffs.slice(0, 8).map((handoff) => (
              <div key={handoff.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <div style={{ fontWeight: 600 }}>{handoff.title}</div>
                <div style={{ color: "#475569" }}>
                  {handoff.from} → {handoff.to} · {handoff.status}
                </div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  {handoff.latencyHours !== null ? `Latency ${handoff.latencyHours.toFixed(1)}h` : "No structured response latency"}
                </div>
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
