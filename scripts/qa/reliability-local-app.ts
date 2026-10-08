/** Disposable emulator-backed normal UI. No schedulers, real mail, or provider dispatch. */
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const project = process.env.GOOGLE_CLOUD_PROJECT;
if (!/^demo-blueprint-reliability(?:-a|-b)?$/.test(project ?? '') || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080'
    || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') throw new Error('Disposable demo project and local emulators are required');
if (Object.keys(process.env).some(key => /^(OPENAI_API_KEY|DEEPSEEK_API_KEY|ANTHROPIC_API_KEY|RESEND_API_KEY|FIREBASE_SERVICE_ACCOUNT_JSON|GOOGLE_APPLICATION_CREDENTIALS)$/.test(key))) throw new Error('Live credentials prohibited');
const port = Number(process.env.RELIABILITY_APP_PORT);
function loopbackHost(host: string) { return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(host); }
function assertLocal(input: any) {
  const hostname = input instanceof URL ? input.hostname : typeof input === 'string' ? new URL(input).hostname : input?.hostname ?? input?.host ?? 'localhost';
  if (!loopbackHost(String(hostname).replace(/:\d+$/, ''))) throw new Error('Reliability harness blocked external dispatch');
}
for (const module of [http, https]) {
  const request = module.request.bind(module), get = module.get.bind(module);
  module.request = ((input: any, ...args: any[]) => { assertLocal(input); return (request as any)(input, ...args); }) as typeof module.request;
  module.get = ((input: any, ...args: any[]) => { assertLocal(input); return (get as any)(input, ...args); }) as typeof module.get;
}
const originalFetch = globalThis.fetch;
globalThis.fetch = ((input: any, options?: any) => { assertLocal(input instanceof Request ? input.url : input); return originalFetch(input, { ...options, redirect: 'error' }); }) as typeof fetch;
// Probe the emulator TCP ports before importing routes; there is no production fallback.
for (const dependencyPort of [8080, 9199]) await new Promise<void>((resolve, reject) => {
  const socket = net.connect(dependencyPort, '127.0.0.1'); socket.setTimeout(2000);
  socket.once('connect', () => { socket.destroy(); resolve(); }); socket.once('error', reject); socket.once('timeout', () => { socket.destroy(); reject(new Error('Local emulator unavailable')); });
});
const [{ default: express }, { createServer: createVite }, { default: react }, { default: theme }, { csrfProtection, csrfCookieHandler }, { default: intake }, { default: uploads }, { default: brief }] = await Promise.all([
  import('express'), import('vite'), import('@vitejs/plugin-react'), import('@replit/vite-plugin-shadcn-theme-json'), import('../../server/middleware/csrf'), import('../../server/routes/inbound-request'), import('../../server/routes/self-capture-uploads'), import('../../server/routes/site-task-brief'),
]);
const app = express(); app.use(express.json({ limit: '8mb' }));
app.get('/api/csrf', csrfCookieHandler); app.get('/api/csrf-token', csrfCookieHandler);
app.use('/api/inbound-request', csrfProtection, intake);
app.use('/api/self-capture/uploads', uploads); app.use('/api/site-task-brief', brief);
app.get('/api/reliability/health', (_req, res) => res.json({ layer: 'real-handlers/firebase-emulators/no-provider', project, code: 'local working tree', providerDispatchEnabled: false, schedulersEnabled: false, notificationDeliveryEnabled: false }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route outside scoped reliability harness' }));
const output = path.resolve('/workspace/reliability-program/emulator-ui'); await mkdir(path.join(output, 'no-env'), { recursive: true });
const vite = await createVite({ configFile: false, root: path.resolve('client'), envDir: path.join(output, 'no-env'), cacheDir: path.join(output, 'vite-cache'), plugins: [react(), theme()], resolve: { alias: { '@': path.resolve('client/src') } }, server: { middlewareMode: true, fs: { allow: [path.resolve('.'), path.resolve('node_modules')] } }, appType: 'spa' });
app.use(vite.middlewares);
const server = http.createServer(app); server.listen(port, '127.0.0.1', () => console.log(`Disposable reliability UI listening on http://127.0.0.1:${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, async () => { server.closeAllConnections(); await vite.close(); server.close(() => process.exit(0)); });
