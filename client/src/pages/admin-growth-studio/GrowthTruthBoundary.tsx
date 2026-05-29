export function GrowthTruthBoundary() {
  return (
    <div className="mb-8 grid gap-4 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm lg:grid-cols-[0.7fr_1.3fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Growth truth boundary
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Founder-facing growth work should show what is draft-only, what is mirrored
          for review, and which runtime system actually owns the proof.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border-t border-zinc-200 pt-3">
          <p className="text-sm font-semibold text-zinc-950">Draft-only lane</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Campaign kits and creative runs are draft-only until an approval ledger changes state.
          </p>
        </div>
        <div className="border-t border-zinc-200 pt-3">
          <p className="text-sm font-semibold text-zinc-950">Notion mirror</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Notion is visibility, not execution ownership.
          </p>
        </div>
        <div className="border-t border-zinc-200 pt-3">
          <p className="text-sm font-semibold text-zinc-950">Runtime proof</p>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Integration truth comes from WebApp verification, SendGrid, Meta, Notion, and provider endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
