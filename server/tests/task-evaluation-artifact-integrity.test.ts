// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { artifactResponseIntegrity, parseResultArtifactRange, resultArtifactMetadata, ResultArtifactIntegrityStream } from "../utils/taskEvaluationArtifactIntegrity";
const sha = (value: string) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const response = (status = 200, headers: Record<string,string> = {}) => ({ status, headers: new Headers({ 'content-length':'3', 'x-blueprint-artifact-sha256':sha('abc'), ...headers }) });

describe('artifact integrity', () => {
  it('binds inline and compact descriptors and refuses contradictory metadata', () => {
    const artifact={artifact_id:'frame',digest:sha('abc'),size_bytes:3};
    expect(resultArtifactMetadata({result_delivery:{artifacts:[artifact]}},'frame')).toEqual({status:'known',metadata:{sha256:sha('abc'),size_bytes:3}});
    expect(resultArtifactMetadata({result_delivery:{artifacts:[artifact]},policy_canary_result:{evidence:{...artifact,size_bytes:4}}},'frame')).toEqual({status:'invalid'});
    expect(resultArtifactMetadata({result_delivery:{artifacts:[{...artifact,digest:'invalid'}]}},'frame')).toEqual({status:'invalid'});
    expect(resultArtifactMetadata({result_delivery:{artifacts:[{...artifact,size_bytes:-1}]}},'frame')).toEqual({status:'invalid'});
    expect(resultArtifactMetadata({result_delivery:{artifacts:[{...artifact,sha256:sha('def')}]}},'frame')).toEqual({status:'invalid'});
    expect(resultArtifactMetadata({},'missing')).toEqual({status:'unlisted'});
  });
  it('checks whole-object metadata independently from body validation', () => {
    expect(artifactResponseIntegrity(response(),undefined,{sha256:sha('abc'),size_bytes:3})).toMatchObject({contentLength:3,payloadDigest:sha('abc'),mode:'sha256-on-completion'});
    expect(artifactResponseIntegrity(response(),undefined,{sha256:sha('def'),size_bytes:3})).toBeNull();
    expect(artifactResponseIntegrity(response(),undefined,{sha256:sha('abc'),size_bytes:4})).toBeNull();
    expect(artifactResponseIntegrity(response(200,{'content-encoding':'gzip'}),undefined)).toBeNull();
    expect(artifactResponseIntegrity(response(200,{'x-blueprint-artifact-sha256':''}),undefined)).toBeNull();
  });
  it.each(['bytes=2-1','bytes=0-1,4-5','items=0-1','bytes=-0','bytes=-','bytes=9007199254740992-'])('rejects unsafe or unsupported Range %s', range => {
    expect(parseResultArtifactRange(range)).toBe('invalid');
  });
  it('keeps partial range validation distinct from a full checksum', () => {
    const source=sha('abcdefghi');
    const partial=response(206,{'content-range':'bytes 3-5/9','x-blueprint-artifact-sha256':source});
    expect(artifactResponseIntegrity(partial,'bytes=3-5',{sha256:source,size_bytes:9})).toMatchObject({contentLength:3,payloadDigest:null,mode:'range-length-and-source-digest'});
    expect(artifactResponseIntegrity(partial,'bytes=2-4')).toBeNull();
    expect(artifactResponseIntegrity(partial,undefined)).toBeNull();
    const full=response(206,{'content-range':'bytes 0-2/3'});
    expect(artifactResponseIntegrity(full,'bytes=0-')).toMatchObject({payloadDigest:sha('abc')});
    expect(artifactResponseIntegrity(response(206,{'content-range':'bytes 6-8/9','x-blueprint-artifact-sha256':source}),'bytes=-3')).not.toBeNull();
  });
  it('releases the final byte only after both length and hash are verified', async () => {
    for (const digest of [sha('abc'),sha('xyz')]) {
      const verifier=new ResultArtifactIntegrityStream({contentLength:3,payloadDigest:digest});
      const chunks:Buffer[]=[];verifier.on('data',chunk=>chunks.push(chunk));
      const outcome=new Promise<string>(resolve=>{verifier.on('end',()=>resolve('complete'));verifier.on('error',()=>resolve('error'));});
      verifier.write(Buffer.from('a'));verifier.write(Buffer.from('bc'));
      expect(Buffer.concat(chunks).toString()).toBe('ab');
      verifier.end();
      expect(await outcome).toBe(digest===sha('abc')?'complete':'error');
      expect(Buffer.concat(chunks).toString()).toBe(digest===sha('abc')?'abc':'ab');
    }
  });
  it('refuses short and overlong bodies', async () => {
    for(const payload of ['ab','abcd']) {
      const verifier=new ResultArtifactIntegrityStream({contentLength:3,payloadDigest:sha('abc')});
      verifier.resume();const failed=new Promise(resolve=>verifier.once('error',resolve));verifier.end(Buffer.from(payload));
      expect(await failed).toBeInstanceOf(Error);
    }
  });
  it('verifies chunked full responses without inventing a Content-Length', async () => {
    const source={status:200,headers:new Headers({'x-blueprint-artifact-sha256':sha('abc')})};
    const integrity=artifactResponseIntegrity(source,undefined)!;
    expect(integrity).toMatchObject({contentLength:null,totalSize:null,payloadDigest:sha('abc')});
    const verifier=new ResultArtifactIntegrityStream(integrity);const chunks:Buffer[]=[];verifier.on('data',chunk=>chunks.push(chunk));
    const complete=new Promise<void>((resolve,reject)=>{verifier.on('end',resolve);verifier.on('error',reject);});
    verifier.write(Buffer.from('a'));verifier.end(Buffer.from('bc'));await complete;
    expect(Buffer.concat(chunks).toString()).toBe('abc');
  });

});
