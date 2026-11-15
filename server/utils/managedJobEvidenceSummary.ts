export type ManagedJobEvidenceSummary = {
  runId: string; state: string; current: boolean; resultDigest: string | null;
  /** These results were prepared before the site picked another place for the object (`currentManagedScreeningScope`). */
  placeCorrectedSince?: true;
  /** `nextAction` is what the site may read; `opsNextAction` is staff only. */
  summary: string; nextAction: string; opsNextAction?: string; limitations: string[]; href: string;
};
