/**
 * A coarse guess at whether this browser is already on a phone.
 *
 * Used to skip a phone-handoff step -- a QR code, or "scan this to open the
 * recorder on your phone" -- on a page that already knows it is one. A coarse
 * check on purpose: the cost of being wrong is one extra QR code shown on a
 * phone, or one withheld on a desktop that can still copy the URL out of its
 * own address bar.
 */
export function isLikelyPhone(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
