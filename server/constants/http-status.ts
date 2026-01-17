/**
 * Response status convention:
 * - 200 OK: successful non-creation responses (reads, idempotent actions).
 * - 201 Created: new resources persisted synchronously.
 * - 202 Accepted: requests accepted for async or out-of-band processing.
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
} as const;
