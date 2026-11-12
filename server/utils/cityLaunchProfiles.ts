// Only the city slug helper is still used (waitlist, lead enrichment, spend ledger keys).
// The city-launch profiles and their playbook paths were retired on 2026-11-12.
export function slugifyCityName(city: string) {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
