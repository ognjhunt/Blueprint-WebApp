import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { inspect, row, sha } from './communications-incident-20261006.mjs';

function fakeSnapshot(path: string, value: unknown) {
  return { exists: value !== null, ref: { path }, updateTime: { seconds: 1, nanoseconds: 123 }, data: () => value };
}
describe('private Oct6 inspection', () => {
  it('uses read-only transactions and refuses capped inventories', async () => {
    let options: unknown;
    const db: any = {
      doc: (path: string) => ({ path }),
      collection: (path: string) => ({ path, limit(cap: number) { return { path, cap }; }, where() { return this; } }),
      runTransaction: async (fn: any, opts: unknown) => {
        options = opts;
        return fn({ get: async (ref: any) => ref.cap ? { size: ref.cap, docs: [] } : fakeSnapshot(ref.path, {}) });
      },
    };
    await expect(inspect(db)).rejects.toThrow('inventory_overflow');
    expect(options).toEqual({ readOnly: true });
  });
  it('retains nanosecond version and full value evidence', () => {
    const value = { lease: { owner: 'synthetic', until: 0 }, unknown: null };
    expect(row(fakeSnapshot('synthetic/doc', value))).toEqual({ path: 'synthetic/doc',
      updateTime: { seconds: 1, nanoseconds: 123 }, value, sha256: sha(value) });
  });
  it('provider inspection is offline, GET-only, exact-bound and fail-closed', () => {
    const source = String.raw`
import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('incident', pathlib.Path('scripts/communications-incident-provider-20261006.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class API:
 def __init__(self):self.calls=[]
 def get(self,kind,id):
  self.calls.append(('GET',kind,id));return {'id':id,'environment':None}
 def listing(self,kind,id):self.calls.append(('LIST',kind,id));return []
class Tests(unittest.TestCase):
 def packet(self):return {'schema':'blueprint.communications-incident-20261006.v1','project':'blueprint-8c1ca','queries':[{'complete':True}],'source':{'session_id':'ses_synthetic'},'nested':{'checkpoint':{'sessionId':'ses_synthetic'}}}
 def test_null_environment(self):
  api=API();p=m.inspect(api,self.packet(),lambda:10);self.assertEqual(len(p['sessions']),1);self.assertIsNone(p['sessions'][0]['environment']);self.assertEqual([x[0] for x in api.calls],['GET','LIST','LIST','LIST'])
 def test_incomplete_no_calls(self):
  api=API();p=self.packet();p['queries'][0]['complete']=False
  with self.assertRaisesRegex(ValueError,'incomplete'):m.inspect(api,p)
  self.assertEqual(api.calls,[])
 def test_unknown_get_fails(self):
  api=API();api.get=lambda *args: (_ for _ in ()).throw(TimeoutError('private provider text'))
  with self.assertRaisesRegex(ValueError,'provider_get_unavailable'):m.inspect(api,self.packet())
 def test_no_agent_list(self):
  api=API();m.inspect(api,self.packet());self.assertFalse(any(x[1]=='sessions' for x in api.calls))
unittest.main()
`;
    expect(() => execFileSync('python3', ['-B', '-c', source], { cwd: process.cwd(), stdio: 'pipe' })).not.toThrow();
  });
});
