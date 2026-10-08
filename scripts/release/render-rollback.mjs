import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const shaPattern = /^[a-f0-9]{40}$/;
const active = new Set(['created','build_in_progress','pre_deploy_in_progress','update_in_progress']);

export async function captureRollbackTarget(services, api, probe) {
  const records = await Promise.all(services.map(async service => {
    const entries = await api(service, 'deploys?limit=20');
    if (!Array.isArray(entries)) throw Error('deploy_inventory_invalid');
    const deploys = entries.map(entry => entry.deploy ?? entry);
    if (deploys.some(deploy => active.has(deploy.status))) throw Error('deployment_already_active');
    const live = deploys.find(deploy => deploy.status === 'live');
    if (!live || !/^dep-/.test(live.id) || !shaPattern.test(live.commit?.id ?? '')) throw Error('healthy_predecessor_missing');
    return {service,deployId:live.id,sha:live.commit.id};
  }));
  if (records.length !== 2 || records[0].sha !== records[1].sha) throw Error('predecessor_pair_diverged');
  await probe(records[0].sha);
  return {schema:'blueprint.release-rollback-target.v1',sha:records[0].sha,records,capturedAt:new Date().toISOString()};
}

export async function restorePreviousRelease(snapshot, services, api, probe, wait) {
  if (snapshot?.schema !== 'blueprint.release-rollback-target.v1' || !shaPattern.test(snapshot.sha ?? '') ||
      snapshot.records?.length !== 2 || snapshot.records.some((row, index) => row.service !== services[index] || row.sha !== snapshot.sha)) {
    throw Error('rollback_target_invalid');
  }
  // Standard exact-SHA deploy deliberately keeps CURRENT environment settings.
  // Render native rollback restores old env values, including retired controls.
  // Never retry an uncertain mutation. Independently attempt both pair members.
  const attempts = await Promise.allSettled(services.map(async service => {
    const started = Date.now();
    const response = await api(service, 'deploys', {commitId:snapshot.sha,clearCache:'do_not_clear'});
    let id = response?.id;
    if (!id) {
      const entries = await api(service,'deploys?limit=20');
      id = entries.map(entry => entry.deploy ?? entry).find(row =>
        row.commit?.id === snapshot.sha && active.has(row.status) && Date.parse(row.createdAt) >= started - 5000)?.id;
    }
    if (!/^dep-/.test(id ?? '')) throw Error('rollback_acceptance_unresolved');
    for (let attempt=0;attempt<80;attempt++) {
      const record = await api(service,`deploys/${id}`);
      if (record.status === 'live') {
        if (record.commit?.id !== snapshot.sha) throw Error('rollback_sha_mismatch');
        return {service,deployId:id,sha:snapshot.sha,status:'live'};
      }
      if (['build_failed','update_failed','canceled','deactivated'].includes(record.status)) throw Error('rollback_deploy_failed');
      await wait(15000);
    }
    throw Error('rollback_deploy_timeout');
  }));
  if (attempts.some(result => result.status === 'rejected')) throw Error('rollback_pair_unverified');
  await probe(snapshot.sha);
  return {schema:'blueprint.release-rollback-result.v1',sha:snapshot.sha,
    records:attempts.map(result => result.value),verifiedAt:new Date().toISOString()};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const services = [process.env.RENDER_SERVICE_ID,process.env.RENDER_WORKER_SERVICE_ID];
  if (services[0] !== 'srv-d4vnmk3e5dus73aiohk0' || services[1] !== 'srv-d9t8gg1t0dsc73am9q70') throw Error('release_service_binding_invalid');
  const key = process.env.RENDER_API_KEY;
  if (!key) throw Error('existing_render_key_missing');
  const file = process.env.ROLLBACK_TARGET_FILE;
  if (!file) throw Error('rollback_target_file_missing');
  const api = async (service,path,body) => {
    const response = await fetch(`https://api.render.com/v1/services/${service}/${path}`, {
      method:body ? 'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${key}`,Accept:'application/json',...(body ? {'Content-Type':'application/json'}:{})},
      ...(body ? {body:JSON.stringify(body)}:{}),
    });
    if (!response.ok) throw Error(`render_request_failed:${response.status}`);
    const text = await response.text();
    if (text.length > 1_000_000) throw Error('render_response_too_large');
    return text ? JSON.parse(text) : null;
  };
  const probe = async sha => {
    const base = 'https://tryblueprint.io';
    const responses = await Promise.all(['/version.json','/health','/health/ready'].map(path =>
      fetch(`${base}${path}`,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)})));
    if (responses.some(response => response.status !== 200)) throw Error('release_health_failed');
    if ((await responses[0].json()).git_sha !== sha) throw Error('release_live_sha_mismatch');
  };
  const start = Date.now();
  if (process.argv[2] === 'snapshot') {
    const snapshot = await captureRollbackTarget(services,api,probe);
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file,JSON.stringify(snapshot,null,2)+'\n',{mode:0o600,flag:'wx'});
    appendFileSync(process.env.GITHUB_OUTPUT,`previous_sha=${snapshot.sha}\n`);
  } else if (process.argv[2] === 'restore') {
    const snapshot = JSON.parse(readFileSync(file,'utf8'));
    const result = await restorePreviousRelease(snapshot,services,api,probe,ms=>new Promise(resolve=>setTimeout(resolve,ms)));
    writeFileSync(`${dirname(file)}/rollback-verification.json`,JSON.stringify({...result,elapsedMs:Date.now()-start},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({rollbackVerified:true,sha:result.sha,elapsedMs:Date.now()-start}));
  } else throw Error('usage: render-rollback.mjs snapshot|restore');
}
