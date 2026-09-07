// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import { streamTaskEvaluationResultArtifact } from '../utils/taskEvaluationResultArtifactProxy';

class ResponseSink extends Writable {
  code = 200; headers = new Map<string,string>(); chunks: Buffer[] = []; headersSent = false;
  status(code:number) { this.code=code; return this; }
  set(key:string,value:string) { this.headers.set(key.toLowerCase(),value); return this; }
  removeHeader(key:string) { this.headers.delete(key.toLowerCase()); }
  json(value:unknown) { this.set('content-type','application/json'); this.end(JSON.stringify(value)); return this; }
  _write(chunk:Buffer, _encoding:unknown, done:()=>void) { this.headersSent=true; this.chunks.push(Buffer.from(chunk)); done(); }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
beforeEach(() => {
  vi.stubEnv('TASK_EVALUATION_RESULT_ARTIFACT_URL_TEMPLATE','https://fixture.invalid/{run_id}/{artifact_id}');
  vi.stubEnv('ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN','fixture-only');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const invoke = (res:ResponseSink, range='bytes=0-2') => streamTaskEvaluationResultArtifact({runId:'fixture',artifactId:'artifact',req:{headers:{range}} as any,res:res as any});

describe('controlled media streams', () => {
  it('streams 206 bytes and Range metadata without buffering the whole origin', async () => {
    const fetcher=vi.fn().mockResolvedValue(new Response('abc',{status:206,headers:{'content-range':'bytes 0-2/9','content-length':'3','accept-ranges':'bytes'}}));
    vi.stubGlobal('fetch',fetcher); const res=new ResponseSink(); await invoke(res); await flush();
    expect(res.code).toBe(206); expect(Buffer.concat(res.chunks).toString()).toBe('abc');
    expect(res.headers.get('content-range')).toBe('bytes 0-2/9');
    expect(fetcher.mock.calls[0][1].headers.range).toBe('bytes=0-2');
  });
  it.each([[401,502],[403,502],[404,404],[429,429],[500,502],[416,416]])('returns readable origin %s as %s',async(origin,expected)=>{
    const cancel=vi.fn();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:origin,headers:new Headers({'retry-after':'7','content-range':'bytes */9'}),body:{cancel}}));
    const res=new ResponseSink(); await invoke(res); await flush();
    expect(res.code).toBe(expected); expect(JSON.parse(Buffer.concat(res.chunks).toString()).error).toBeTruthy();
    expect(cancel).toHaveBeenCalledOnce();
    if(origin===429) expect(res.headers.get('retry-after')).toBe('7');
    if(origin===416) expect(res.headers.get('content-range')).toBe('bytes */9');
  });
  it('aborts an origin request when the browser disconnects before headers',async()=>{
    let signal!:AbortSignal;
    vi.stubGlobal('fetch',vi.fn((_url,init)=>new Promise((_resolve,reject)=>{signal=init.signal; signal.addEventListener('abort',()=>reject(new Error('abort')));} )));
    const res=new ResponseSink(); const pending=invoke(res); res.destroy(); await pending;
    expect(signal.aborted).toBe(true); expect(res.chunks).toHaveLength(0);
  });
  it('cancels a slow source after the browser disconnects',async()=>{
    const cancel=vi.fn(); const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('first'));},cancel});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body)));
    const res=new ResponseSink(); await invoke(res); await flush(); res.destroy(); await flush();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('returns a readable error before bytes and terminates an interrupted partial response',async()=>{
    for(const partial of [false,true]) {
      let source!:ReadableStreamDefaultController;
      const body=new ReadableStream({start(c){source=c;}});
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(body,{headers:{'content-length':'99'}})));
      const res=new ResponseSink(); await invoke(res);
      if(partial){source.enqueue(new TextEncoder().encode('first')); await flush();}
      source.error(new Error('private origin details')); await flush(); await flush();
      if(partial) { expect(res.destroyed).toBe(true); expect(Buffer.concat(res.chunks).toString()).toBe('first'); }
      else { expect(res.code).toBe(502); expect(res.headers.has('content-length')).toBe(false); expect(Buffer.concat(res.chunks).toString()).toContain('interrupted'); }
    }
  });
});
