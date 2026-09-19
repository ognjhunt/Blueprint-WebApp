/**
 * The camera is a permission, not a default.
 *
 * `Permissions-Policy` here denies every powerful feature everywhere — except
 * the one page whose entire job is filming the work area. A flat `camera=()`
 * header once banned the camera site-wide including on `/capture-upload`, so
 * the guided recorder failed its permission check on every browser that honors
 * the policy, the visitor read "camera access was blocked", and the file-picker
 * fallback quietly absorbed the loss. The denial and the one opt-in live in the
 * same function so neither can drift: adding another capturing surface means
 * naming it here, in review, not silently widening a global header.
 */
export function permissionsPolicyForPath(path: string): string {
  const camera =
    path === "/capture-upload" || path.startsWith("/capture-upload/") ? "(self)" : "()";
  return `camera=${camera}, microphone=(self), geolocation=(), interest-cohort=()`;
}
