import crypto from "crypto";

import admin, { dbAdmin as db } from "../client/src/lib/firebaseAdmin";
import {
  environmentPolicies,
  marketplaceScenes,
  trainingDatasets,
  type MarketplaceScene,
  type TrainingDataset,
} from "../client/src/data/content";
import { embedTexts } from "../server/retrieval/embeddings";
import { buildSearchDoc } from "../server/retrieval/marketplaceSearch";

type MarketplaceIndexDoc = {
  type: "scene" | "training";
  item: MarketplaceScene | TrainingDataset;
  searchDoc: string;
  searchDocHash: string;
  embedding: number[];
  embeddingModel: string;
  updatedAt: unknown;
};

function sha256(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function main() {
  if (!db) {
    throw new Error(
      "Firestore Admin SDK is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON before running this script.",
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is required to index marketplace embeddings.",
    );
  }

  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const policyTitleMap = new Map(
    environmentPolicies.map((policy) => [policy.slug, policy.title] as const),
  );

  const items: Array<{ type: "scene" | "training"; item: MarketplaceScene | TrainingDataset }> =
    [
      ...marketplaceScenes.map((scene) => ({
        type: "scene" as const,
        item: scene,
      })),
      ...trainingDatasets.map((dataset) => ({
        type: "training" as const,
        item: dataset,
      })),
    ];

  const collection = db.collection("marketplace_items");

  const prepared = items.map(({ type, item }) => {
    const searchDoc = buildSearchDoc(
      { type, item, embedding: null, searchDoc: "" } as any,
      policyTitleMap,
    );
    const searchDocHash = sha256(searchDoc);
    return {
      type,
      item,
      searchDoc,
      searchDocHash,
      ref: collection.doc(item.slug),
    };
  });

  const existingSnapshots = await Promise.all(
    prepared.map((entry) => entry.ref.get()),
  );

  const needsEmbedding: Array<{ index: number; searchDoc: string }> = [];
  const embeddingsByIndex = new Map<number, number[]>();

  for (let i = 0; i < prepared.length; i++) {
    const existing = existingSnapshots[i];
    const existingData = existing.exists ? (existing.data() as any) : null;
    const sameDoc =
      existingData &&
      existingData.searchDocHash === prepared[i].searchDocHash &&
      existingData.embeddingModel === embeddingModel &&
      Array.isArray(existingData.embedding) &&
      existingData.embedding.length > 0;

    if (sameDoc) {
      embeddingsByIndex.set(i, existingData.embedding as number[]);
      continue;
    }

    needsEmbedding.push({ index: i, searchDoc: prepared[i].searchDoc });
  }

  if (needsEmbedding.length > 0) {
    const embeddings = await embedTexts(needsEmbedding.map((entry) => entry.searchDoc));
    if (embeddings.length !== needsEmbedding.length) {
      throw new Error(
        `Embedding count mismatch (${embeddings.length} != ${needsEmbedding.length})`,
      );
    }
    for (let i = 0; i < needsEmbedding.length; i++) {
      const vector = embeddings[i];
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Embedding provider returned an empty embedding vector.");
      }
      embeddingsByIndex.set(needsEmbedding[i].index, vector);
    }
  }

  const writes: Array<{ ref: any; doc: Omit<MarketplaceIndexDoc, "updatedAt"> }> = [];
  for (let i = 0; i < prepared.length; i++) {
    const embedding = embeddingsByIndex.get(i);
    if (!embedding) {
      throw new Error(`Missing embedding for index ${i}`);
    }

    writes.push({
      ref: prepared[i].ref,
      doc: {
        type: prepared[i].type,
        item: prepared[i].item,
        searchDoc: prepared[i].searchDoc,
        searchDocHash: prepared[i].searchDocHash,
        embedding,
        embeddingModel,
      },
    });
  }

  const batches = chunk(writes, 400);
  for (const batchWrites of batches) {
    const batch = db.batch();
    for (const entry of batchWrites) {
      batch.set(
        entry.ref,
        {
          ...entry.doc,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    await batch.commit();
  }

  console.log(
    `Indexed ${writes.length} marketplace items with embeddingModel=${embeddingModel}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

