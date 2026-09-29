/** Bounded JSON proof decoder that refuses decoded duplicate object keys. */
export function strictBoundedProofJson(bytes: Buffer, max: number): unknown {
  if (bytes.length < 2 || bytes.length > max) throw new Error("owner_source_invalid");
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) throw new Error("owner_source_invalid");
  let at = 0;
  let nodes = 0;
  const white = () => {
    while (at < text.length && (text[at] === " " || text[at] === "\t"
      || text[at] === "\r" || text[at] === "\n")) at++;
  };
  const string = (): string => {
    if (text[at++] !== '"') throw new Error("owner_source_invalid");
    const start = at - 1;
    let escaped = false;
    while (at < text.length) {
      const char = text[at++];
      if (!escaped && char === '"') return JSON.parse(text.slice(start, at)) as string;
      if (!escaped && char.charCodeAt(0) < 32) throw new Error("owner_source_invalid");
      if (char === "\\" && !escaped) escaped = true;
      else escaped = false;
    }
    throw new Error("owner_source_invalid");
  };
  const value = (depth: number): unknown => {
    if (++nodes > 100_000 || depth > 32) throw new Error("owner_source_invalid");
    white();
    const char = text[at];
    if (char === '"') return string();
    if (char === "{") {
      at++;
      const record: Record<string, unknown> = Object.create(null);
      const seen = new Set<string>();
      white();
      if (text[at] === "}") { at++; return record; }
      while (true) {
        white();
        if (text[at] !== '"') throw new Error("owner_source_invalid");
        const key = string();
        if (seen.has(key)) throw new Error("owner_source_duplicate_key");
        seen.add(key);
        white();
        if (text[at++] !== ":") throw new Error("owner_source_invalid");
        record[key] = value(depth + 1);
        white();
        const separator = text[at++];
        if (separator === "}") return record;
        if (separator !== ",") throw new Error("owner_source_invalid");
      }
    }
    if (char === "[") {
      at++;
      const result: unknown[] = [];
      white();
      if (text[at] === "]") { at++; return result; }
      while (true) {
        result.push(value(depth + 1));
        white();
        const separator = text[at++];
        if (separator === "]") return result;
        if (separator !== ",") throw new Error("owner_source_invalid");
      }
    }
    for (const [literal, decoded] of [["true", true], ["false", false], ["null", null]] as const) {
      if (text.startsWith(literal, at)) { at += literal.length; return decoded; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(at));
    if (!match) throw new Error("owner_source_invalid");
    at += match[0].length;
    const number = Number(match[0]);
    if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number)))
      throw new Error("owner_source_invalid");
    return number;
  };
  const parsed = value(0);
  white();
  if (at !== text.length) throw new Error("owner_source_invalid");
  return parsed;
}
