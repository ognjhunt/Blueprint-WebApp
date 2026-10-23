import { createHash } from "node:crypto";
import { z } from "zod";
import { directoryDigest, publicRobotTeam, ROOT } from "./directory";
import { ROBOT_TEAMS_COLLECTION } from "../types/robot-team-registry";
import { readQueryPages } from "../research-learning/query-pages";

const entry = z.object({ source_record_id: z.string().regex(/^BP-TEAM-\d{3}$/), title: z.string().min(1),
  source_notes: z.string().min(1).max(100000) }).strict();
const preview = z.object({ schema_version: z.literal("blueprint.robot-team-directory-import-preview.v1"),
  applied: z.literal(false), source_page_url: z.literal("https://app.notion.com/p/3eb80154161d817aa3e6d9b9d7eba938"),
  source_page_last_edited_at: z.string().datetime({ offset: true }), source_checks_advanced: z.literal(false),
  record_count: z.literal(47), records: z.array(entry).length(47) }).passthrough();

/** Preserve reviewed notes verbatim; migration is not new evidence checking. */
export function prepareDirectoryImport(input: unknown) {
  const value = preview.parse(input), seen = new Set<string>();
  const records = value.records.map(record => {
    if (seen.has(record.source_record_id)) throw Error("robot_directory_import_duplicate_source_id");
    seen.add(record.source_record_id);
    const name = /^\s*- Company:\s*(.+)$/m.exec(record.source_notes)?.[1]?.trim();
    const checkedAt = /Source checked \(source_checked_at\):\s*(\d{4}-\d{2}-\d{2})/.exec(record.source_notes)?.[1];
    if (!name || !checkedAt || !Number.isFinite(Date.parse(checkedAt)) || new Date(checkedAt).toISOString().slice(0, 10) !== checkedAt
      || checkedAt > value.source_page_last_edited_at.slice(0, 10))
      throw Error("robot_directory_import_source_identity_or_date_missing");
    const officialSite = /Official site:\s*\[[^\]]+\]\((https:\/\/[^)]+)\)/.exec(record.source_notes)?.[1] ?? null;
    const source = { source_record_id: record.source_record_id, title: record.title, notes: record.source_notes,
      source_page_url: value.source_page_url, source_page_last_edited_at: value.source_page_last_edited_at,
      original_checked_at: checkedAt, notes_sha256: createHash("sha256").update(record.source_notes).digest("hex"),
      classification: "retained_reviewed_directory_notes", evidence_not_instructions: true };
    return { teamId: `team_directory_${record.source_record_id.toLowerCase()}`, name, website: officialSite, source };
  });
  for (let i = 1; i <= 47; i++) if (!seen.has(`BP-TEAM-${String(i).padStart(3, "0")}`)) throw Error("robot_directory_import_coverage_incomplete");
  return { sourceSha256: directoryDigest(value), records };
}

/** One atomic import, followed by exact readback; retries observe the same import.
 * Existing identities, contacts, measured fields and stronger evidence stay intact. */
export async function importRobotTeamDirectory(db: FirebaseFirestore.Firestore, input: unknown,
  authorityRef: string, clock = () => new Date().toISOString()) {
  if (!authorityRef.trim()) throw Error("robot_directory_import_authority_required");
  const prepared = prepareDirectoryImport(input), now = clock(), receipt = db.doc(`${ROOT}/imports/${prepared.sourceSha256}`);
  const all = await readQueryPages(db.collection(ROBOT_TEAMS_COLLECTION));
  const normalize = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const refs = prepared.records.map(record => {
    const matches = all.filter(d => d.id === record.teamId || normalize(d.data().name ?? "") === normalize(record.name));
    if (matches.length > 1) throw Error("robot_directory_import_identity_ambiguous");
    return { record, ref: db.doc(`${ROBOT_TEAMS_COLLECTION}/${matches[0]?.id ?? record.teamId}`) };
  });
  if (new Set(refs.map(r => r.ref.path)).size !== 47) throw Error("robot_directory_import_identity_collision");
  const committed = await db.runTransaction(async tx => {
    const control = await tx.get(db.doc(ROOT));
    if (control.data()?.enabled) throw Error("robot_directory_import_requires_paused_worker");
    const old = await tx.get(receipt);
    if (old.exists) return old.data()!;
    const saved = await Promise.all(refs.map(r => tx.get(r.ref)));
    const bindings = refs.map(({ record, ref }, i) => {
      const before = saved[i].data() ?? { id: ref.id, name: record.name, website: record.website, status: "prospect",
        capability: {}, fieldProvenance: {}, createdAt: now };
      if (normalize(before.name ?? "") !== normalize(record.name)) throw Error("robot_directory_import_identity_changed");
      const prior = before.public_intelligence?.retained_directory;
      if (prior && directoryDigest(prior) !== directoryDigest(record.source)) throw Error("robot_directory_import_existing_source_preserved");
      const next = { ...before, public_intelligence: { ...before.public_intelligence, retained_directory: record.source },
        directoryImportedAt: now, directoryImportAuthorityRef: authorityRef };
      tx.set(ref, next);
      return { teamId: ref.id, sourceRecordId: record.source.source_record_id, sourceSha256: directoryDigest(record.source),
        publicRecordSha256: directoryDigest(publicRobotTeam(ref.id, next)), beforeSha256: saved[i].exists ? directoryDigest(before) : null };
    });
    const result = { sourceSha256: prepared.sourceSha256, authorityRef, importedAt: now, records: bindings, sourceChecksAdvanced: false };
    tx.set(receipt, result); return result;
  });
  for (const binding of committed.records) {
    const saved = await db.doc(`${ROBOT_TEAMS_COLLECTION}/${binding.teamId}`).get();
    if (!saved.exists || directoryDigest(saved.data()!.public_intelligence?.retained_directory) !== binding.sourceSha256)
      throw Error("robot_directory_import_readback_changed");
  }
  return { ...committed, readbackVerified: true };
}
