import {useMemo, useState, type ChangeEvent, type FormEvent} from "react";
import {Helmet} from "@/lib/helmet";
import {Link, useParams} from "wouter";
import {ArrowLeft, ShieldCheck} from "lucide-react";

import {Button, Eyebrow, ProofBoundary} from "@/components/blueprint";
import {AppShell} from "@/components/blueprint/app/AppShell";
import {useAuth} from "@/contexts/AuthContext";
import {
  COMPANY_POLICY_CONTRACT_TEMPLATE,
  buildCompanyPolicyContractSubmission,
  submitCompanyPolicyCandidate,
} from "@/lib/companyPolicyCandidates";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2.5 text-body-s text-ink-900 shadow-sm outline-none focus:border-action focus:ring-2 focus:ring-action/20";
const labelClass = "text-body-s font-semibold text-ink-800";

export default function PolicyCandidateIntake() {
  const {currentUser} = useAuth();
  const {runId = ""} = useParams<{runId: string}>();
  const [imageRepository, setImageRepository] = useState("");
  const [imageDigest, setImageDigest] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [contractText, setContractText] = useState(() =>
    JSON.stringify(COMPANY_POLICY_CONTRACT_TEMPLATE, null, 2),
  );
  const [registryUsername, setRegistryUsername] = useState("");
  const [registrySecret, setRegistrySecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Record<string, any> | null>(null);
  const idempotencyKey = useMemo(
    () => `company-policy-${crypto.randomUUID()}`,
    [],
  );

  async function loadContractFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      setError("Contract JSON files must be 512 KB or smaller.");
      return;
    }
    try {
      const text = await file.text();
      JSON.parse(text);
      setContractText(JSON.stringify(JSON.parse(text), null, 2));
      setError(null);
    } catch {
      setError("The selected contract file is not valid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);
    setError(null);
    setReceipt(null);
    try {
      const token = await currentUser.getIdTokenResult();
      const companyId = String(token.claims.companyId || token.claims.company_id || "").trim();
      const contract = buildCompanyPolicyContractSubmission({
        contractText,
        companyId,
        imageRepository,
        imageDigest,
        visibility,
      });
      if (visibility === "private" && (!registryUsername.trim() || !registrySecret)) {
        throw new Error("A private image needs a short-lived registry username and token.");
      }
      const result = await submitCompanyPolicyCandidate({
        user: currentUser,
        runId,
        contract,
        idempotencyKey,
        ...(visibility === "private"
          ? {
              registryCredential: {
                username: registryUsername.trim(),
                secret: registrySecret,
                expiresInSeconds: 300,
              },
            }
          : {}),
      });
      setRegistrySecret("");
      setReceipt(result);
    } catch (caught) {
      setRegistrySecret("");
      setError(caught instanceof Error ? caught.message : "The policy container could not be admitted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="runs" breadcrumb={`runs / ${runId} / policy container`}>
      <Helmet>
        <title>Bring your policy container · Blueprint</title>
        <meta name="description" content="Admit a digest-pinned company policy container without launching it." />
      </Helmet>
      <form onSubmit={submit} className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link href={`/app/runs/${encodeURIComponent(runId)}`} className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 hover:text-ink-800">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Return to run
        </Link>
        <header>
          <Eyebrow tone="brass" rule>Company policy container</Eyebrow>
          <h1 className="mt-2 text-[1.8rem] font-semibold text-ink-900">Your code goes to the testbed—not the testbed to your code</h1>
          <p className="mt-2 max-w-3xl text-body-s text-ink-500">
            Submit one immutable OCI image and its interface contract. This page admits metadata only. It does not rent a GPU, expose scene files, or start an evaluation.
          </p>
        </header>

        <section className="grid gap-4 rounded-md border border-line bg-white p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 className="text-title-m font-semibold text-ink-900">1. Exact container image</h2>
            <p className="mt-1 text-body-s text-ink-500">Use a registry image pinned by digest. Tags and remote policy endpoints are refused.</p>
          </div>
          <label><span className={labelClass}>Image repository</span><input required className={fieldClass} value={imageRepository} onChange={(event) => setImageRepository(event.target.value)} placeholder="registry.example.com/team/policy" /></label>
          <label><span className={labelClass}>Image digest</span><input required className={fieldClass} value={imageDigest} onChange={(event) => setImageDigest(event.target.value)} placeholder="sha256:…" pattern="sha256:[0-9a-f]{64}" /></label>
          <label><span className={labelClass}>Registry visibility</span><select className={fieldClass} value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "private")}><option value="private">Private</option><option value="public">Public</option></select></label>
          <div className="rounded-md bg-inset p-3 text-body-s text-ink-600">Registry origins are allowlisted. Private credentials are leased for five minutes, used once for this exact image pull, and are never placed in the immutable contract.</div>
          {visibility === "private" ? (
            <>
              <label><span className={labelClass}>Registry username</span><input required className={fieldClass} autoComplete="off" value={registryUsername} onChange={(event) => setRegistryUsername(event.target.value)} /></label>
              <label><span className={labelClass}>Short-lived registry token</span><input required type="password" className={fieldClass} autoComplete="new-password" value={registrySecret} onChange={(event) => setRegistrySecret(event.target.value)} /></label>
            </>
          ) : null}
        </section>

        <section className="rounded-md border border-line bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-title-m font-semibold text-ink-900">2. Robot and policy interface contract</h2><p className="mt-1 text-body-s text-ink-500">Start from the Franka + Robotiq HTTP/JSON template or load a contract JSON file. Blueprint validates every joint, camera, action channel, unit, bound, timeout, rights reference, and checkpoint digest.</p></div>
            <label className="cursor-pointer rounded-md border border-line px-3 py-2 text-body-s font-semibold text-ink-700 hover:bg-inset">Load JSON<input type="file" accept="application/json,.json" className="sr-only" onChange={loadContractFile} /></label>
          </div>
          <textarea required spellCheck={false} className={`${fieldClass} min-h-[32rem] font-mono text-[0.72rem]`} value={contractText} onChange={(event) => setContractText(event.target.value)} />
        </section>

        <ProofBoundary level="info" title="Admission is not a launch">
          Blueprint stores a digest-bound, development-only admission receipt. A separate sandbox qualification must prove default-deny egress and synthetic protocol conformance before any real observation can be shown. Paid authority remains false.
        </ProofBoundary>
        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-body-s text-red-800">{error}</p> : null}
        {receipt ? <ProofBoundary level="proof" title="Container admitted without launch" icon={ShieldCheck}>Admission {String(receipt.candidate?.submission_id || "retained")} is stored. Registry secret input was cleared. No provider was contacted and no scene data was released.</ProofBoundary> : null}
        <Button type="submit" variant="action" disabled={submitting}>{submitting ? "Admitting…" : "Admit container (no launch)"}</Button>
      </form>
    </AppShell>
  );
}
