import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";

import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

export type TaskEvaluationResultArtifact = {
  artifact_id: string;
  role: string;
  relative_path: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
};

export type TaskEvaluationResultEpisode = {
  episode_id: string;
  episode_kind: "control" | "learned_candidate";
  subject_id: string;
  score: {
    status: string;
    outcome?: unknown;
    task_succeeded?: boolean | null;
    grader_authority: string;
  };
  variation?: {
    cell_id: string;
    family_id: string;
    label?: string;
    partition?: "qualification" | "held_out" | string;
    seed?: number;
  };
  metrics?: {
    contact_count?: number | null;
    duration_seconds?: number | null;
    intervention_count?: number | null;
  };
  failure?: {
    code: string;
    phase?: string;
    summary?: string;
  } | null;
  evidence?: {
    complete?: boolean;
    lossless_policy_inputs_complete?: boolean;
    frame_manifest_digest?: string;
    review_video_digest?: string;
    deterministic_non_policy_grader?: boolean;
  };
  artifacts: {
    receipt: TaskEvaluationResultArtifact;
    frame_manifest: TaskEvaluationResultArtifact;
    videos: Record<"external" | "wrist" | "overview", TaskEvaluationResultArtifact>;
  };
};

export type TaskEvaluationResultDelivery = {
  schema_version: "task_evaluation_result_delivery.v1";
  run_id: string;
  state: "decided" | "partially_decided" | "abstained";
  status: "ready" | "blocked";
  claim_class: "development_only" | "evaluation";
  decision_envelope_digest: string;
  episode_evidence_index_digest?: string;
  stages: Array<{
    stage: "validate" | "seal" | "project" | "package" | "publish";
    status: "complete" | "ready" | "blocked" | "waiting";
  }>;
  blockers: string[];
  summary: {
    episode_count: number;
    learned_candidate_episode_count: number;
    control_episode_count: number;
    successful_episode_count: number;
  };
  episodes: TaskEvaluationResultEpisode[];
  artifacts: TaskEvaluationResultArtifact[];
  proof_boundary: {
    review_video_is_authoritative_evidence: false;
    simulation_is_physical_success: false;
    cross_team_leaderboard_authorized: false;
  };
  delivery_digest: string;
};

export type TaskEvaluationResultSiteRecord = {
  schema_version: "task_evaluation_result_site_record.v1";
  record_id: string;
  organization_id: string;
  access_visibility: "owner_only" | "organization_members";
  created_at_iso?: string;
  updated_at_iso?: string;
  publication: {
    schema_version: "task_evaluation_run_publication.v1" | "task_evaluation_run_publication.v2";
    run_id: string;
    state: "decided" | "partially_decided" | "abstained";
    testbed_digest: string;
    decision_envelope: Record<string, any> & {
      decision_question: string;
      decision_envelope_digest: string;
      overall_outcome: "decision" | "partial_decision" | "abstention";
      per_claim_verdicts: Array<Record<string, any>>;
      unsupported_conditions: string[];
      next_cheapest_experiment: string;
    };
    result_delivery?: TaskEvaluationResultDelivery;
    proof_boundary: Record<string, unknown>;
  };
};

type TaskEvaluationResultList = {
  scope: "owner" | "organization" | "blueprint_operations";
  public_leaderboard: false;
  results: TaskEvaluationResultSiteRecord[];
};

async function authenticatedFetch(currentUser: FirebaseUser, path: string) {
  return fetch(path, {
    credentials: "include",
    headers: await withFirebaseAuthHeaders(currentUser),
  });
}

async function fetchResults(currentUser: FirebaseUser): Promise<TaskEvaluationResultList> {
  const response = await authenticatedFetch(currentUser, "/api/task-evaluation-results");
  if (!response.ok) throw new Error(`Failed to load sealed results (${response.status})`);
  return response.json() as Promise<TaskEvaluationResultList>;
}

async function fetchResult(currentUser: FirebaseUser, recordId: string) {
  const response = await authenticatedFetch(
    currentUser,
    `/api/task-evaluation-results/${encodeURIComponent(recordId)}`,
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load sealed result (${response.status})`);
  return response.json() as Promise<TaskEvaluationResultSiteRecord>;
}

export async function createTaskEvaluationResultArtifactTicket(
  currentUser: FirebaseUser,
  recordId: string,
  artifactId: string,
) {
  const response = await fetch(
    `/api/task-evaluation-results/${encodeURIComponent(recordId)}/artifacts/${encodeURIComponent(artifactId)}`,
    {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(
        currentUser,
        await withCsrfHeader({ "Content-Type": "application/json" }),
      ),
      body: "{}",
    },
  );
  if (!response.ok) throw new Error(`Failed to authorize result artifact (${response.status})`);
  const ticket = await response.json() as { download_url: string };
  return ticket.download_url;
}

export function useTaskEvaluationResults() {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["task-evaluation-results", currentUser?.uid || "anonymous"],
    enabled: Boolean(currentUser && !loading),
    queryFn: () => fetchResults(currentUser!),
    staleTime: 30_000,
  });
  return useMemo(() => ({
    results: query.data?.results || [],
    scope: query.data?.scope || null,
    isLoading: loading || query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  }), [loading, query.data, query.error, query.isLoading]);
}

export function useTaskEvaluationResult(recordId: string) {
  const { currentUser, loading } = useAuth();
  const query = useQuery({
    queryKey: ["task-evaluation-result", currentUser?.uid || "anonymous", recordId],
    enabled: Boolean(currentUser && !loading && recordId),
    queryFn: () => fetchResult(currentUser!, recordId),
    staleTime: 30_000,
  });
  return {
    result: query.data || null,
    notFound: query.isFetched && query.data === null,
    isLoading: loading || query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    currentUser,
  };
}

export function humanBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
