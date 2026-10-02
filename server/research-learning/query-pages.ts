import { FieldPath } from "firebase-admin/firestore";

/** Page an already-authorized query. A transport page size is not a result
 * quota. Document-ID cursors preserve each original record and its metadata.
 * A supplied reader keeps transaction reads in the caller's transaction. */
export async function readQueryPages(query: FirebaseFirestore.Query,
  read = (page: FirebaseFirestore.Query) => page.get()) {
  const pageSize = 100;
  const ordered = query.orderBy(FieldPath.documentId());
  const records: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  do {
    const page = await read((cursor ? ordered.startAfter(cursor) : ordered).limit(pageSize));
    records.push(...page.docs);
    if (page.size < pageSize) break;
    cursor = page.docs.at(-1);
  } while (cursor);
  return records;
}
