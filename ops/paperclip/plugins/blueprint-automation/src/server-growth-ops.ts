// @ts-nocheck

export async function loadGrowthOpsModule() {
  const dynamicImport = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<any>;
  return await dynamicImport("../../../../../server/utils/growth-ops.js");
}
