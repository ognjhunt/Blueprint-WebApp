export type SafeImportMetaEnv = Partial<ImportMetaEnv>;

export function getImportMetaEnv(): SafeImportMetaEnv {
  if (typeof import.meta === "undefined") {
    return {};
  }

  return (import.meta as { env?: SafeImportMetaEnv }).env ?? {};
}
