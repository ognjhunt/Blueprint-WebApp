import { semanticHash } from './reliability-schema.mjs';
// Frozen expectations: a published database row is insufficient without current exact object proofs.
export const storageCases = [
  ['baseline', 'all exact receipts present', 'processing_ready', true],
  ...['missing', 'generation', 'size', 'crc', 'forbidden', 'unavailable', 'invalid-metadata'].map(fault => [`video:${fault}`, `video ${fault}`, 'status_unavailable', false]),
  ...['missing', 'generation', 'size', 'crc', 'oversized', 'hash', 'truncated', 'readback-race'].map(fault => [`manifest:${fault}`, `manifest ${fault}`, 'retained', true]),
  ...['forbidden', 'unavailable'].map(fault => [`manifest:${fault}`, `manifest ${fault}`, 'status_unavailable', false]),
  ...['marker', 'receipt'].flatMap(target => ['missing', 'content', 'size', 'truncated', 'readback-race'].map(fault => [`${target}:${fault}`, `${target} ${fault}`, 'retained', true])),
  ...['marker', 'receipt'].flatMap(target => ['forbidden', 'unavailable'].map(fault => [`${target}:${fault}`, `${target} ${fault}`, 'status_unavailable', false])),
  ...['session-read', 'rights-read', 'session-invalid', 'foreign-request', 'foreign-scene'].map(fault => [fault, fault, 'status_unavailable', false]),
].map(([fault, condition, uploadState, captureReceived], index) => {
  const value = { caseId: `INF-05-${String(index + 1).padStart(3, '0')}`, family: 'storage-index', kind: 'infrastructure', parameters: { fault, condition, actor: 'authorized returning uploader', persistedState: 'published', evidence: 'generation-bound synthetic video and receipts' }, expectedTransitions: { uploadState, captureReceived, processingRetryAvailable: false }, assertions: ['current exact object proof required', 'no status read mutates durable state', 'read-only status path', 'safe retry visibility'], layer: 'actual-handler/fake-storage/fake-firestore/mocked-authorization', providerMode: 'no-provider', labelVersion: 'charter.v1', promptVersion: 'not-applicable', replayCommand: `npx vitest run server/tests/reliability-storage-dependencies.test.ts -t '${`INF-05-${String(index + 1).padStart(3, '0')}`}'` };
  return { ...value, semanticHash: semanticHash(value) };
});
