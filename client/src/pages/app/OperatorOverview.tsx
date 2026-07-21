import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

import { Button, Card, DataField, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { Helmet } from "@/lib/helmet";

type OperatorRequest = {
  request_id: string;
  site_name: string | null;
  site_location: string | null;
  site_type: string | null;
  workflow: string | null;
  qualification_state: string;
  opportunity_state: string;
  rights_status: string;
  capture_status: string;
  quote_status: string;
  next_step: string | null;
  access_boundary_outcome: string | null;
  site_claim_outcome: string | null;
  created_at: string | null;
};

type OperatorStatusResponse = {
  ok: true;
  request: OperatorRequest | null;
  proof_boundary: string;
};

function tone(status: string | null | undefined) {
  if (["qualified_ready", "verified", "approved", "paid"].includes(status || "")) return "proof" as const;
  if (["blocked", "rejected", "needs_recapture"].includes(status || "")) return "block" as const;
  return "warn" as const;
}

export default function OperatorOverview() {
  const { currentUser } = useAuth();
  const query = useQuery({
    queryKey: ["operator-status", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const response = await fetch("/api/operator-status/current", {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      if (!response.ok) throw new Error(`Site status unavailable (${response.status})`);
      return response.json() as Promise<OperatorStatusResponse>;
    },
  });

  return (
    <AppShell active="overview" breadcrumb="site status">
      <Helmet><title>Site status · Blueprint</title><meta name="description" content="Request-backed status for a Blueprint site-operator account." /></Helmet>
      <div className="mx-auto flex max-w-[72rem] flex-col gap-7 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><Eyebrow tone="brass" rule>Site operator</Eyebrow><h1 className="mt-3 text-[1.65rem] font-semibold tracking-tight">Your site review record</h1><p className="mt-2 text-body-s text-ink-500">Access, rights, capture, quote, and next-step state from the linked operator request.</p></div>
          <Button asChild variant="action" iconLeft={<Plus />}><Link href="/contact/site-operator">Submit another site</Link></Button>
        </header>
        {query.isLoading ? <BuyerAppLoadingState /> : null}
        {query.error ? <BuyerAppErrorState message={(query.error as Error).message} /> : null}
        {query.data && !query.data.request ? (
          <Card pad="lg" className="flex flex-col gap-4"><ProofBoundary level="info" title="No linked site request yet" icon={Building2}>{query.data.proof_boundary}</ProofBoundary><Button asChild variant="secondary" className="w-fit"><Link href="/contact/site-operator">Start site intake</Link></Button></Card>
        ) : null}
        {query.data?.request ? (
          <>
            <Card pad="lg" className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-xs text-ink-400">{query.data.request.request_id}</p><h2 className="mt-2 text-2xl font-semibold">{query.data.request.site_name || "Site request"}</h2><p className="mt-2 text-sm text-ink-500">{query.data.request.site_type || "Site type pending"} · {query.data.request.site_location || "Location held in request"}</p></div><StatusChip tone={tone(query.data.request.qualification_state)} square>{query.data.request.qualification_state.replace(/_/g, " ")}</StatusChip></div>
              <div className="rounded-md border border-line bg-white">
                <DataField label="Workflow" value={query.data.request.workflow || "Needs operator detail"} mono={false} />
                <DataField label="Rights" value={query.data.request.rights_status.replace(/_/g, " ")} mono={false} />
                <DataField label="Capture" value={query.data.request.capture_status.replace(/_/g, " ")} mono={false} />
                <DataField label="Quote" value={query.data.request.quote_status.replace(/_/g, " ")} mono={false} />
                <DataField label="Next step" value={query.data.request.next_step || "Ops review will record the next step"} mono={false} border={false} />
              </div>
            </Card>
            <ProofBoundary level="info" title="Status boundary" icon={ShieldCheck}>{query.data.proof_boundary}</ProofBoundary>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
