import { createHash } from "node:crypto";
export const TRANSPORT_STATUS_VERSION = "blueprint-reliability-transport-status.v1";
export type TransportStatusCase = { id: string; hash: string; family: string; parameters: Record<string, string | number>; expected: string; labelVersion: string; layer: string };
const rows: TransportStatusCase[] = [];
function add(family: string, parameters: TransportStatusCase["parameters"], expected: string) {
  const hash = createHash("sha256").update(JSON.stringify({ version: TRANSPORT_STATUS_VERSION, family, parameters, expected })).digest("hex");
  rows.push({ id: `RTS-${family}-${hash.slice(0, 12)}`, hash, family, parameters, expected,
    labelVersion: TRANSPORT_STATUS_VERSION, layer: "actual-handler-functions/in-memory-object-storage-and-serialized-firestore-fakes" });
}
for (const scenario of ["complete", "reordered_arrival", "missing_first", "missing_middle", "missing_last", "duplicate_identical", "duplicate_conflicting", "intermediate_failure", "final_failure", "destination_generation_conflict"]) {
  for (const parts of [3, 33, 65]) add("upload_transport", { scenario, parts },
    scenario === "duplicate_conflicting" ? "Acknowledged original chunk bytes survive a conflicting duplicate; reject conflict; later composition retains original byte order"
      : scenario.startsWith("missing_") ? "Name exact missing index; no final video or completion published"
        : scenario.includes("failure") || scenario === "destination_generation_conflict" ? "Injected compose boundary is reached and fails; keep original parts and any prior destination; no successful composition result"
          : "Compose byte-for-byte in index order with at most32 sources per call; identical retries are idempotent; report exact write identity");
}
const statusScenarios: Record<string, string[]> = {
  held: ["healthy", "video_absent", "video_generation_changed", "video_size_mismatch", "video_crc_mismatch", "cross_request", "manifest_missing", "manifest_changed", "current_consent_withdrawn", "original_grant_absent"],
  published: ["healthy", "video_absent", "video_generation_changed", "video_crc_mismatch", "cross_request", "manifest_missing", "manifest_changed", "marker_missing", "receipt_changed", "current_consent_withdrawn"],
  stored: ["healthy", "video_absent", "video_generation_changed", "video_size_mismatch", "video_crc_mismatch", "cross_request", "saved_manifest_hash_changed", "current_consent_withdrawn", "original_grant_absent", "disallowed_actor"],
};
for (const [state, scenarios] of Object.entries(statusScenarios)) for (const scenario of scenarios) add("status_publication", { state, scenario },
  "Customer status follows current generation-bound durable video/manifest/marker evidence; absent/changed proofs never produce processing-ready; current and original consent bound retry; retained evidence stays distinguishable from completion");
export const transportStatusCases = rows;
