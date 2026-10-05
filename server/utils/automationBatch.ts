/** A durable rotating scan prevents permanently unknown/prerequisite-blocked
 * rows from starving newer work. Skipped rows return on the next sweep. */
export async function automationBatch(db: FirebaseFirestore.Firestore, query: FirebaseFirestore.Query,
  name: string, limit: number) {
  const ref = db.collection("automationCursors").doc(name);
  const cursor = (await ref.get()).data()?.last_id;
  let batch = query.orderBy("__name__").limit(Math.max(1, Math.min(limit, 100)));
  if (cursor) batch = batch.startAfter(cursor);
  const snapshot = await batch.get();
  await ref.set({ last_id: snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null });
  return snapshot;
}
