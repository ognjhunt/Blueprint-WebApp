// Document counts for every Firestore collection the WebApp server names.
// Counts only: no document is read.
import { count } from './fs_readonly.mjs';

const collections = process.argv.slice(2);
const out = {};
for (const name of collections) {
  try {
    out[name] = await count(name);
  } catch (error) {
    out[name] = `error: ${String(error.message).slice(0, 160)}`;
  }
}
console.log(JSON.stringify(out, null, 1));
