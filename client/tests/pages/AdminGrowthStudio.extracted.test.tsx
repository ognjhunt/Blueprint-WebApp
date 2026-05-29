import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildDefaultAdStudioMetaDraft,
  buildDefaultAdStudioReviewDraft,
  parseLineList,
} from "@/pages/admin-growth-studio/model";
import { ShipBroadcastApprovalQueuePanel } from "@/pages/admin-growth-studio/ShipBroadcastApprovalQueuePanel";
import { useAdStudioDraftState } from "@/pages/admin-growth-studio/useAdStudioDraftState";
import type { AdStudioFormState, AdStudioRunRecord } from "@/pages/admin-growth-studio/types";

const baseAdStudioForm: AdStudioFormState = {
  lane: "capturer",
  audience: "public indoor capturers",
  city: "Atlanta",
  cta: "Apply to capture public indoor spaces",
  budgetCapUsd: "250",
  aspectRatio: "9:16",
  allowedClaims: "Illustrative scenes allowed",
  blockedClaims: "No fabricated proof\nNo fake earnings\nNo fake captured sites",
  firstFrameUrl: "",
  reviewHeadline: "Capture public indoor spaces near you",
  reviewPrimaryText: "Real proof claims stay evidence-gated.",
  metaAccountId: "",
  metaPageId: "",
  metaVideoId: "",
  metaProvider: "graph_api",
  metaMediaPath: "",
  metaMediaType: "video",
  metaCallToAction: "learn_more",
  metaDestinationUrl: "https://tryblueprint.io/capture",
  metaCampaignName: "Blueprint Capturer Draft",
};

const baseAdStudioRun: AdStudioRunRecord = {
  id: "ad-run-1",
  lane: "capturer",
  status: "draft_requested",
  audience: "public indoor capturers",
  cta: "Apply now",
  city: "Atlanta",
  aspectRatio: "9:16",
  claimsLedger: {
    allowedClaims: ["Illustrative scenes allowed"],
    blockedClaims: ["No fabricated proof"],
    evidenceLinks: [],
    reviewDecision: "pending",
    reviewNotes: [],
  },
  brief: null,
  promptPack: {
    imagePromptVariants: ["Proof-led first-frame concept"],
    videoPrompt: "Slow push through a public indoor capture path.",
    headlineOptions: ["Capture public indoor spaces"],
    primaryTextOptions: ["Apply to capture real spaces with proof gates."],
  },
  assets: [],
  imageExecutionHandoff: null,
  videoTask: null,
  review: {
    status: "pending",
    reasons: [],
    headline: null,
    primaryText: null,
  },
  metaDraft: {
    campaignId: null,
    adSetId: null,
    adId: null,
    status: "not_created",
  },
  createdAtIso: "2026-04-23T15:00:00.000Z",
  updatedAtIso: "2026-04-23T15:00:00.000Z",
};

describe("AdminGrowthStudio extracted model and panels", () => {
  it("keeps Ad Studio transient drafts isolated by run", () => {
    const { result } = renderHook(() => useAdStudioDraftState(baseAdStudioForm));

    expect(result.current.getAssetUri(baseAdStudioRun.id)).toBe("");
    expect(result.current.getReviewDraft(baseAdStudioRun)).toEqual({
      headline: "Capture public indoor spaces",
      primaryText: "Apply to capture real spaces with proof gates.",
    });
    expect(result.current.getMetaDraft(baseAdStudioRun.id)).toEqual(
      buildDefaultAdStudioMetaDraft(baseAdStudioForm),
    );

    act(() => {
      result.current.setAssetUri(baseAdStudioRun.id, "gs://blueprint/ad-run-1/frame.png");
      result.current.setReviewDraft(baseAdStudioRun, { headline: "Approved draft headline" });
      result.current.setMetaDraft(baseAdStudioRun.id, { campaignName: "Paused Meta Test" });
    });

    expect(result.current.getAssetUri(baseAdStudioRun.id)).toBe("gs://blueprint/ad-run-1/frame.png");
    expect(result.current.getReviewDraft(baseAdStudioRun)).toMatchObject({
      headline: "Approved draft headline",
      primaryText: "Apply to capture real spaces with proof gates.",
    });
    expect(result.current.getMetaDraft(baseAdStudioRun.id)).toMatchObject({
      campaignName: "Paused Meta Test",
      provider: "graph_api",
      mediaType: "video",
    });
  });

  it("normalizes guardrail textarea input without inventing claims", () => {
    expect(parseLineList("Allowed\n\nBlocked, Evidence linked")).toEqual([
      "Allowed",
      "Blocked",
      "Evidence linked",
    ]);
    expect(buildDefaultAdStudioReviewDraft(baseAdStudioRun, baseAdStudioForm)).toEqual({
      headline: "Capture public indoor spaces",
      primaryText: "Apply to capture real spaces with proof gates.",
    });
  });

  it("renders ship-broadcast queue actions without sending until approval is clicked", async () => {
    const approve = vi.fn();
    const reject = vi.fn();
    const refetch = vi.fn();

    render(
      <ShipBroadcastApprovalQueuePanel
        query={{
          isLoading: false,
          isError: false,
          data: {
            items: [
              {
                id: "campaign-1",
                name: "Ship Broadcast: exact-site update",
                subject: "Hosted review update",
                recipientCount: 2,
                sendStatus: "pending_approval",
                createdAt: "2026-04-04T14:00:00.000Z",
                lastLedgerDocId: "ledger-1",
                approvalReason: null,
                assetKey: "ship-broadcast:webapp:abc1234",
                assetType: "ship_broadcast",
                sourceIssueIds: ["BLU-200"],
                proofLinks: ["https://notion.so/draft-1"],
              },
            ],
          },
          refetch,
        }}
        approveMutation={{ isPending: false, mutate: approve }}
        rejectMutation={{ isPending: false, mutate: reject }}
        rejectReasons={{}}
        onRejectReasonChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Fresh SendGrid ship-broadcast drafts already queued/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve and Send/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Reject$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Approve and Send/i }));
    expect(approve).toHaveBeenCalledWith("ledger-1");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
