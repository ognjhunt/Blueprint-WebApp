/**
 * The camera is a permission, not a default.
 *
 * Powerful features are scoped to their opt-in surfaces: filming the work area
 * and preferring nearby addresses on site intake. A flat `camera=()`
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
  const geolocation = path.replace(/\/$/, "") === "/contact/site-operator" ? "(self)" : "()";
  return `camera=${camera}, microphone=(self), geolocation=${geolocation}, interest-cohort=()`;
}
