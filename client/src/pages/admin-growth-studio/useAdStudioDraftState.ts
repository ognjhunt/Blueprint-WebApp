import { useState } from "react";
import {
  buildDefaultAdStudioMetaDraft,
  buildDefaultAdStudioReviewDraft,
} from "./model";
import type {
  AdStudioFormState,
  AdStudioMetaDraft,
  AdStudioReviewDraft,
  AdStudioRunRecord,
} from "./types";

export type AdStudioDraftState = ReturnType<typeof useAdStudioDraftState>;

export function useAdStudioDraftState(form: AdStudioFormState) {
  const [assetUris, setAssetUris] = useState<Record<string, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, AdStudioReviewDraft>>({});
  const [metaDrafts, setMetaDrafts] = useState<Record<string, AdStudioMetaDraft>>({});

  return {
    getAssetUri(runId: string) {
      return assetUris[runId] || "";
    },
    setAssetUri(runId: string, uri: string) {
      setAssetUris((current) => ({
        ...current,
        [runId]: uri,
      }));
    },
    getReviewDraft(run: AdStudioRunRecord) {
      return reviewDrafts[run.id] || buildDefaultAdStudioReviewDraft(run, form);
    },
    setReviewDraft(run: AdStudioRunRecord, patch: Partial<AdStudioReviewDraft>) {
      setReviewDrafts((current) => ({
        ...current,
        [run.id]: {
          ...(current[run.id] || buildDefaultAdStudioReviewDraft(run, form)),
          ...patch,
        },
      }));
    },
    getMetaDraft(runId: string) {
      return metaDrafts[runId] || buildDefaultAdStudioMetaDraft(form);
    },
    setMetaDraft(runId: string, patch: Partial<AdStudioMetaDraft>) {
      setMetaDrafts((current) => ({
        ...current,
        [runId]: {
          ...(current[runId] || buildDefaultAdStudioMetaDraft(form)),
          ...patch,
        },
      }));
    },
  };
}
