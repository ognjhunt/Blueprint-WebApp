import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button, Card, Eyebrow, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

/** Mirrors `RobotTeamOutreach` in `server/types/robot-team-registry.ts`. */
type Outreach = {
  contactedOn: string | null;
  channel: "email" | "phone" | "in_person" | "other" | null;
  messageVersion: string | null;
  goAheadEntryOn: string | null;
  answer: "no_reply_yet" | "replied" | "applied" | "not_interested" | "asked_to_stop" | null;
  nextStep: string | null;
  nextStepOn: string | null;
  doNotContact: boolean;
  doNotContactSince: string | null;
  recordedBy: string;
  recordedAtIso: string;
};
type Flag = "no_go_ahead_date" | "no_message_version" | "contacted_after_do_not_contact";
type Row = { teamId: string; name: string; website: string | null; status: string; outreach: Outreach | null; flags: Flag[] };

const ANSWER_WORDS: Record<NonNullable<Outreach["answer"]>, string> = {
  no_reply_yet: "No reply yet", replied: "Replied", applied: "Applied", not_interested: "Not interested", asked_to_stop: "Asked us to stop",
};
const CHANNEL_WORDS: Record<NonNullable<Outreach["channel"]>, string> = { email: "Email", phone: "Phone", in_person: "In person", other: "Other" };
const FLAG_WORDS: Record<Flag, string> = {
  no_go_ahead_date: "No go-ahead date recorded for this contact.",
  no_message_version: "No message version recorded for this contact.",
  contacted_after_do_not_contact: "Contacted after it was marked do not contact.",
};

const inputClass = "border border-line bg-transparent px-3 py-2 text-runway-text";

/** One record's log and the form that changes it. Only fields that changed are sent. */
function OutreachRow({ row, save }: { row: Row; save: (teamId: string, change: Record<string, unknown>) => Promise<string | null> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const o = row.outreach;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => { const value = String(data.get(key) ?? "").trim(); return value || null; };
    const next: Record<string, unknown> = {
      contactedOn: text("contactedOn"), channel: text("channel"), messageVersion: text("messageVersion"),
      goAheadEntryOn: text("goAheadEntryOn"), answer: text("answer"), nextStep: text("nextStep"), nextStepOn: text("nextStepOn"),
    };
    const change: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(next)) if (value !== ((o as Record<string, unknown> | null)?.[key] ?? null)) change[key] = value;
    if (data.get("doNotContact") === "on" && !o?.doNotContact) change.doNotContact = true;
    if (!Object.keys(change).length) return;
    setState("saving"); setProblem(null);
    const failure = await save(row.teamId, change);
    setProblem(failure); setState(failure ? "idle" : "saved");
  }
  return (
    <Card pad="lg" className="flex flex-col gap-4" aria-label={`Outreach for ${row.name}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-runway-text">{row.name}</h2>
          <p className="text-sm text-runway-mute">{row.teamId}{row.website ? ` · ${row.website}` : ""} · {row.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {o?.doNotContact ? <StatusChip tone="block" square>Do not contact{o.doNotContactSince ? ` since ${o.doNotContactSince}` : ""}</StatusChip> : null}
          {o?.answer ? <StatusChip tone="info" square>{ANSWER_WORDS[o.answer]}</StatusChip> : null}
          {o?.contactedOn ? <StatusChip tone="info" square>Contacted {o.contactedOn}</StatusChip> : null}
        </div>
      </div>
      {row.flags.length ? <ul className="grid gap-1 text-sm text-runway-red" aria-label="Flags">{row.flags.map(flag => <li key={flag}>{FLAG_WORDS[flag]}</li>)}</ul> : null}
      <form className="grid gap-3 sm:grid-cols-4" onSubmit={submit} aria-label={`Change outreach for ${row.name}`}>
        <label className="runway-meta flex flex-col gap-1">Contacted on<input name="contactedOn" type="date" defaultValue={o?.contactedOn ?? ""} className={inputClass} /></label>
        <label className="runway-meta flex flex-col gap-1">Channel
          <select name="channel" defaultValue={o?.channel ?? ""} className={inputClass}>
            <option value="">—</option>
            {Object.entries(CHANNEL_WORDS).map(([value, words]) => <option key={value} value={value}>{words}</option>)}
          </select>
        </label>
        <label className="runway-meta flex flex-col gap-1">Message version<input name="messageVersion" maxLength={60} placeholder="company-first.v1" defaultValue={o?.messageVersion ?? ""} className={inputClass} /></label>
        <label className="runway-meta flex flex-col gap-1">Go-ahead entry dated<input name="goAheadEntryOn" type="date" defaultValue={o?.goAheadEntryOn ?? ""} className={inputClass} /></label>
        <label className="runway-meta flex flex-col gap-1">Answer
          <select name="answer" defaultValue={o?.answer ?? ""} className={inputClass}>
            <option value="">—</option>
            {Object.entries(ANSWER_WORDS).map(([value, words]) => <option key={value} value={value}>{words}</option>)}
          </select>
        </label>
        <label className="runway-meta flex flex-col gap-1 sm:col-span-2">Next step<input name="nextStep" maxLength={200} defaultValue={o?.nextStep ?? ""} className={inputClass} /></label>
        <label className="runway-meta flex flex-col gap-1">Next step on<input name="nextStepOn" type="date" defaultValue={o?.nextStepOn ?? ""} className={inputClass} /></label>
        <label className="runway-meta flex items-center gap-2 sm:col-span-2">
          <input name="doNotContact" type="checkbox" defaultChecked={Boolean(o?.doNotContact)} disabled={Boolean(o?.doNotContact)} />
          Do not contact (stays on the record; it cannot be removed here)
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button variant="secondary" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save"}</Button>
          {problem ? <span role="alert" className="text-sm text-runway-red">{problem}</span> : state === "saved" ? <span role="status" className="text-sm text-runway-mute">Saved.</span> : null}
        </div>
      </form>
      {o ? <p className="runway-meta">Last change {new Date(o.recordedAtIso).toLocaleString()} by {o.recordedBy}</p> : null}
    </Card>
  );
}

/**
 * The owner's outreach log on the research list (outreach playbook, section 2). Staff only. Being contacted is not a
 * relationship: nothing here is shown to a site or a company, and a researched company stays a prospect.
 */
export default function AdminOutreach() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "contacted" | "do_not_contact">("all");
  const query = useQuery({
    queryKey: ["admin-robot-team-outreach"],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const response = await fetch("/api/admin/robot-teams/outreach", {
        credentials: "include", headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})) });
      if (!response.ok) throw new Error(`Could not load the outreach log (${response.status})`);
      return response.json() as Promise<{ rows: Row[]; contacted: number; doNotContact: number }>;
    },
  });

  async function save(teamId: string, change: Record<string, unknown>): Promise<string | null> {
    try {
      const response = await fetch(`/api/admin/robot-teams/${encodeURIComponent(teamId)}/outreach`, {
        method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify(change),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return body.error || `The change was not saved (${response.status}).`;
      await queryClient.invalidateQueries({ queryKey: ["admin-robot-team-outreach"] });
      return null;
    } catch {
      return "The change was not saved. Try again.";
    }
  }

  const rows = (query.data?.rows ?? []).filter(row => filter === "all" ? true
    : filter === "contacted" ? Boolean(row.outreach?.contactedOn) : Boolean(row.outreach?.doNotContact));
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink-900 md:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="brass" rule>Deployment companies</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[0.005em] text-runway-text">Outreach log</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-runway-mute">
              Who was written to, when, with which message and under which go-ahead, and what they said. Staff only.
              Being contacted is not a relationship: never describe a company here to anyone as working with Blueprint.
            </p>
            {query.data ? <p className="mt-2 text-sm text-runway-text">{query.data.contacted} contacted · {query.data.doNotContact} do not contact · {query.data.rows.length} records</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="runway-meta flex items-center gap-2">Show
              <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)} className={inputClass} aria-label="Show">
                <option value="all">All</option>
                <option value="contacted">Contacted</option>
                <option value="do_not_contact">Do not contact</option>
              </select>
            </label>
            <Button variant="secondary" iconLeft={<RefreshCw />} onClick={() => query.refetch()}>Refresh</Button>
          </div>
        </header>
        {query.isLoading ? <p className="py-12 text-runway-mute">Loading the outreach log…</p> : null}
        {query.error ? <p className="py-12 text-runway-red" role="alert">{(query.error as Error).message}</p> : null}
        <section className="mt-8 grid gap-4" aria-label="Outreach records">
          {rows.map(row => <OutreachRow key={`${row.teamId}:${row.outreach?.recordedAtIso ?? ""}`} row={row} save={save} />)}
        </section>
      </div>
    </main>
  );
}
