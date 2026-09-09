import type { WorkStore, WorkTransaction } from "../../utils/blueprintWorkOAuth";

function assertFirestoreValues(value: unknown) {
  if (value === undefined) throw new Error("Firestore rejects undefined values");
  if (value && typeof value === "object") Object.values(value).forEach(assertFirestoreValues);
}

export class MemoryWorkStore implements WorkStore {
  rows = new Map<string, Record<string, any>>();
  private tail = Promise.resolve();
  async get(key: string) { const row = this.rows.get(key); return row && structuredClone(row); }
  async set(key: string, row: Record<string, any>) { assertFirestoreValues(row); this.rows.set(key, structuredClone(row)); }
  async transaction<T>(action: (tx: WorkTransaction) => Promise<T>): Promise<T> {
    const previous = this.tail; let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const pending = new Map(this.rows);
    try {
      const result = await action({ get: async key => pending.get(key), set: (key, row) => { assertFirestoreValues(row); pending.set(key, structuredClone(row)); }, delete: key => { pending.delete(key); } });
      this.rows = pending; return result;
    } finally { release(); }
  }
}
