import { expect, test } from "@playwright/test";
import { resultFixture, sha, videoBytes, videoDigest } from "./fixtures/policy-canary-result";
import { createHash } from "node:crypto";

test("policy canary result leads with a plain verdict and a scenario-by-scenario viewer", async ({ page }, testInfo) => {
  test.skip(
    process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1",
    "local fixture requires the dev-only operator QA identity",
  );
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).hostname !== "127.0.0.1") return route.fulfill({ status: 204, body: "" });
    return route.continue();
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "GET"
      && url.pathname === "/api/task-evaluation-results/result-ux-fixture"
    ) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resultFixture()) });
      return;
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/ticket")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture video unavailable" }) });
      return;
    }
    if (route.request().method() === "GET" && url.pathname === "/api/csrf") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "fixture" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/results/result-ux-fixture");
  await page.getByRole("button", { name: "Reject all" }).click().catch(() => undefined);
  await expect(page.getByRole("heading", { name: "π0.5 DROID succeeded more often." })).toBeVisible();
  await expect(page.getByText("On the 6 scenarios where both were scored, the gap is unlikely to be chance (sign test p ≈ 0.03).")).toBeVisible();
  await expect(page.getByText("π0.5 DROID: 4 of 10 episodes weren't scored — a camera or sensor problem.")).toBeVisible();
  await expect(page.getByText(/no winner is declared/)).toBeVisible();
  await expect(page.getByText("Scenario 1 of 10 · seed 900")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baseline anchor 1", level: 3 })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("policy-canary-result-simple.png"), fullPage: true });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Scenario 2 of 10 · seed 899")).toBeVisible();
  await page.getByRole("button", { name: "Held-out composition" }).click();
  await expect(page.getByRole("heading", { name: "Held-out composition", level: 3 })).toBeVisible();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Scenario 9 of 10 · seed 892")).toBeVisible();
  await page.getByRole("tab", { name: "Wrist" }).click();
  await expect(page.getByRole("tab", { name: "Wrist" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Load Wrist camera video for π0.5 DROID" }).click();
  await expect(page.getByRole("button", { name: "Retry Wrist camera video for π0.5 DROID" })).toBeVisible();
  await expect(page.getByText("Failed to authorize result artifact (503)")).toBeVisible();
  await expect(page.getByText("Run details and all files")).toBeVisible();
  await expect(page.getByText("Published artifact inventory")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("policy-canary-video-retry.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(consoleErrors.filter((message) => (
    !message.includes("WebSocket connection to 'ws://127.0.0.1")
    && !message.includes("Failed to load resource: the server responded with a status of 503")
  ))).toEqual([]);
});

test("mobile result retries unreadable media with a fresh ticket and reads a real Range response", async ({page},testInfo) => {
  test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== '1','local fixture identity required');
  const {readFile}=await import('node:fs/promises');
  const bytes=await readFile(new URL('./fixtures/result-audit-video.webm',import.meta.url));
  let tickets=0; const ranges:string[]=[];
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1') return route.abort();
    if(!url.pathname.startsWith('/api/')) return route.continue();
    if(url.pathname==='/api/task-evaluation-results/result-ux-fixture') return route.fulfill({json:resultFixture()});
    if(url.pathname==='/api/csrf') return route.fulfill({json:{csrfToken:'fixture'}});
    if(url.pathname.endsWith('/ticket')) return route.fulfill({status:201,json:{download_url:`/api/task-evaluation-result-downloads/result-ux-fixture/${url.pathname.split('/').at(-2)}?fixture=${++tickets}`}});
    if(url.pathname.startsWith('/api/task-evaluation-result-downloads/') && url.searchParams.get('fixture')==='1') return route.fulfill({status:404,json:{error:'expired fixture ticket'}});
    if(url.pathname.startsWith('/api/task-evaluation-result-downloads/')) {
      const range=route.request().headers().range || ''; ranges.push(range);
      const start=Number(range.match(/^bytes=(\d+)-/)?.[1] || 0);
      return route.fulfill({status:206,headers:{'content-type':'video/webm','accept-ranges':'bytes','content-range':`bytes ${start}-${bytes.length-1}/${bytes.length}`},body:bytes.subarray(start)});
    }
    return route.fulfill({json:{}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/results/result-ux-fixture');
  await page.getByRole('button',{name:'Reject all'}).click().catch(()=>undefined);
  await expect(page.getByRole('heading',{name:/succeeded more often/})).toBeVisible();
  await expect(page.getByText(/no winner is declared/)).toBeVisible();
  await expect(page.getByText(/one captured scene|trail for every episode/)).toHaveCount(0);
  await page.getByRole('button',{name:'Load External camera video for π0.5 DROID'}).click();
  await expect(page.getByText(/media could not be read or its access expired/)).toBeVisible();
  await page.getByRole('button',{name:'Retry External camera video for π0.5 DROID'}).click();
  const video=page.getByLabel('External camera evidence for π0.5 DROID');
  await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>element.readyState)).toBeGreaterThanOrEqual(2);
  expect(tickets).toBe(2); expect(ranges.some(range=>range.startsWith('bytes='))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({path:testInfo.outputPath('mobile-readable-media.png'),fullPage:true});
});

test("real progress page recovers a transient status failure and stops after terminal",async({page},testInfo)=>{
  test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== '1','local fixture identity required');
  let calls=0;
  const status=(terminal:boolean)=>({schema_version:'task_evaluation_policy_run_projection.v1',run_id:'local-poll-run',source_launch_id:'local-source',offering_digest:sha('a'),configuration_digest:sha('b'),state:terminal?'results_ready':'running',terminal,phase:terminal?'Sealed fixture result':'Running fixture episodes',progress:{completed_episodes:terminal?20:2,total_episodes:20},episode_counts:{learned_episode_count:20,control_episode_count:20,total_episode_count:40},result:terminal?{record_id:'result-ux-fixture',href:'/app/results/result-ux-fixture',api_href:'/api/task-evaluation-results/result-ux-fixture'}:null,result_summary:null,error:null,created_at_iso:'2026-09-07T12:00:00Z',updated_at_iso:terminal?'2026-09-07T12:02:00Z':'2026-09-07T12:01:00Z',proof_boundary:{simulation_is_physical_success:false,deployment_or_safety_approved:false,cross_team_leaderboard_authorized:false}});
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1') return route.abort();
    if(!url.pathname.startsWith('/api/')) return route.continue();
    if(url.pathname.endsWith('/local-poll-run/status')) {
      calls++;
      return calls===2?route.fulfill({status:503,json:{error:'fixture temporary failure'}}):route.fulfill({json:status(calls>=3)});
    }
    return route.fulfill({json:{}});
  });
  await page.clock.install();
  await page.goto('/app/evaluation-runs/local-poll-run');
  await expect(page.getByText('Running fixture episodes')).toBeVisible();
  await page.clock.fastForward(8000);
  await expect(page.getByText(/Displayed data may be stale/)).toBeVisible();
  await expect(page.getByText('Running fixture episodes')).toBeVisible();
  await page.clock.fastForward(8000);
  await expect(page.getByRole('link',{name:/View results/})).toBeVisible();
  await expect(page.getByText(/Displayed data may be stale/)).toHaveCount(0);
  await page.clock.fastForward(120000); expect(calls).toBe(3);
  await page.screenshot({path:testInfo.outputPath('polling-recovered.png'),fullPage:true});
});


test("full evidence inventory recovers after a failed read without claiming every frame is available", async ({ page }) => {
  test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== '1', 'local fixture identity required');
  const fixture: any = resultFixture();
  const extra = [1,2].map(index => ({artifact_id:`native-frame-${index}`,role:'native_frame',relative_path:`frame-${index}.png`,sha256:sha('a'),size_bytes:100,content_type:'image/png'}));
  const manifest = {schema_version:'task_evaluation_policy_canary_evidence_manifest.v1',run_id:fixture.publication.run_id,result_digest:sha('b'),artifacts:[...fixture.publication.result_delivery.artifacts,...extra]};
  const descriptor = fixture.publication.result_delivery.artifacts.find((artifact: any) => artifact.role==='evidence_manifest');
  // A manifest lists other artifacts, not itself; the published descriptor seals its bytes.
  manifest.artifacts = manifest.artifacts.filter((artifact: any) => artifact.artifact_id !== descriptor.artifact_id);
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  Object.assign(descriptor,{sha256:`sha256:${createHash('sha256').update(manifestBytes).digest('hex')}`,size_bytes:manifestBytes.length});
  fixture.publication.policy_canary_result.report = {result_digest:sha('b'),evidence_manifest:descriptor};
  fixture.publication.result_delivery.inline_compaction = {omitted_artifact_count:2,inline_artifact_count:4,source_artifact_count:6};
  let reads=0;
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1')return route.fulfill({status:204,body:''});
    if(!url.pathname.startsWith('/api/'))return route.continue();
    if(url.pathname==='/api/task-evaluation-results/result-ux-fixture')return route.fulfill({json:fixture});
    if(url.pathname==='/api/csrf')return route.fulfill({json:{csrfToken:'fixture'}});
    if(url.pathname.endsWith('/ticket'))return route.fulfill({status:201,json:{download_url:`/api/task-evaluation-result-downloads/result-ux-fixture/${url.pathname.split('/').at(-2)}?fixture=manifest`}});
    if(url.pathname.startsWith('/api/task-evaluation-result-downloads/')) {
      reads++;return reads===1?route.fulfill({status:503,json:{error:'fixture store unavailable'}}):route.fulfill({status:200,contentType:'application/json',body:manifestBytes});
    }
    return route.fulfill({json:{}});
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('/app/results/result-ux-fixture');
  await page.getByRole('button',{name:'Reject all'}).click().catch(()=>undefined);
  await page.getByText('Run details and all files',{exact:true}).click();
  await expect(page.getByText(/compact publication omits 2 additional descriptors/)).toBeVisible();
  await page.getByRole('button',{name:'Load full evidence manifest'}).click();
  await expect(page.getByText(/Inline descriptors remain available/)).toBeVisible();
  await page.getByRole('button',{name:'Retry full evidence manifest'}).click();
  await expect(page.getByText(/Full manifest bytes and run binding verified/)).toBeVisible();
  await expect(page.getByText(/Individual artifact availability is checked when requested/)).toBeVisible();
  expect(reads).toBe(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
});

test("an explicit email retry recovers a lost response using the same request without a duplicate send", async ({ page }, testInfo) => {
  test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== '1', 'local fixture identity required');
  const fixture: any = resultFixture();
  fixture.publication.policy_canary_result.projection_digest = sha('a');
  fixture.website_delivery = {status:'available',can_retry_email:true,retry_state:null,notification:{status:'failed',attempts:1,accepted_at_iso:null,delivered_at_iso:null,failure_reason:'fixture_delivery_failed'}};
  const retries: any[] = [];
  const sent = new Map<string, any>();
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.fulfill({status:204,body:''});
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/task-evaluation-results/result-ux-fixture') return route.fulfill({json:fixture});
    if (url.pathname === '/api/csrf') return route.fulfill({json:{csrfToken:'fixture'}});
    if (url.pathname.endsWith('/notification-retries')) {
      const body = route.request().postDataJSON(); retries.push(body);
      if (!sent.has(body.request_id)) sent.set(body.request_id,{record_id:'result-ux-fixture',request_id:body.request_id,run_result_digest:sha('a'),status:'accepted'});
      if (retries.length === 1) return route.abort('failed');
      fixture.website_delivery.notification.status = 'accepted';
      fixture.website_delivery.notification.attempts = 2;
      fixture.website_delivery.can_retry_email = false;
      return route.fulfill({json:sent.get(body.request_id)});
    }
    return route.fulfill({json:{}});
  });
  await page.goto('/app/results/result-ux-fixture');
  await page.getByRole('button',{name:'Reject all'}).click().catch(()=>undefined);
  await page.getByText('Run details and all files',{exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry result email'})).toBeVisible();
  expect(retries).toHaveLength(0);
  await page.getByRole('button',{name:'Retry result email'}).click();
  await expect(page.getByRole('button',{name:'Check email retry status'})).toBeVisible();
  await page.getByRole('button',{name:'Check email retry status'}).click();
  await expect(page.getByText(/Accepted by email transport; inbox delivery not confirmed/)).toBeVisible();
  expect(retries).toHaveLength(2);
  expect(retries[0].request_id).toBe(retries[1].request_id);
  expect(retries[0].authorize_email_retry).toBe(true);
  expect(sent.size).toBe(1);
  await page.screenshot({path:testInfo.outputPath('email-retry-recovered.png'),fullPage:true});
});

test("media authorization recovers once from a stale cross-tab CSRF token without bypassing access checks", async ({ page }) => {
  test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== '1', 'local fixture identity required');
  let csrfReads = 0; const tokens: string[] = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') return route.fulfill({status:204,body:''});
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/task-evaluation-results/result-ux-fixture') return route.fulfill({json:resultFixture()});
    if (url.pathname === '/api/csrf') return route.fulfill({json:{csrfToken:`fixture-${++csrfReads}`}});
    if (url.pathname.endsWith('/ticket')) {
      tokens.push(route.request().headers()['x-csrf-token']);
      if (tokens.length === 1) return route.fulfill({status:403,json:{error:'Invalid CSRF token'}});
      return route.fulfill({status:201,json:{download_url:`/api/task-evaluation-result-downloads/result-ux-fixture/${url.pathname.split('/').at(-2)}?fixture=csrf`}});
    }
    if (url.pathname.startsWith('/api/task-evaluation-result-downloads/')) return route.fulfill({status:200,contentType:'video/webm',body:videoBytes});
    return route.fulfill({json:{}});
  });
  await page.goto('/app/results/result-ux-fixture');
  await page.getByRole('button',{name:'Reject all'}).click().catch(()=>undefined);
  await page.getByRole('button',{name:'Load External camera video for π0.5 DROID'}).click();
  const video=page.getByLabel('External camera evidence for π0.5 DROID');
  await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>element.readyState)).toBeGreaterThanOrEqual(2);
  expect(csrfReads).toBe(2);expect(tokens).toEqual(['fixture-1','fixture-2']);
});
