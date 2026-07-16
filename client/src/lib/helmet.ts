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

// Reflect.get keeps the CJS-default probe invisible to Rollup's static export
// analysis; a literal `.default` member access makes every client build warn
// `"default" is not exported by react-helmet-async/lib/index.esm.js`.
const lib = ((Reflect.get(ReactHelmetAsync as object, "default") as
  | HelmetModule
  | undefined) ?? ReactHelmetAsync) as unknown as HelmetModule;

export const Helmet = lib.Helmet;
export const HelmetProvider = lib.HelmetProvider;
export type { HelmetServerState } from "react-helmet-async";
