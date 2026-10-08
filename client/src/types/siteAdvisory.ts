/** Customer projection only. Private agent packets are never this DTO. */
export type SiteAdvisory = {
  schemaVersion: "site_customer_advisory.v1";
  state: "queued" | "running" | "ready" | "needs_review" | "authority_ended" | "unavailable";
  correlationId: string | null;
  sections: Array<{ title: string; claims: Array<{
    text: string;
    verificationStatus: "source_bound";
    basis: "observed" | "operator_stated" | "published" | "measured";
    evidence: Array<{ kind: "video" | "operator" | "specification"; atSeconds: number | null }>;
  }> }>;
  unknowns: string[];
  nextAction: string | null;
};
