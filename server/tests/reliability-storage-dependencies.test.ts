// @vitest-environment node
import { beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { storageCases } from '../../scripts/qa/reliability-storage-cases.mjs';
const state = vi.hoisted(() => ({ objects: new Map<string, any>(), faults: new Map<string, string>(), reads: [] as any[], dbFault: '' }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../client/src/lib/firebaseAdmin', async () => {
  const { sharedFakeFirestore } = await import('./helpers/fake-firestore');
  return { default: { firestore: { FieldValue: { serverTimestamp: () => 'synthetic' } } }, dbAdmin: { ...sharedFakeFirestore, collection: (name: string) => {
    const base = sharedFakeFirestore.collection(name);
    return { ...base, doc: (id: string) => { const ref = base.doc(id); return { ...ref, get: async () => { if (state.dbFault === name) throw Object.assign(new Error('synthetic unavailable'), { code: 14 }); return ref.get(); } }; } };
  } }, storageAdmin: { bucket: () => ({ file: (name: string, options?: any) => ({
    getMetadata: async () => {
      state.reads.push({ operation: 'metadata', name, generation: options?.generation ?? null });
      const fault = state.faults.get(name), stored = state.objects.get(name);
      if (!stored || fault === 'missing') throw Object.assign(new Error('synthetic missing'), { code: 404 });
      if (fault === 'forbidden' || fault === 'unavailable') throw Object.assign(new Error('synthetic dependency failure'), { code: fault === 'forbidden' ? 403 : 503 });
      stored.metadataReads++;
      const metadata = { ...stored.metadata };
      if (fault === 'generation' || fault === 'readback-race' && stored.metadataReads > 1) metadata.generation = '999';
      if (fault === 'size') metadata.size = String(Number(metadata.size) + 1);
      if (fault === 'oversized') metadata.size = '65537';
      if (fault === 'crc') metadata.crc32c = 'BBBBBB==';
      if (fault === 'invalid-metadata') metadata.name = 'wrong-object';
      return [metadata];
    },
    download: async () => {
      state.reads.push({ operation: 'download', name, generation: options?.generation ?? null });
      const stored = state.objects.get(name); const fault = state.faults.get(name);
      if (!stored) throw Object.assign(new Error('synthetic missing'), { code: 404 });
      if (fault === 'truncated') return [stored.bytes.subarray(0, stored.bytes.length - 1)];
      if (fault === 'content' || fault === 'hash') return [Buffer.from('x'.repeat(stored.bytes.length))];
      return [Buffer.from(stored.bytes)];
    },
  }) }) } };
});
vi.mock('../utils/captureUploadAuthorization', () => ({ authorizeCaptureUpload: async () => ({ allowed: true, holdReason: null, detail: null, blockers: [], openQuestions: [] }) }));
vi.mock('../utils/siteCaptureBundleService', () => ({ describeBundleLink: async () => null }));
vi.mock('../utils/siteTaskBrief', () => ({ getBrief: vi.fn(), switchSiteToSelfCapture: vi.fn(), TASK_BRIEFS_COLLECTION: 'siteTaskBriefs' }));
vi.mock('../utils/capturePrivacyScreen', () => ({ screenCaptureForPrivacy: vi.fn() }));
import router from '../routes/self-capture-uploads';
import { createCaptureUploadToken } from '../utils/captureUploadToken';
import { buildBrowserDelivery } from '../utils/websiteCaptureDelivery';
import { sharedFakeFirestoreState } from './helpers/fake-firestore';
import { RECORDING_CONSENT_VERSION } from '../utils/recordingConsent';

const results: any[] = [];
const codeSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const requestId = 'reliability-fixture', sceneId = `site-${requestId}`, captureId = `walkthrough-${requestId}`;
const raw = `scenes/${sceneId}/captures/${captureId}/raw`;
const sha = (bytes: Buffer) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
function put(name: string, bytes: Buffer, generation: string) { const metadata = { name, generation, size: String(bytes.length), crc32c: 'AAAAAA==' }; state.objects.set(name, { metadata, bytes, metadataReads: 0 }); return { object_name: name, generation, size_bytes: bytes.length, crc32c: 'AAAAAA==' }; }
let pending: any; let delivery: any;
beforeEach(() => {
  state.objects.clear(); state.faults.clear(); state.reads = []; state.dbFault = ''; sharedFakeFirestoreState.docs.clear(); vi.clearAllMocks();
  const video = put(`${raw}/walkthrough.mp4`, Buffer.from('owned synthetic fixture bytes'), '101');
  const manifestBytes = Buffer.from(JSON.stringify({ request_id: requestId, scene_id: sceneId, capture_id: captureId, video_uri: video.object_name, capture_rights: { derived_scene_generation_allowed: true, consent_status: 'granted', consent_revoked: false } }));
  const manifest = { ...put(`${raw}/manifest.json`, manifestBytes, '102'), sha256: sha(manifestBytes) };
  pending = { schema_version: 'website_browser_pending.v1', request_id: requestId, scene_id: sceneId, capture_id: captureId, state: 'published', completed_at_iso: '2026-10-08T04:13:38.000Z', video, manifest };
  delivery = buildBrowserDelivery({ requestId, sceneId, captureId, rawPrefix: raw, video, manifest, completedAtIso: pending.completed_at_iso });
  put(`${raw}/capture_upload_complete.json`, delivery.markerBytes, '103'); put(delivery.objectName, delivery.recordBytes, '104');
  sharedFakeFirestoreState.docs.set(`captureUploadSessions/${captureId}`, { browser_pending_delivery: pending });
  sharedFakeFirestoreState.docs.set(`inboundRequests/${requestId}`, { request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: pending.completed_at_iso } } });
});
function recorder() { return { statusCode: 200, body: undefined as any, headers: {} as any, setHeader(name: string, value: string) { this.headers[name] = value; }, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } }; }
describe('current exact capture storage proofs', () => {
  it.each(storageCases)('$caseId $parameters.condition', async (testCase: any) => {
    const startedAt = new Date().toISOString(), started = performance.now(); const fault = testCase.parameters.fault;
    if (fault.includes(':')) { const [target, problem] = fault.split(':'); const name = target === 'video' ? pending.video.object_name : target === 'manifest' ? pending.manifest.object_name : target === 'marker' ? `${raw}/capture_upload_complete.json` : delivery.objectName; state.faults.set(name, problem); }
    if (fault === 'session-read') state.dbFault = 'captureUploadSessions';
    if (fault === 'rights-read') state.dbFault = 'inboundRequests';
    if (fault === 'session-invalid') pending.state = 'unknown';
    if (fault === 'foreign-request') pending.request_id = 'other-tenant';
    if (fault === 'foreign-scene') pending.scene_id = 'site-other-tenant';
    const before = JSON.stringify([...sharedFakeFirestoreState.docs]);
    const response = recorder(); let status = 'passed', failure: string | undefined;
    try {
      const handler = (router as any).stack.find((layer: any) => layer.route?.path === '/:token/status' && layer.route.methods.get).route.stack[0].handle;
      await handler({ params: { token: createCaptureUploadToken({ requestId, sceneId, captureId }) } }, response);
      expect(response.statusCode).toBe(200); expect(response.body).toMatchObject(testCase.expectedTransitions);
      expect(response.headers['Cache-Control']).toBe('no-store'); expect(JSON.stringify([...sharedFakeFirestoreState.docs])).toBe(before);
      if (testCase.expectedTransitions.uploadState === 'retained') expect(response.body.holdReason).toBe('capture_handoff_unverified');
    } catch (error) { status = 'failed'; failure = error instanceof Error ? error.message : 'assertion failed'; throw error; }
    finally { results.push({ caseId: testCase.caseId, semanticHash: testCase.semanticHash, status, attempted: true, repeat: 1, startedAt, latencyMs: performance.now() - started, codeSha, layer: testCase.layer, providerMode: 'no-provider', durableEvidence: 'in-memory fakeFirestore snapshot unchanged; not durable database evidence', storageReads: state.reads.map((read: any) => ({ ...read, name: read.name.replaceAll(requestId, 'fixture') })), finalOutcome: { statusCode: response.statusCode, uploadState: response.body?.uploadState, captureReceived: response.body?.captureReceived, holdReason: response.body?.holdReason }, usage: { providerCalls: 0, tokens: 0 }, cost: { currency: 'USD', known: true, total: 0 }, ...(failure ? { failure } : {}) }); }
  });
});
afterAll(() => { if (!process.env.RELIABILITY_OUTPUT_DIR) return; const out = path.resolve(process.env.RELIABILITY_OUTPUT_DIR); mkdirSync(out, { recursive: true, mode: 0o700 }); writeFileSync(path.join(out, 'cases.json'), JSON.stringify(storageCases.map((c: any) => ({ ...c, codeSha })), null, 2)); writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); });
