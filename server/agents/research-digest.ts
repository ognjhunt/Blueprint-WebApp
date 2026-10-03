import { createHash } from "node:crypto";
const codepointOrder = (a: string, b: string) => {
  const left = Array.from(a), right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index].codePointAt(0)! - right[index].codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
};

/** Python json.dumps(sort_keys=True, separators=(',', ':'), ensure_ascii=True).
 * Retained provider float bytes are hashed separately. Parsed candidate/packet
 * contracts use integers; refuse unsupported float lexemes without guessing.
 */
export function researchDigest(value: unknown): string {
  const encode = (item: any): string => {
    if (typeof item === "number" && !Number.isSafeInteger(item)) throw new Error("research_number_contract_unsupported");
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item && typeof item === "object") return `{${Object.keys(item).sort(codepointOrder).map(key => `${encode(key)}:${encode(item[key])}`).join(",")}}`;
    const json = JSON.stringify(item);
    if (json === undefined) throw new Error("research_digest_value_invalid");
    return json.replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  };
  return createHash("sha256").update(encode(value)).digest("hex");
}

/** Verification-specific canonical encoding. JSON readers lose numeric
 * lexemes (1 vs 1.0); finite numbers use unquoted n:<float64 big-endian hex>.
 * Strings cannot collide with these typed tokens. Historical packet hashes
 * remain on researchDigest, and original provider/report bytes are retained.
 */
export function verificationDigest(value: unknown): string {
  const encode = (item: any): string => {
    if (typeof item === "number") {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) throw new Error("verification_number_nonportable");
      const bytes = Buffer.alloc(8); bytes.writeDoubleBE(item); return `n:${bytes.toString("hex")}`;
    }
    if (Array.isArray(item)) return `[${item.map(encode).join(",")}]`;
    if (item && typeof item === "object") return `{${Object.keys(item).sort(codepointOrder).map(key => `${encode(key)}:${encode(item[key])}`).join(",")}}`;
    const json = JSON.stringify(item);
    if (json === undefined) throw new Error("verification_digest_value_invalid");
    return json.replace(/[\u007f-\uffff]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  };
  return createHash("sha256").update(encode(value)).digest("hex");
}
