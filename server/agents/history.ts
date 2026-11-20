import { Timestamp, type Query, type QueryDocumentSnapshot } from "firebase-admin/firestore";

function recordTime(document: QueryDocumentSnapshot): Timestamp {
  const stored = document.get("created_at");
  if (stored instanceof Timestamp) return stored;
  if (typeof stored === "string") {
    const time = Date.parse(stored);
    if (Number.isFinite(time)) return Timestamp.fromMillis(time);
  }
  return document.createTime;
}

export async function listRecentAgentRecords(query: Query, count: number): Promise<QueryDocumentSnapshot[]> {
  // A map sorts above a timestamp in Firestore. Apply the limit to timestamp records separately,
  // then merge the older formats. The server's document creation time is available on reads of
  // the empty maps, but Firestore cannot order a query by it.
  const [stamped, text, legacy] = await Promise.all([
    query.where("created_at", ">=", Timestamp.fromMillis(0)).orderBy("created_at", "desc").limit(count).get(),
    query.where("created_at", ">=", "").orderBy("created_at", "desc").get(),
    query.where("created_at", "==", {}).get(),
  ]);
  // A rewrite between the reads can move a document from one result to another.
  const documents = new Map([...legacy.docs, ...text.docs, ...stamped.docs].map((document) => [document.id, document]));
  return [...documents.values()]
    .map((document) => ({ document, time: recordTime(document) }))
    .sort((left, right) => right.time.seconds - left.time.seconds
      || right.time.nanoseconds - left.time.nanoseconds
      || Buffer.compare(Buffer.from(right.document.id), Buffer.from(left.document.id)))
    .slice(0, count)
    .map(({ document }) => document);
}
