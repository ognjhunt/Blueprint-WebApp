/** Successful authenticated Render MCP reads retain their raw transport evidence.
 * No HTTP status is inferred. Parent pins original call envelopes separately.
 */
import { canonical, sha, refuse } from './communications-incident-20261006.mjs';

const WORKER = 'srv-d9t8gg1t0dsc73am9q70', WEB = 'srv-d4vnmk3e5dus73aiohk0';
const SCHEMA = 'blueprint.render-mcp-read.v1';
function operation(call) {
  const tool = call?.tool?.split('__').at(-1);
  if (!['get_service', 'get_deploy', 'list_logs'].includes(tool)) refuse('mcp_read_operation_unbound');
  return tool;
}
function times(call) {
  const start = Date.parse(call?.requestedAtUtc), end = Date.parse(call?.respondedAtUtc);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) refuse('mcp_read_time_unbound');
  return { start, end };
}
function parsed(call) {
  if (call?.result?.isError !== undefined && call.result.isError !== false || !Array.isArray(call?.result?.content)
    || call.result.content.length !== 1 || call.result.content[0]?.type !== 'text'
    || typeof call.result.content[0].text !== 'string') refuse('mcp_read_result_unbound');
  let body; try { body = JSON.parse(call.result.content[0].text); } catch { refuse('mcp_read_json_unavailable'); }
  const op = operation(call), key = op === 'get_service' ? 'service' : op === 'get_deploy' ? 'deploy' : null;
  // Preserve a tool's documented single wrapper and full raw envelope. Never
  // search recursively for a convenient partial response.
  if (key && !body?.id && Object.keys(body ?? {}).length === 1 && body?.[key]?.id) body = body[key];
  return body;
}
function equivalent(call, url) {
  const args = call.arguments, op = operation(call);
  if (!args || typeof args.workspaceId !== 'string' || !/^tea-[a-zA-Z0-9]+$/.test(args.workspaceId)) return false;
  const target = new URL(url);
  if (target.origin !== 'https://api.render.com') return false;
  if (op === 'list_logs') return target.pathname === '/v1/logs'
    && target.searchParams.get('ownerId') === args.workspaceId && target.searchParams.get('resource') === WEB
    && (args.resource === WEB || (Array.isArray(args.resource) && canonical(args.resource) === canonical([WEB])));
  if (![WORKER, WEB].includes(args.serviceId)) return false;
  const path = `/v1/services/${args.serviceId}`;
  return op === 'get_service' ? target.pathname === path && !target.search
    : typeof args.deployId === 'string' && /^dep-[a-zA-Z0-9]+$/.test(args.deployId)
      && target.pathname === `${path}/deploys/${args.deployId}` && !target.search;
}
function materialize(calls, url) {
  if (!Array.isArray(calls) || !calls.length || calls.length > 100) refuse('mcp_read_inventory_incomplete');
  const op = operation(calls[0]);
  if (calls.some(c => operation(c) !== op || !equivalent(c, url))) refuse('mcp_read_resource_unbound');
  const bodies = calls.map(parsed), observations = calls.map(times);
  if (observations.some((at, i) => i && at.start < observations[i - 1].end)) refuse('mcp_read_page_order_unbound');
  if (op !== 'list_logs') {
    if (calls.length !== 1) refuse('mcp_read_single_resource_unbound');
    const args = calls[0].arguments;
    if (bodies[0]?.id !== (op === 'get_service' ? args.serviceId : args.deployId)) refuse('mcp_read_result_identity_changed');
    return { body: bodies[0], observedAtMs: observations[0].end };
  }
  if (bodies.some((body, i) => !Array.isArray(body?.logs) || typeof body.hasMore !== 'boolean'
    || body.hasMore !== (i !== bodies.length - 1)
    || body.hasMore && (typeof body.nextStartTime !== 'string' || !Number.isFinite(Date.parse(body.nextStartTime))
      || typeof body.nextEndTime !== 'string' || !Number.isFinite(Date.parse(body.nextEndTime)))
    || i && (calls[i].arguments.startTime !== bodies[i - 1].nextStartTime
      || calls[i].arguments.endTime !== bodies[i - 1].nextEndTime))) refuse('mcp_read_logs_incomplete');
  return { body: { ...bodies.at(-1), hasMore: false, logs: bodies.flatMap(body => body.logs) }, observedAtMs: observations.at(-1).end };
}
export function mcpReceipt(calls, url) {
  const value = materialize(calls, url);
  return { method: 'GET', url, urlKind: 'documented_read_equivalent', transport: 'render_mcp',
    status: null, httpStatusObserved: false, ...value, mcp: { schema: SCHEMA, calls } };
}
export function mcpReadScope(receipt) {
  const calls = receipt?.mcp?.calls;
  if (!calls?.length) refuse('mcp_read_inventory_incomplete');
  return { tool: calls[0].tool, operation: operation(calls[0]), workspaceId: calls[0].arguments.workspaceId };
}
export function successfulRead(receipt, authority, now) {
  // A retained MCP result cannot become an HTTP success by editing its label.
  if (receipt?.status === 200 && receipt.transport !== 'render_mcp' && receipt.mcp === undefined
    && receipt.httpStatusObserved !== false && receipt.urlKind !== 'documented_read_equivalent') return true;
  if (receipt?.status !== null || receipt.httpStatusObserved !== false || receipt.transport !== 'render_mcp'
    || receipt.urlKind !== 'documented_read_equivalent' || receipt.method !== 'GET' || receipt.mcp?.schema !== SCHEMA
    || authority?.expectedMcpReceiptDigests?.[receipt.url] !== sha(receipt.mcp)) return false;
  try {
    const value = materialize(receipt.mcp.calls, receipt.url);
    if (canonical(mcpReadScope(receipt)) !== canonical(authority?.expectedMcpReadScope?.[receipt.url])
      || receipt.mcp.calls.some(call => call.tool !== receipt.mcp.calls[0].tool)) return false;
    return value.observedAtMs === receipt.observedAtMs && canonical(value.body) === canonical(receipt.body)
      && receipt.mcp.calls.every(call => { const at = times(call); return at.end <= now + 5000 && now - at.end <= 300000; });
  } catch { return false; }
}
