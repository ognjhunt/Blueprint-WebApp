export const ADMIN_EMAILS = ["ohstnhunt@gmail.com", "ops@tryblueprint.io"];

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email));
}
