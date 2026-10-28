/** One ordinary task question on the existing job brief, never simulator inputs. */
export interface FamilyTaskQuestion {
  authoringDigest: string;
  requirementId: string;
  operationId: string | null;
  operationLabel: string | null;
  kind: "target" | "hold_seconds" | "task_intent";
  question: string;
  targets: { targetId: string; label: string }[];
  deferred: boolean;
}

export interface FamilyTaskDetail {
  authoringDigest: string;
  operationId: string;
  operationLabel: string;
  targetId: string | null;
  targetLabel: string | null;
  holdSeconds: number | null;
  targets: { targetId: string; label: string }[];
}

export type FamilyTaskAnswer = {
  authoringDigest: string;
  requirementId: string;
  answer: string | number | null;
} | { authoringDigest: string; operationId: string; field: "target" | "hold_seconds"; answer: string | number | null };
