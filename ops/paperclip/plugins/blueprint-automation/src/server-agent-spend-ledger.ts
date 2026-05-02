// @ts-nocheck

export async function requestAgentSpend(input: unknown) {
  const dynamicImport = new Function("specifier", "return import(specifier);") as (specifier: string) => Promise<any>;
  const module = await dynamicImport("../../../../../server/utils/agentSpendLedger.js");
  return module.requestAgentSpend(input);
}
