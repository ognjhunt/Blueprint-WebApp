/**
 * The model pass over free text (`server/utils/freeTextScreening.ts`) in unit tests. Without a scripted pass no
 * provider is configured, so the other side reads none of a person's words (it fails closed). Tests that read words
 * through the company's or the site's page script it: `modelPassFindsNothing` says the model found nothing more than the
 * deterministic pass took out; `modelPassRemoves` points at the given pieces; `modelPassFails` never answers.
 */
import { resetFreeTextScreeningForTests, useFreeTextRedactor } from "../../utils/freeTextScreening";

export function modelPassFindsNothing() {
  resetFreeTextScreeningForTests();
  useFreeTextRedactor(async () => []);
}

export function modelPassRemoves(pieces: readonly string[]) {
  resetFreeTextScreeningForTests();
  useFreeTextRedactor(async ({ text }) => pieces.filter(piece => text.toLowerCase().includes(piece.toLowerCase())));
}

export function modelPassFails() {
  resetFreeTextScreeningForTests();
  useFreeTextRedactor(async () => null);
}

export { resetFreeTextScreeningForTests };
