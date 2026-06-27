// Interop shim for react-helmet-async.
//
// The package ships no "exports" map, so module resolution differs by environment:
//   - Bundlers (Vite) resolve the ESM build, which has NAMED exports and no default.
//   - Node ESM (the `tsx` prerender) resolves the CJS build, surfaced as a single
//     `default` object: { Helmet, HelmetProvider, HelmetData }.
// Importing `{ Helmet }` directly therefore works under Vite but throws under Node
// ("does not provide an export named 'Helmet'"). Normalize both shapes here so the
// rest of the app can import { Helmet, HelmetProvider } from "@/lib/helmet" cleanly.
import * as ReactHelmetAsync from "react-helmet-async";

type HelmetModule = typeof import("react-helmet-async");

const lib = ((ReactHelmetAsync as unknown as { default?: HelmetModule }).default ??
  ReactHelmetAsync) as unknown as HelmetModule;

export const Helmet = lib.Helmet;
export const HelmetProvider = lib.HelmetProvider;
export type { HelmetServerState } from "react-helmet-async";
