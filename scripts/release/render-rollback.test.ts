// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { captureRollbackTarget,restorePreviousRelease } from './render-rollback.mjs';
const sha='a'.repeat(40), services=['srv-web','srv-worker'];
const inventory=(service:string)=>[{deploy:{id:`dep-${service}`,status:'live',commit:{id:sha}}}];
describe('paired automatic rollback',()=>{
  it('reconciles delayed acceptance and already-live responses without repeating a mutation',async()=>{
    const snapshot=await captureRollbackTarget(services,async(service:string)=>inventory(service),async()=>{});
    const reads=new Map<string,number>();
    const api=vi.fn(async(service:string,path:string,body:any)=> {
      if(body) return null;
      if(path==='deploys?limit=20') {
        const count=(reads.get(service) ?? 0)+1; reads.set(service,count);
        return count<3 ? inventory(service) : [{deploy:{id:`dep-restored-${service}`,status:'live',commit:{id:sha},createdAt:new Date().toISOString()}}];
      }
      return {status:'live',commit:{id:sha}};
    });
    const receipts=vi.fn();
    const result=await restorePreviousRelease(snapshot,services,api,async()=>{},async()=>{},receipts);
    expect(result.records).toHaveLength(2);
    expect(api.mock.calls.filter(call=>call[2])).toHaveLength(2);
    expect([...reads.values()]).toEqual([3,3]);
    expect(receipts.mock.calls.filter(([row])=>row.status==='attempted')).toHaveLength(2);
  });
  it('captures a healthy same-SHA pair and restores both using current settings',async()=>{
    const probe=vi.fn(async()=>{});
    const snapshot=await captureRollbackTarget(services,async(service:string)=>inventory(service),probe);
    const api=vi.fn(async(service:string,path:string,body:any)=> {
      if(body) return {id:`dep-new-${service}`};
      return {status:'live',commit:{id:sha}};
    });
    const result=await restorePreviousRelease(snapshot,services,api,probe,async()=>{});
    expect(result.records).toHaveLength(2);
    expect(api.mock.calls.filter(call=>call[2])).toEqual(services.map(service=>[service,'deploys',{commitId:sha,clearCache:'do_not_clear'}]));
    expect(api.mock.calls.some(call=>call[1]==='rollback')).toBe(false);
    expect(probe).toHaveBeenCalledTimes(2);
  });
  it('rejects active deployments, divergent pairs and unhealthy predecessors before writing',async()=>{
    await expect(captureRollbackTarget(services,async()=>[{deploy:{status:'build_in_progress'}}],async()=>{})).rejects.toThrow('deployment_already_active');
    await expect(captureRollbackTarget(services,async(service:string)=>[{deploy:{id:'dep-ok',status:'live',commit:{id:service===services[0]?sha:'b'.repeat(40)}}}],async()=>{})).rejects.toThrow('predecessor_pair_diverged');
    await expect(captureRollbackTarget(services,async(service:string)=>inventory(service),async()=>{throw Error('unhealthy')})).rejects.toThrow('unhealthy');
  });
  it('still attempts the other service once after uncertain API failure and never calls rollback success',async()=>{
    const snapshot=await captureRollbackTarget(services,async(service:string)=>inventory(service),async()=>{});
    const api=vi.fn(async(service:string,path:string,body:any)=> {
      if(service===services[0]) throw Error('uncertain');
      return body?{id:'dep-second'}:{status:'live',commit:{id:sha}};
    });
    const probe=vi.fn(async()=>{});
    await expect(restorePreviousRelease(snapshot,services,api,probe,async()=>{})).rejects.toThrow('rollback_pair_unverified');
    expect(api.mock.calls.filter(call=>call[2])).toHaveLength(2);
    expect(probe).not.toHaveBeenCalled();
  });
  it('rejects a live record at the wrong SHA',async()=>{
    const snapshot=await captureRollbackTarget(services,async(service:string)=>inventory(service),async()=>{});
    await expect(restorePreviousRelease(snapshot,services,async(_s:string,_p:string,body:any)=>body?{id:'dep-new'}:{status:'live',commit:{id:'b'.repeat(40)}},async()=>{},async()=>{})).rejects.toThrow('rollback_pair_unverified');
  });
});
