import { expect, it } from 'vitest';
import { redactInvitationUrl } from './invitationPrivacy';
it('removes the bearer invitation from absolute and relative analytics URLs', () => {
  expect(redactInvitationUrl('https://tryblueprint.io/signup/business?invitation=private&buyerType=robot_team')).toBe('https://tryblueprint.io/signup/business?buyerType=robot_team');
  expect(redactInvitationUrl('/signup/business?invitation=private')).toBe('/signup/business');
  expect(redactInvitationUrl('https://tryblueprint.io/contact')).toBe('https://tryblueprint.io/contact');
});
