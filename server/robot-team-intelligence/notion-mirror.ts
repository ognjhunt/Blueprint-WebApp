import { Client } from "@notionhq/client";
import { getConfiguredEnvValue } from "../config/env";
import { directoryDigest, publicRobotTeam, ROOT } from "./directory";
import { ROBOT_TEAMS_COLLECTION } from "../types/robot-team-registry";

export type RobotNotionMirror = { enabled: boolean; parentPageId: string; authorityRef: string };
export type MirrorTransport = (method: "GET" | "POST" | "PATCH", path: string, body?: any) => Promise<any>;
const sameId = (a: unknown, b: string) => typeof a === "string" && a.replace(/-/g, "") === b.replace(/-/g, "");
const content = (block: any) => (block[block.type]?.rich_text ?? []).map((s: any) => s.plain_text ?? s.text?.content ?? "").join("");
const paragraph = (text: string) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: text } }] } });
function chunks(text: string) {
  const result: string[] = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 1800, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    result.push(text.slice(offset, end)); offset = end;
  }
  return result;
}
function runtimeTransport(): MirrorTransport {
  const token = getConfiguredEnvValue("NOTION_API_KEY", "NOTION_API_TOKEN");
  if (!token) throw Error("robot_notion_existing_binding_missing");
  const client = new Client({ auth: token, timeoutMs: 20000 });
  return async (method, path, body) => client.request({ method: method.toLowerCase() as any, path, body });
}

/** Human-visible copies of canonical public records. One page per team, retained
 * versions per source hash, exact readback and GET reconciliation after lost ACKs.
 * The original reviewed Notion directory is preserved as the parent page. */
export async function mirrorRobotTeamToNotion(db: FirebaseFirestore.Firestore, teamId: string,
  scope: RobotNotionMirror | undefined, options: { transport?: MirrorTransport; clock?: () => string;
    guard?: (tx?: FirebaseFirestore.Transaction) => Promise<void> } = {}) {
  if (!scope?.enabled || !scope.authorityRef) throw Error("robot_notion_mirror_not_enabled");
  const clock = options.clock ?? (() => new Date().toISOString()), guard = options.guard ?? (async () => {});
  await guard();
  const transport = options.transport ?? runtimeTransport(), ref = db.doc(`${ROBOT_TEAMS_COLLECTION}/${teamId}`);
  const saved = await ref.get();
  if (!saved.exists) throw Error("robot_team_not_found");
  const record = publicRobotTeam(teamId, saved.data()!), sourceSha256 = directoryDigest(record);
  const text = JSON.stringify({ canonical_source_ref: ref.path, canonical_source_sha256: sourceSha256,
    source_dates_are_original: true, directory_record: record }, null, 2), parts = chunks(text);
  const bindingRef = db.doc(`${ROOT}/notionBindings/${teamId}`), versionRef = bindingRef.collection("versions").doc(sourceSha256);
  const title = `Blueprint robot team ${teamId}`;
  const binding: { pageId: string | null; mayCreate: boolean } = await db.runTransaction(async tx => {
    await guard(tx);
    const previous = await tx.get(bindingRef);
    if (previous.exists) {
      if (!sameId(previous.data()!.parentPageId, scope.parentPageId)) throw Error("robot_notion_parent_binding_changed");
      return { pageId: typeof previous.data()!.pageId === "string" ? previous.data()!.pageId : null, mayCreate: false };
    }
    const value = { teamId, parentPageId: scope.parentPageId, authorityRef: scope.authorityRef, title,
      createClaimedAt: clock(), pageId: null };
    tx.set(bindingRef, value); return { ...value, mayCreate: true };
  });
  const list = async (path: string, body?: any) => {
    const values: any[] = []; let cursor: string | undefined;
    do {
      await guard();
      const page = body ? await transport("POST", path, { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
        : await transport("GET", `${path}?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`);
      values.push(...page.results);
      if (page.has_more && !page.next_cursor) throw Error("robot_notion_pagination_incomplete");
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);
    return values;
  };
  if (!binding.pageId) {
    // Search is a read-only POST. Claim ownership alone allows one page create.
    const matches = (await list("search", { query: title, filter: { property: "object", value: "page" } })).filter(p =>
      sameId(p.parent?.page_id, scope.parentPageId) && (p.properties?.title?.title ?? []).map((s: any) => s.plain_text ?? s.text?.content ?? "").join("") === title);
    if (matches.length > 1) throw Error("robot_notion_page_identity_ambiguous");
    if (matches.length) binding.pageId = matches[0].id;
    else if (binding.mayCreate) {
      await guard();
      const created = await transport("POST", "pages", { parent: { page_id: scope.parentPageId },
        properties: { title: { title: [{ type: "text", text: { content: title } }] } } });
      if (typeof created.id !== "string" || !/^[a-f0-9-]{32,36}$/i.test(created.id)) throw Error("robot_notion_create_ack_invalid");
      binding.pageId = created.id;
    } else throw Error("robot_notion_create_ack_unresolved_observe_only");
    await db.runTransaction(async tx => { await guard(tx); const old = await tx.get(bindingRef);
      if (old.data()?.pageId && old.data()!.pageId !== binding.pageId) throw Error("robot_notion_page_binding_changed");
      tx.set(bindingRef, { pageId: binding.pageId }, { merge: true }); });
  }
  const pageId = binding.pageId;
  if (!pageId) throw Error("robot_notion_page_binding_missing");
  await guard();
  const page = await transport("GET", `pages/${pageId}`);
  if (!sameId(page.id, pageId) || !sameId(page.parent?.page_id, scope.parentPageId) || page.archived)
    throw Error("robot_notion_page_binding_changed");
  const batches = Math.ceil(parts.length / 90);
  for (let index = 0; index < batches; index++) {
    const marker = `Blueprint canonical ${sourceSha256} part ${index + 1}/${batches}`;
    const batch = parts.slice(index * 90, (index + 1) * 90), batchRef = versionRef.collection("batches").doc(String(index));
    const observe = async () => {
      const blocks = await list(`blocks/${pageId}/children`), indexes = blocks.flatMap((block, i) => content(block) === marker ? [i] : []);
      if (indexes.length > 1) throw Error("robot_notion_version_readback_ambiguous");
      if (!indexes.length) return false;
      if (batch.some((part, n) => content(blocks[indexes[0] + 1 + n] ?? {}) !== part)) throw Error("robot_notion_version_readback_changed");
      return true;
    };
    if (!await observe()) {
      const mayAppend = await db.runTransaction(async tx => { await guard(tx); const prior = await tx.get(batchRef);
        if (prior.exists) return false;
        tx.set(batchRef, { marker, sourceSha256, claimAt: clock(), contentSha256: directoryDigest(batch) }); return true; });
      if (!mayAppend) throw Error("robot_notion_append_ack_unresolved_observe_only");
      await guard();
      await transport("PATCH", `blocks/${pageId}/children`, { children: [paragraph(marker), ...batch.map(paragraph)] });
      if (!await observe()) throw Error("robot_notion_append_readback_missing");
    }
    await db.runTransaction(async tx => { await guard(tx); tx.set(batchRef, { readbackVerifiedAt: clock() }, { merge: true }); });
  }
  const result = { team_id: teamId, canonical_source_ref: ref.path, canonical_source_sha256: sourceSha256,
    parent_page_id: scope.parentPageId, page_id: pageId, reference: `https://www.notion.so/${pageId.replace(/-/g, "")}`,
    authority_ref: scope.authorityRef, readback_verified: true, checked_at: clock(), batches };
  await db.runTransaction(async tx => { await guard(tx); tx.set(versionRef, result); tx.set(bindingRef,
    { latestVerifiedSourceSha256: sourceSha256, verifiedAt: result.checked_at }, { merge: true }); });
  return { ok: true, ...result };
}
