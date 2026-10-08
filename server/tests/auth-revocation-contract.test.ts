// @vitest-environment node
/** Production SDK contract: emulator mode always checks revocation and can hide an omitted flag. */
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import express from 'express';
import {createServer,type Server} from 'node:http';
const sdk=vi.hoisted(()=>({verifyIdToken:vi.fn()}));
vi.mock('../../client/src/lib/firebaseAdmin',()=>({authAdmin:sdk}));
const {default:verifyFirebaseToken}=await import('../middleware/verifyFirebaseToken');
let server:Server,base:string;
beforeEach(async()=>{sdk.verifyIdToken.mockReset();vi.stubEnv("BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS","1");vi.stubEnv('BLUEPRINT_LOCAL_WEBAPP_ROUTE_PROOF_AUTH_TOKEN','');const app=express();app.get('/private',verifyFirebaseToken,(_req,res)=>res.json({protected:true}));server=createServer(app);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;});
afterEach(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));vi.unstubAllEnvs();});
describe('production revocation and account state checks',()=>{
 it.each(['auth/id-token-revoked','auth/user-disabled','auth/user-not-found'])('rejects otherwise valid credentials after %s',async code=>{
  sdk.verifyIdToken.mockImplementation(async(_token:string,checkRevoked?:boolean)=>{
   // This reproduces the documented production SDK branch, not its emulator override.
   if(checkRevoked)throw Object.assign(new Error('protected provider diagnostic'),{code});
   return {uid:'formerly-authorized-account'};
  });
  const response=await fetch(`${base}/private`,{headers:{Authorization:'Bearer old-valid-token'}});
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({error:'Invalid or expired token'});
 });
 it('keeps active credentials admitted and fails safely when account state is unavailable',async()=>{
  sdk.verifyIdToken.mockResolvedValueOnce({uid:'active-account'}).mockRejectedValueOnce(new Error('account lookup unavailable'));
  expect((await fetch(`${base}/private`,{headers:{Authorization:'Bearer active-token'}})).status).toBe(200);
  expect((await fetch(`${base}/private`,{headers:{Authorization:'Bearer active-token'}})).status).toBe(401);
 });
});

describe('public library credentials follow the same current-account policy',()=>{
 it.each(['auth/id-token-revoked','auth/user-disabled','auth/user-not-found'])('treats %s as anonymous rather than retaining staff library access',async code=>{
  const {libraryAccessForRequest}=await import('../utils/robotTeamLibraryAccess');
  sdk.verifyIdToken.mockImplementation(async(_token:string,checkRevoked?:boolean)=>{
   if(checkRevoked)throw Object.assign(new Error('protected provider diagnostic'),{code});
   return {uid:'formerly-authorized-staff',email:'synthetic@example.invalid',email_verified:true,admin:true};
  });
  const access=await libraryAccessForRequest({headers:{authorization:'Bearer old-staff-token'}} as any);
  expect(access.signedIn).toBe(false);
  expect(access.staff).toBe(false);
 });
});
