import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Banknote, Camera, CheckCircle2, Clock3, ExternalLink } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

type CaptureRecord = {
  id: string;
  target_address: string;
  captured_at: string | null;
  status: string | null;
  estimated_payout_cents: number | null;
};

type Earnings = {
  total_earned_cents: number;
  pending_payout_cents: number;
  scans_completed: number;
};

type PayoutRecord = {
  id: string;
  scheduled_for: string;
  amount_cents: number;
  status: string;
  description: string;
};

type StripeAccountState = {
  onboarding_complete: boolean;
  payouts_enabled: boolean;
  payout_schedule: string;
  missing_evidence?: string[];
};

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusTone(status: string | null | undefined) {
  const normalized = status || "";
  if (["approved", "paid", "active"].includes(normalized)) return "proof" as const;
  if (["rejected", "failed", "needs_recapture", "paused"].includes(normalized)) return "block" as const;
  return "warn" as const;
}

export default function CapturerAccount() {
  const { currentUser, userData } = useAuth();
  const applicationStatus =
    typeof userData?.capturerApplicationStatus === "string" && userData.capturerApplicationStatus.trim()
      ? userData.capturerApplicationStatus.trim()
      : null;
  const isApproved = applicationStatus === "approved" || applicationStatus === "active";
  const query = useQuery({
    queryKey: ["capturer-account", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const headers = await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({}));
      const [capturesResponse, earningsResponse, payoutsResponse, stripeResponse] = await Promise.all([
        fetch("/v1/creator/captures?limit=50", { credentials: "include", headers }),
        fetch("/v1/creator/earnings", { credentials: "include", headers }),
        fetch("/v1/creator/payouts/ledger", { credentials: "include", headers }),
        fetch("/v1/stripe/account", { credentials: "include", headers }),
      ]);
      for (const response of [capturesResponse, earningsResponse, payoutsResponse]) {
        if (!response.ok) throw new Error(`Capturer account data unavailable (${response.status})`);
      }
      return {
        captures: (await capturesResponse.json()) as CaptureRecord[],
        earnings: (await earningsResponse.json()) as Earnings,
        payouts: (await payoutsResponse.json()) as PayoutRecord[],
        stripe: stripeResponse.ok ? ((await stripeResponse.json()) as StripeAccountState) : null,
      };
    },
  });

  async function startPayoutOnboarding() {
    const response = await fetch("/v1/stripe/account/onboarding_link", {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        currentUser,
        await withCsrfHeader({ "Content-Type": "application/json" }),
      ),
    });
    if (!response.ok) throw new Error(`Payout onboarding unavailable (${response.status})`);
    const payload = (await response.json()) as { onboarding_url?: string };
    if (payload.onboarding_url) window.location.assign(payload.onboarding_url);
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink-900 md:px-8">
      <div className="mx-auto flex max-w-[76rem] flex-col gap-7">
        <header className="border-b border-line pb-8">
          <Eyebrow tone="brass" rule>Capture account</Eyebrow>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Your captured-work record</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-500">
                Application, capture review, earnings, and Stripe payout readiness stay separate and come from their owning records.
              </p>
            </div>
            <StatusChip tone={statusTone(applicationStatus)} square>{applicationStatus?.replace(/_/g, " ") || "Not recorded"}</StatusChip>
          </div>
        </header>

        {!applicationStatus ? (
          <ProofBoundary level="info" title="No application state is recorded" icon={Clock3}>
            This account is not linked to a recorded capturer application state. No review,
            approval, assignment, accepted capture, or payout is implied.
          </ProofBoundary>
        ) : !isApproved ? (
          <ProofBoundary level="info" title="Application review is the current gate" icon={Clock3}>
            Your application is {applicationStatus.replace(/_/g, " ")}. No assignment, accepted capture,
            or payout is implied until an operator records approval and a specific assignment is issued.
          </ProofBoundary>
        ) : (
          <ProofBoundary level="info" title="Approved for assignment review" icon={CheckCircle2}>
            Approval opens assignment and payout setup. It does not mean a capture has been assigned,
            accepted, or paid.
          </ProofBoundary>
        )}

        {query.isLoading ? <p className="py-10 text-ink-500">Loading account records…</p> : null}
        {query.error ? <ProofBoundary level="block" title="Account records unavailable">{(query.error as Error).message}</ProofBoundary> : null}
        {query.data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Card pad="lg"><Banknote className="h-5 w-5 text-brass-deep" /><p className="mt-4 text-micro uppercase tracking-eyebrow text-ink-400">Lifetime paid</p><p className="mt-2 font-mono text-3xl">{money(query.data.earnings.total_earned_cents)}</p></Card>
              <Card pad="lg"><Clock3 className="h-5 w-5 text-brass-deep" /><p className="mt-4 text-micro uppercase tracking-eyebrow text-ink-400">Pending payout</p><p className="mt-2 font-mono text-3xl">{money(query.data.earnings.pending_payout_cents)}</p></Card>
              <Card pad="lg"><Camera className="h-5 w-5 text-brass-deep" /><p className="mt-4 text-micro uppercase tracking-eyebrow text-ink-400">Reviewed captures</p><p className="mt-2 font-mono text-3xl">{query.data.earnings.scans_completed}</p></Card>
            </section>

            <Card pad="lg" className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="text-xl font-semibold">Payout setup</h2><p className="mt-2 text-sm text-ink-500">Stripe owns bank-account and payout readiness.</p></div>
                <StatusChip tone={query.data.stripe?.payouts_enabled ? "proof" : "warn"} square>
                  {query.data.stripe
                    ? query.data.stripe.payouts_enabled
                      ? "payouts enabled"
                      : "setup required"
                    : "state unavailable"}
                </StatusChip>
              </div>
              {isApproved && query.data.stripe && !query.data.stripe.payouts_enabled ? (
                <Button variant="action" iconRight={<ExternalLink />} className="w-fit" onClick={startPayoutOnboarding}>Open Stripe payout setup</Button>
              ) : null}
              {!isApproved ? <p className="text-sm text-ink-500">Payout setup opens after application approval.</p> : null}
              {isApproved && !query.data.stripe ? (
                <p className="text-sm text-ink-500">
                  Stripe account state is unavailable. No payout-readiness conclusion can be shown.
                </p>
              ) : null}
            </Card>

            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">Capture history</h2>
              {query.data.captures.length ? query.data.captures.map((capture) => (
                <Card key={capture.id} pad="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold">{capture.target_address}</p><p className="mt-1 font-mono text-xs text-ink-400">{capture.id} · {capture.captured_at ? new Date(capture.captured_at).toLocaleString() : "Time not recorded"}</p></div>
                  <StatusChip tone={statusTone(capture.status)} square>{capture.status?.replace(/_/g, " ") || "Not recorded"}</StatusChip>
                </Card>
              )) : <Card pad="lg"><p className="text-ink-500">No capture submission is recorded for this account.</p></Card>}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">Payout history</h2>
              {query.data.payouts.length ? query.data.payouts.map((payout) => (
                <Card key={payout.id} pad="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">{payout.description}</p>
                    <p className="mt-1 font-mono text-xs text-ink-400">
                      {payout.id} · {new Date(payout.scheduled_for).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">{money(payout.amount_cents)}</span>
                    <StatusChip tone={statusTone(payout.status)} square>{payout.status.replace(/_/g, " ")}</StatusChip>
                  </div>
                </Card>
              )) : <Card pad="lg"><p className="text-ink-500">No payout ledger entry is recorded for this account.</p></Card>}
            </section>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary" iconRight={<ArrowRight />}><a href="/capture-app">Open assignment access</a></Button>
              <Button asChild variant="ghost"><a href="/capture">Review capture rules</a></Button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
