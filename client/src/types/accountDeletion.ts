/** Request receipt only. Neither state asserts that an account or its data was erased. */
export type AccountDeletionRequest = {
  id: string;
  status: "requested" | "in_review";
  requestedAtIso: string;
  updatedAtIso: string;
  message: string;
};

export type AccountDeletionQueueItem = AccountDeletionRequest & {
  accountUid: string;
  accountEmail: string | null;
  reviewerUid: string | null;
};
