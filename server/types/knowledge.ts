export type KnowledgeSource = {
  title: string;
  url: string;
  category?: string;
  description?: string;
};

export type VenueChunk = {
  blueprintId: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceCategory?: string;
  chunkId: string;
  text: string;
  embedding: number[];
  tokenCount?: number;
};
