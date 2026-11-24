/**
 * The model pass over free text (`server/utils/freeTextScreening.ts`) in unit tests. Without a scripted pass no
 * provider is configured, so the other side reads none of a person's words (it fails closed). Tests that read words
 * through the company's or the site's page script it: `modelPassFindsNothing` says the model found nothing more than the
 * deterministic pass took out; `modelPassRemoves` points at the given pieces; `modelPassFails` never answers.
 */
import { removalsOf, resetFreeTextScreeningForTests, useFreeTextRedactor } from "../../utils/freeTextScreening";

export function modelPassFindsNothing() {
  resetFreeTextScreeningForTests();
  useFreeTextRedactor(async () => []);
}

export function modelPassRemoves(pieces: readonly string[]) {
  resetFreeTextScreeningForTests();
  // Only the pieces in this text as whole words: a piece the text does not hold would fail the pass closed.
  useFreeTextRedactor(async ({ text }) => pieces.filter(piece => removalsOf(text, [piece]).unmatched.length === 0));
}

export function modelPassFails() {
  resetFreeTextScreeningForTests();
  useFreeTextRedactor(async () => null);
}

export { resetFreeTextScreeningForTests };
