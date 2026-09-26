import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";

import { AppShell } from "@/components/blueprint/app/AppShell";
import { BuyerAppEmptyState, BuyerAppErrorState, BuyerAppLoadingState } from "@/components/blueprint/app/BuyerAppStates";
import { OfferingThumbnail } from "@/components/blueprint/app/OfferingThumbnail";
import { ActionLink, Tag } from "@/components/workspace/WorkspaceUI";
import { useAuth } from "@/contexts/AuthContext";
import type { ConfiguredSceneOfferingCard } from "@/lib/configuredSceneOffering";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

function humanize(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

/** One status and one next step per task; the offering's own state decides both. */
function taskState(offering: ConfiguredSceneOfferingCard, developmentAccess = false) {
  const base = `/app/packs/${encodeURIComponent(offering.source_launch_id)}`;
  if (!developmentAccess) {
    return { tag: offering.status === "evaluation_ready" ? "Ready" : offering.status === "configured_controls_pending" ? "Scene checks pending" : "Being prepared",
      action: { label: "Evaluate a task · $99 per policy", href: "/sites" } };
  }
  if (offering.presentation.appearance_review_status === "prepared_scene_ungraded") {
    return { action: { label: "View task", href: `${base}/evaluate?select=team` } };
  }
  if (offering.status === "configured_controls_pending") {
    return {
      tag: "Scene checks pending",
      note: "Results stay unqualified until the scene's checks pass.",
      action: { label: "Run a policy test", href: `${base}/policy-canary` },
    };
  }
  if (offering.status === "evaluation_ready") {
    return { tag: "Ready", tone: "green" as const, action: { label: "Set up an evaluation", href: `${base}/evaluate` } };
  }
  return { tag: "Being prepared" };
}

function appearanceNote(offering: ConfiguredSceneOfferingCard) {
  switch (offering.presentation.appearance_review_status) {
    case "prepared_scene_ungraded":
    case "paused_ungraded":
      return "Scene appearance not reviewed yet.";
    case "human_accepted_with_known_artifacts":
      return "Owner accepted known visual flaws.";
    default:
      return null;
  }
}

export default function SitePacks() {
  const { currentUser, userData } = useAuth();
  const siteOperator = userData?.buyerType === "site_operator";
  const developmentAccess = userData?.role === "ops" || userData?.roles?.includes("ops") || userData?.role === "admin" || userData?.roles?.includes("admin") || false;
  const [offerings, setOfferings] = useState<ConfiguredSceneOfferingCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void withFirebaseAuthHeaders(currentUser)
      .then((headers) => fetch("/api/configured-scene-offerings", { headers, credentials: "include" }))
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Tasks couldn't be loaded.");
        setOfferings(payload.offerings || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [currentUser]);

  return (
    <AppShell active="packs" breadcrumb="tasks">
      <Helmet>
        <title>Tasks · Blueprint</title>
        <meta name="description" content="Tasks your team can test a robot on." />
      </Helmet>
      <header className="ws-heading"><div><h1>Tasks</h1></div></header>
      <p className="mb-6"><Link className="ws-link" href="/app/packs/policy-packet">Choose a G1 development task and policies</Link></p>
      {error ? <BuyerAppErrorState message={error} /> : null}
      {!error && !offerings ? <BuyerAppLoadingState /> : null}
      {offerings && !offerings.length ? (
        <BuyerAppEmptyState
          title="No tasks yet"
          body="Tasks prepared for your team show up here."
          action={siteOperator
            ? <Link className="ws-link" href="/app/tasks">Your tasks</Link>
            : <Link className="ws-link" href="/app/opportunities">See openings</Link>}
        />
      ) : null}
      {offerings?.length ? (
        <>
          <div className="ws-openings" role="list" aria-label="Tasks">
            {offerings.map((offering) => {
              const state = taskState(offering, developmentAccess);
              const appearance = appearanceNote(offering);
              return (
                <article className="ws-opening" role="listitem" key={offering.offering_digest}>
                  <OfferingThumbnail
                    thumbnailUrl={offering.presentation.thumbnail_url}
                    label={`Preview of ${offering.scene_identity.id}`}
                    currentUser={currentUser}
                  />
                  <h2>{humanize(offering.task.identity.id)}</h2>
                  <p>
                    {offering.scene_identity.id}
                    {state.tag ? <> · <Tag tone={state.tone}>{state.tag}</Tag></> : null}
                  </p>
                  {offering.proof_boundary?.test_environment ? <p>{offering.proof_boundary.test_environment.label}</p> : null}
                  {state.note ? <p>{state.note}</p> : null}
                  {appearance ? (
                    <p title={offering.presentation.known_artifacts?.join("; ") || undefined}>{appearance}</p>
                  ) : null}
                  {state.action ? <ActionLink href={state.action.href}>{state.action.label}</ActionLink> : null}
                </article>
              );
            })}
          </div>
          <p className="ws-note">Previews are rendered images of the prepared scene, not photos of the site.</p>
        </>
      ) : null}
    </AppShell>
  );
}
