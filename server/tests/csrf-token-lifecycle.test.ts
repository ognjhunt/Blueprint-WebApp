// @vitest-environment node
import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { csrfCookieHandler, csrfProtection } from '../middleware/csrf';
let server:Server;let url:string;let effects:number;
beforeEach(async()=>{
 effects=0;const app=express();app.get('/csrf',csrfCookieHandler);app.post('/effect',csrfProtection,(_req,res)=>{effects++;res.json({ok:true});});
 server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('fixture address');url=`http://127.0.0.1:${address.port}`;
});
afterEach(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('cross-tab CSRF lifecycle',()=>{
 it('does not invalidate the first tab when another tab reads a token',async()=>{
  const first=await fetch(`${url}/csrf`);const cookie=first.headers.get('set-cookie')!.split(';')[0];const token=(await first.json() as any).csrfToken;
  const second=await fetch(`${url}/csrf`,{headers:{cookie}});expect((await second.json() as any).csrfToken).toBe(token);
  const response=await fetch(`${url}/effect`,{method:'POST',headers:{cookie,'x-csrf-token':token}});expect(response.status).toBe(200);expect(effects).toBe(1);
 });
 it('still refuses missing/mismatched tokens and malformed cookie values before any action',async()=>{
  for(const headers of [{},{cookie:'csrf_token=one','x-csrf-token':'two'},{cookie:'csrf_token=%EA','x-csrf-token':'bad'}]) {
   expect((await fetch(`${url}/effect`,{method:'POST',headers})).status).toBe(403);
  }
  expect(effects).toBe(0);
 });
});
