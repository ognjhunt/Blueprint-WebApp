import { policyAdapterSchema, type PolicyAdapter } from "@/types/policyAdapter";

export function readPolicyAdapter(form: FormData): PolicyAdapter | undefined {
  const text = String(form.get("policyConfig") || "").trim();
  if (!text) return undefined;
  try { return policyAdapterSchema.parse(JSON.parse(text)); }
  catch { throw new Error("Check the Dream model ID and its three named camera roles."); }
}

/** Public protocol settings only; the existing checkpoint form stores credentials separately. */
export function PolicyAdapterFields({ value }: { value?: PolicyAdapter }) {
  return <details className="ws-section" open={Boolean(value)}>
    <summary>Dream API adapter</summary>
    <label className="block text-sm">Protocol settings (JSON)
      <textarea name="policyConfig" rows={5} maxLength={2000} spellCheck={false}
        defaultValue={value ? JSON.stringify(value, null, 2) : ""}
        placeholder={'{"policy_interface_id":"dreamlabs_dream1.v1","model_id":"dreamlabs/dream-1","camera_roles":{"overhead":"overview","wrist_l":"left_wrist","wrist_r":"right_wrist"}}'}
        className="mt-1 block w-full rounded border border-line p-2 font-mono text-xs" />
    </label>
    <p className="ws-note">Use the exact model ID available to your Dream account and camera names from your robot manifest. Save the token in Policy token.</p>
  </details>;
}
