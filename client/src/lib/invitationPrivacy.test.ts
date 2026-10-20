import { expect, it } from 'vitest';
import { redactInvitationUrl, redactTelemetryText, sanitizeTelemetry } from './invitationPrivacy';
it('omits all query and fragment values from absolute and relative analytics URLs', () => {
  expect(redactInvitationUrl('https://tryblueprint.io/signup/business?invitation=private&buyerType=robot_team')).toBe('https://tryblueprint.io/signup/business');
  expect(redactInvitationUrl('/requests/request-id?access=private#token')).toBe('/requests/request-id');
  expect(redactInvitationUrl('https://tryblueprint.io/contact')).toBe('https://tryblueprint.io/contact');
});
it('redacts bearer path segments in frontend and API routes', () => {
  for (const path of ['/capture-upload', '/claim', '/api/self-capture/uploads', '/api/site-task-brief', '/api/site-claim', '/api/task-listings/owner']) {
    expect(redactInvitationUrl(`${path}/private-token/status?access=secret`)).toBe(`${path}/[redacted]/status`);
  }
});
it('scrubs URLs embedded in diagnostics and authorization strings', () => {
  const safe = redactTelemetryText('Failed GET https://tryblueprint.io/capture-upload/private-token?access=secret#fragment Authorization: Bearer abc.private');
  expect(safe).not.toMatch(/private-token|secret|fragment|abc.private/);
  expect(safe).toContain('/capture-upload/[redacted]');
});
it('sanitizes Sentry automatic breadcrumbs, request data and nested credentials', () => {
  const safe = sanitizeTelemetry({
    request: { url: 'https://tryblueprint.io/claim/private-token?token=secret', data: { site: 'private-body' }, headers: { Authorization: 'Bearer private-header' } },
    breadcrumbs: [{ data: { to: '/capture-upload/private-token', accessToken: 'private-token' } }],
    user: { id: 'user-id', email: 'person@example.com' },
    extra: { nested: { secret: 'private-secret' } },
  });
  expect(JSON.stringify(safe)).not.toMatch(/private-token|private-body|private-header|private-secret|person@example.com/);
  expect(safe.user.id).toBe('user-id');
  expect(safe.request.data).toBe('[redacted]');
});
