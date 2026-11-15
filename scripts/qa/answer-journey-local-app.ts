/**
 * Disposable core-journey harness: the reliability harness (real intake, upload
 * and task-brief routers, Firestore/Storage emulators, the normal Vite app, every
 * outbound request blocked) plus the routers the rest of the journey uses: the job
 * page, the deployment company's application, approval, library, job page, media and
 * answer, and the follow-up links. Accounts come from the local Auth emulator.
 *
 * Real: every Express router mounted here, the coverage queue (`tickCoverageReviews`),
 * the coverage review, the agent runtime and its spend admission, the video adapter
 * (including the ffmpeg audio strip on the actual uploaded bytes), the answer composer,
 * the lifecycle email enqueue, Firestore and Storage (emulators).
 *
 * Faked, and only at the edge:
 *  - THE VIDEO MODEL. Requests to the model host get a SCRIPTED, SYNTHETIC reply
 *    (`syntheticReading` below). No model watches the video; the numbers are invented
 *    test values for one carton pick-and-place. Nothing reaches the provider.
 *  - The bucket's signed read URL. Signing needs a service-account key, so the URL is
 *    shaped like a production one (https, storage host) without a real signature, and
 *    the harness serves that host's GET from the local Storage emulator. Its DNS answer
 *    is a fixed public address that is never connected to.
 *  - Scheduling: the production schedulers stay off; loopback-only `/api/reliability/*`
 *    routes run the same entry points on demand (`tickCoverageReviews`, `sweepAutomaticSends`,
 *    `sweepOutcomeQuestions`, `sweepWebsiteJobWindow`).
 * Email is never delivered: the outbox is only read back (`GET /api/reliability/outbox`).
 */
import http from 'node:http';
import https from 'node:https';
import dnsPromises from 'node:dns/promises';
import { syncBuiltinESMExports } from 'node:module';
import type { Express, Request, Response, NextFunction } from 'express';

const MODEL_HOST = 'generativelanguage.googleapis.com';
const SIGNED_READ_HOST = 'storage.googleapis.com';
/** A public address for the guard's DNS check; the harness never opens a connection to it. */
const SIGNED_READ_ADDRESS = '142.250.80.123';
const SYNTHETIC_SIGNATURE = 'harness-synthetic-unsigned';

/**
 * SYNTHETIC. A scripted video-model reading of one carton moved from a conveyor end
 * to a cart. Invented, plausible test values; not produced by looking at any video.
 */
const syntheticReading = {
  object: 'sealed cardboard carton',
  object_largest_side_m: 0.45,
  object_mass_kg_low: 8,
  object_mass_kg_high: 11,
  object_surface: 'matte',
  pick_to_place_m: 1.6,
  pick_height_m: 0.85,
  place_height_m: 0.75,
  front_clearance_m: 0.9,
  other_items_likely: [] as string[],
  cycle_seconds: 9,
  basis: 'Synthetic reading scripted by the local test harness; no model watched this video.',
};
const SYNTHETIC_TASK = 'Pick up the sealed carton from the end of the conveyor and place it on the cart.';

const harness = {
  videoModel: { generateCalls: 0, uploads: [] as Array<{ bytes: number; contentType: string | null }>, deletes: 0 },
  signedReads: 0,
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}) } });
}

/** The scripted model endpoint: the Files API upload, the generation call and the delete. */
async function scriptedVideoModel(url: URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  // The resumable upload URL is the only request the adapter sends without its key, as with the real API.
  const uploadSession = url.searchParams.get('upload_id') === 'harness-synthetic';
  if (!uploadSession && headers.get('x-goog-api-key') !== 'harness-synthetic-not-a-key') return json({ error: 'harness: unexpected key' }, { status: 401 });
  if (method === 'POST' && url.pathname === '/upload/v1beta/files' && !uploadSession) {
    return json({}, { headers: { 'x-goog-upload-url': `https://${MODEL_HOST}/upload/v1beta/files?upload_id=harness-synthetic` } });
  }
  if (method === 'POST' && url.pathname === '/upload/v1beta/files') {
    // Read the audio-free copy the adapter sends, so its bytes are really produced and counted.
    const bytes = init.body ? (await new Response(init.body as BodyInit).arrayBuffer()).byteLength : 0;
    harness.videoModel.uploads.push({ bytes, contentType: headers.get('content-type') });
    return json({ file: { name: 'files/harness-synthetic', uri: `https://${MODEL_HOST}/v1beta/files/harness-synthetic`,
      mimeType: headers.get('content-type') || 'video/mp4', state: 'ACTIVE' } });
  }
  if (method === 'DELETE' && url.pathname.startsWith('/v1beta/files/')) { harness.videoModel.deletes++; return json({}); }
  if (method === 'POST' && url.pathname.endsWith(':generateContent')) {
    harness.videoModel.generateCalls++;
    const request = JSON.parse(String(init.body || '{}'));
    const prompt: string = request.contents?.[0]?.parts?.find((part: { text?: string }) => typeof part.text === 'string')?.text ?? '';
    const viewIds = [...new Set([...prompt.matchAll(/"id":\s*"([^"]+)",\s*"label"/g)].map(match => match[1]))];
    const draftsTask = /proposed_task_statement: the site has not described its job/.test(prompt);
    const reading = {
      covers_scene: true,
      views: (viewIds.length ? viewIds : ['work-area']).map(id => ({ id, status: 'seen', timestamp_seconds: 1, note: 'Synthetic harness reading.' })),
      missing_views: [], supplement_would_finish: false, unreadable_reasons: [], confidence: 0.9,
      job_estimates: syntheticReading,
      proposed_task_statement: draftsTask ? SYNTHETIC_TASK : null,
    };
    return json({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: JSON.stringify(reading) }] } }],
      usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 400, totalTokenCount: 2400 }, modelVersion: 'harness-synthetic' });
  }
  return json({ error: 'harness: no scripted reply for this model request' }, { status: 404 });
}

function installEdgeFakes(bucketName: string) {
  // The model host is answered by the script; everything else keeps the base guard (loopback only).
  const guardedFetch = globalThis.fetch;
  globalThis.fetch = ((input: any, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname === MODEL_HOST) return scriptedVideoModel(url, input instanceof Request ? { method: input.method, headers: input.headers, body: input.body, ...init } : init);
    return guardedFetch(input, init);
  }) as typeof fetch;

  // The signed read URL's host resolves to a fixed public address and its GET is served
  // by the Storage emulator. Any other host keeps the real lookup and the base guard.
  const realLookup = dnsPromises.lookup.bind(dnsPromises);
  (dnsPromises as any).lookup = (hostname: string, options?: any) => hostname === SIGNED_READ_HOST
    ? Promise.resolve(options?.all ? [{ address: SIGNED_READ_ADDRESS, family: 4 }] : { address: SIGNED_READ_ADDRESS, family: 4 })
    : realLookup(hostname, options);
  const guardedHttpsRequest = https.request;
  https.request = ((input: any, options?: any, callback?: any) => {
    const url = input instanceof URL ? input : typeof input === 'string' ? new URL(input) : null;
    if (url?.hostname !== SIGNED_READ_HOST) return (guardedHttpsRequest as any)(input, options, callback);
    if (url.searchParams.get('X-Goog-Signature') !== SYNTHETIC_SIGNATURE) throw new Error('harness: unsigned storage read refused');
    const [, bucket, ...object] = url.pathname.split('/');
    if (bucket !== bucketName) throw new Error('harness: storage read outside the demo bucket');
    const generation = url.searchParams.get('generation');
    harness.signedReads++;
    return http.request({ host: '127.0.0.1', port: 9199, method: 'GET', agent: false,
      path: `/v0/b/${bucket}/o/${encodeURIComponent(decodeURIComponent(object.join('/')))}?alt=media${generation ? `&generation=${generation}` : ''}`,
      headers: { Authorization: 'Bearer owner', 'Accept-Encoding': 'identity' } }, typeof options === 'function' ? options : callback);
  }) as typeof https.request;
  // Named imports of builtins (`import { request } from "node:https"`) see the patched
  // functions only after this; it also extends the base outbound guard to them.
  syncBuiltinESMExports();
}

function loopbackOnly(req: Request, res: Response, next: NextFunction) {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return res.status(403).json({ error: 'loopback only' });
  next();
}

(globalThis as { __reliabilityHarnessExtension?: (app: Express) => Promise<void> }).__reliabilityHarnessExtension = async (app) => {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET!;
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') throw new Error('The local Auth emulator is required');
  if (!/^demo-blueprint-reliability(?:-a|-b)?\.appspot\.com$/.test(bucketName)) throw new Error('Demo bucket required');
  const [{ csrfProtection }, { default: verifyFirebaseToken }, { requireAdminRole }, { default: jobWorkflow }, { default: siteWorlds },
    { default: companyMedia }, { default: robotTeamAccess }, { default: adminRobotTeamAccess }, { default: jobOutcomes },
    { default: workspace }, queue, { default: admin }] = await Promise.all([
    import('../../server/middleware/csrf'), import('../../server/middleware/verifyFirebaseToken'), import('../../server/middleware/requireAdminRole'),
    import('../../server/routes/job-workflow'), import('../../server/routes/site-worlds'), import('../../server/routes/company-media'),
    import('../../server/routes/robot-team-access'), import('../../server/routes/admin-robot-team-access'), import('../../server/routes/job-outcomes'),
    import('../../server/routes/workspace'), import('../../server/utils/captureCoverageQueue'), import('firebase-admin'),
  ]);
  // The app the product's firebaseAdmin module initialized against the emulators.
  const firebaseApp = admin.apps[0];
  if (!firebaseApp) throw new Error('Emulator-backed Firestore and Storage are required');
  const dbAdmin = admin.firestore(firebaseApp), storageAdmin = admin.storage(firebaseApp);
  // Signing a read URL needs a service-account key; the harness issues an unsigned one
  // in the production shape, which only the fake above will serve.
  const File = storageAdmin.bucket(bucketName).file('harness-probe').constructor as { prototype: any };
  File.prototype.getSignedUrl = async function getSignedUrl(this: { name: string; bucket: { name: string } }, config?: { queryParams?: Record<string, string> }) {
    const generation = config?.queryParams?.generation;
    return [`https://${SIGNED_READ_HOST}/${this.bucket.name}/${this.name.split('/').map(encodeURIComponent).join('/')}?X-Goog-Signature=${SYNTHETIC_SIGNATURE}${generation ? `&generation=${encodeURIComponent(generation)}` : ''}`];
  };
  installEdgeFakes(bucketName);

  // The private job page's own reads (and the deployment-company step it can turn on).
  app.use('/api/job-workflow', csrfProtection, jobWorkflow);
  // The deployment company's side and the job's follow-ups, mounted as server/routes.ts mounts them. Accounts are
  // real Firebase ID tokens from the Auth emulator, verified by the product's own middleware.
  app.use('/api/workspace', csrfProtection, verifyFirebaseToken, workspace);
  app.use('/api/company-media', companyMedia);
  app.use('/api/job-outcomes', jobOutcomes);
  app.use('/api/robot-team-access', csrfProtection, robotTeamAccess);
  app.use('/api/admin/robot-team-access', csrfProtection, verifyFirebaseToken, requireAdminRole, adminRobotTeamAccess);
  app.use('/api/site-worlds', siteWorlds);

  // Runs the production entry point once and waits for its single pass to finish.
  // The queue walks pending reviews ten at a time from a stored cursor, so a job can need more
  // than one pass; with `requestId` this ticks until that job's review has left the queue.
  app.post('/api/reliability/tick', loopbackOnly, async (req, res) => {
    const requestId = typeof req.query.requestId === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(req.query.requestId) ? req.query.requestId : null;
    const before = harness.videoModel.generateCalls;
    const deadline = Date.now() + 120_000;
    let passes = 0, pending = true;
    while (Date.now() < deadline && passes < 25) {
      queue.tickCoverageReviews(10);
      passes++;
      while (queue.isCoverageReviewActive() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      pending = requestId ? (await dbAdmin.collection('inboundRequests').doc(requestId).get()).data()?.capture_coverage_pending === true : false;
      if (!pending) break;
    }
    res.json({ finished: !queue.isCoverageReviewActive() && !pending, passes, videoModelCalls: harness.videoModel.generateCalls - before });
  });
  // Runs the job-window sweep's production entry point for one job at a given time, as its scheduler would.
  app.post('/api/reliability/job-window-sweep', loopbackOnly, async (req, res) => {
    const requestId = String(req.query.requestId || '');
    const atMs = Number(req.query.atMs);
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(requestId) || !Number.isFinite(atMs)) return res.status(400).json({ error: 'requestId and atMs required' });
    const { sweepWebsiteJobWindow } = await import('../../server/utils/websiteJobWindowSweep');
    res.json({ result: await sweepWebsiteJobWindow(requestId, atMs) });
  });
  // One pass of the automatic send (the worker's sweep), on demand.
  app.post('/api/reliability/auto-send', loopbackOnly, async (_req, res) => {
    const { sweepAutomaticSends } = await import('../../server/utils/jobAutoSend');
    res.json(await sweepAutomaticSends());
  });
  // One pass of the outcome-question sweep at a given time (the worker runs it every 15 minutes at "now").
  app.post('/api/reliability/outcomes', loopbackOnly, async (req, res) => {
    const atMs = Number(req.query.atMs);
    if (!Number.isFinite(atMs)) return res.status(400).json({ error: 'atMs required' });
    const { sweepOutcomeQuestions } = await import('../../server/utils/jobOutcomes');
    res.json(await sweepOutcomeQuestions({ now: new Date(atMs) }));
  });
  // What is recorded for one job: its billable events, its company sends and introductions (ids and times only),
  // and whether approved companies may see it (the product's own predicate).
  app.get('/api/reliability/job', loopbackOnly, async (req, res) => {
    const requestId = String(req.query.requestId || '');
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) return res.status(400).json({ error: 'requestId required' });
    const [{ listJobBillableEvents }, { loadCompanyJobAccess }] = await Promise.all([
      import('../../server/utils/billableEvents'), import('../../server/utils/teamJobAccess')]);
    const job = dbAdmin.collection('inboundRequests').doc(requestId);
    const [billable, sends, introductions, { access }] = await Promise.all([listJobBillableEvents(requestId),
      job.collection('companySends').get(), job.collection('introductions').get(), loadCompanyJobAccess(requestId)]);
    res.json({ billable, sends: sends.docs.map(row => ({ id: row.id, ...row.data() })),
      introductions: introductions.docs.map(row => ({ id: row.id, introducedAtIso: row.data().introducedAtIso ?? null })),
      access: { listed: access.listed, reason: access.reason } });
  });
  // The outbox rows for one job: what would be sent. Nothing here delivers mail.
  app.get('/api/reliability/outbox', loopbackOnly, async (req, res) => {
    const requestId = String(req.query.requestId || '');
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(requestId)) return res.status(400).json({ error: 'requestId required' });
    const rows = await dbAdmin.collection('captureOutbox').where('requestId', '==', requestId).get();
    res.json({ rows: rows.docs.map(row => { const value = row.data(); return { idempotencyKey: value.idempotencyKey, kind: value.kind,
      status: value.status, subject: value.subject, body: value.body, to: String(value.to || '').toLowerCase() }; }) });
  });
  app.get('/api/reliability/health', (_req, res) => res.json({ layer: 'real-handlers/firebase-emulators/scripted-synthetic-video-model',
    project: process.env.GOOGLE_CLOUD_PROJECT, providerDispatchEnabled: false, videoModelMode: 'scripted-synthetic', schedulersEnabled: false,
    notificationDeliveryEnabled: false, ...harness }));
};

await import('./reliability-local-app');
