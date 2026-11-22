// Collection-group document counts (subcollections under any parent). Counts only.
import { count } from './fs_readonly.mjs';
const out = {};
for (const name of process.argv.slice(2)) {
  try { out[name] = await count(name, [], { allDescendants: true }); }
  catch (error) { out[name] = `error: ${String(error.message).slice(0, 200)}`; }
}
console.log(JSON.stringify(out, null, 1));
