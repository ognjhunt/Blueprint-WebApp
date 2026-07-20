/**
 * In-memory Firestore fake for SCALE2-01 queue/journal tests.
 *
 * Extends the pattern used by accounting-ledgers.test.ts with the query
 * features the webhook queue and reconciliation report need: range operators
 * (<=, >=), orderBy, and limit. Transactions buffer writes and commit
 * atomically after the callback resolves, mirroring Firestore semantics
 * closely enough to exercise reads-before-writes journal logic.
 */

export type StoredDoc = Record<string, unknown>;

export type FakeFirestoreState = {
  docs: Map<string, StoredDoc>;
};

export function createFakeFirestoreState(): FakeFirestoreState {
  return { docs: new Map() };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      merged[key] = deepMerge(existing, value);
      continue;
    }
    merged[key] = clone(value);
  }
  return merged;
}

type QueryFilter = { field: string; op: string; value: unknown };
type QueryOrder = { field: string; direction: "asc" | "desc" };

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function queryMatches(data: StoredDoc, filter: QueryFilter): boolean {
  const actual = data[filter.field];
  switch (filter.op) {
    case "==":
      return actual === filter.value;
    case "in":
      return Array.isArray(filter.value) && (filter.value as unknown[]).includes(actual);
    case "<=":
      return compareValues(actual, filter.value) <= 0;
    case ">=":
      return compareValues(actual, filter.value) >= 0;
    case "<":
      return compareValues(actual, filter.value) < 0;
    case ">":
      return compareValues(actual, filter.value) > 0;
    default:
      throw new Error(`Unsupported operator ${filter.op}`);
  }
}

export function createFakeFirestore(state: FakeFirestoreState) {
  const docKey = (collection: string, id: string) => `${collection}/${id}`;

  const readDoc = (collection: string, id: string): StoredDoc | undefined => {
    const stored = state.docs.get(docKey(collection, id));
    return stored ? clone(stored) : undefined;
  };

  function makeDocRef(collectionName: string, id: string) {
    return {
      id,
      __collection: collectionName,
      get: async () => ({
        id,
        exists: Boolean(readDoc(collectionName, id)),
        data: () => readDoc(collectionName, id),
      }),
      set: async (payload: StoredDoc, options?: { merge?: boolean }) => {
        const existing = readDoc(collectionName, id) || {};
        state.docs.set(
          docKey(collectionName, id),
          options?.merge ? deepMerge(existing, payload) : clone(payload),
        );
      },
      update: async (payload: StoredDoc) => {
        const existing = readDoc(collectionName, id) || {};
        state.docs.set(docKey(collectionName, id), deepMerge(existing, payload));
      },
      create: async (payload: StoredDoc) => {
        const key = docKey(collectionName, id);
        if (state.docs.has(key)) {
          const error = new Error("already exists") as Error & { code?: string };
          error.code = "already-exists";
          throw error;
        }
        state.docs.set(key, clone(payload));
      },
    };
  }

  type MockDocRef = ReturnType<typeof makeDocRef>;

  function makeQuery(
    collectionName: string,
    filters: QueryFilter[],
    orders: QueryOrder[] = [],
    limitCount: number | null = null,
  ) {
    return {
      where: (field: string, op: string, value: unknown) =>
        makeQuery(collectionName, [...filters, { field, op, value }], orders, limitCount),
      orderBy: (field: string, direction: "asc" | "desc" = "asc") =>
        makeQuery(collectionName, filters, [...orders, { field, direction }], limitCount),
      limit: (count: number) => makeQuery(collectionName, filters, orders, count),
      get: async () => {
        let entries = Array.from(state.docs.entries())
          .filter(([key, data]) => {
            if (!key.startsWith(`${collectionName}/`)) {
              return false;
            }
            return filters.every((filter) => queryMatches(data, filter));
          })
          .map(([key, data]) => ({
            id: key.slice(collectionName.length + 1),
            data: clone(data),
          }));
        for (const order of [...orders].reverse()) {
          entries = entries.sort((a, b) => {
            const comparison = compareValues(a.data[order.field], b.data[order.field]);
            return order.direction === "desc" ? -comparison : comparison;
          });
        }
        if (limitCount !== null) {
          entries = entries.slice(0, limitCount);
        }
        return {
          docs: entries.map((entry) => ({
            id: entry.id,
            data: () => clone(entry.data),
            ref: makeDocRef(collectionName, entry.id),
          })),
        };
      },
    };
  }

  return {
    collection: (collectionName: string) => ({
      doc: (id: string) => makeDocRef(collectionName, id),
      where: (field: string, op: string, value: unknown) =>
        makeQuery(collectionName, [{ field, op, value }]),
      orderBy: (field: string, direction: "asc" | "desc" = "asc") =>
        makeQuery(collectionName, [], [{ field, direction }]),
    }),
    runTransaction: async <T>(
      updateFn: (tx: {
        get: (ref: MockDocRef) => Promise<{
          id: string;
          exists: boolean;
          data: () => StoredDoc | undefined;
        }>;
        set: (ref: MockDocRef, payload: StoredDoc, options?: { merge?: boolean }) => void;
        update: (ref: MockDocRef, payload: StoredDoc) => void;
      }) => Promise<T>,
    ): Promise<T> => {
      const writes: Array<() => void> = [];
      const tx = {
        // Accepts doc refs and query objects (Firestore transactions allow
        // tx.get(query), used by the earnings-aggregate lazy backfill).
        get: async (ref: MockDocRef | { get: () => Promise<unknown>; __collection?: undefined }) => {
          if (!("__collection" in ref) || ref.__collection === undefined) {
            return (ref as { get: () => Promise<never> }).get();
          }
          const docRef = ref as MockDocRef;
          return {
            id: docRef.id,
            exists: Boolean(readDoc(docRef.__collection, docRef.id)),
            data: () => readDoc(docRef.__collection, docRef.id),
          };
        },
        set: (ref: MockDocRef, payload: StoredDoc, options?: { merge?: boolean }) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(
              docKey(ref.__collection, ref.id),
              options?.merge ? deepMerge(existing, payload) : clone(payload),
            );
          });
        },
        update: (ref: MockDocRef, payload: StoredDoc) => {
          writes.push(() => {
            const existing = readDoc(ref.__collection, ref.id) || {};
            state.docs.set(docKey(ref.__collection, ref.id), deepMerge(existing, payload));
          });
        },
      };
      const result = await updateFn(tx);
      for (const write of writes) {
        write();
      }
      return result;
    },
  };
}

/**
 * Module-level singleton so a vi.mock factory and the test body observe the
 * same store. Call `sharedFakeFirestoreState.docs.clear()` in beforeEach.
 */
export const sharedFakeFirestoreState = createFakeFirestoreState();
export const sharedFakeFirestore = createFakeFirestore(sharedFakeFirestoreState);
