import { expect, test } from "@playwright/test";

test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1", "Requires isolated fixture authentication");
for (const width of [390, 1440]) {
  test(`task details and fixed-price evaluation stay on one page at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const policies=[{id:"pi05_droid",artifact_digest:"pi"},{id:"groot_n17_droid",artifact_digest:"groot"}];
    let submissions=0;
    let receipt:Record<string,unknown>={id:`scene-${"a".repeat(64)}`,state:"forward_pending"};
    await page.clock.install();
    await page.route("**/api/**",async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==="/api/csrf") return route.fulfill({json:{csrfToken:"fixture"}});
      if(path.endsWith("/team-evaluation-context")) return route.fulfill({json:{
        sourceLaunchId:"source-one",sourceProfileDigest:"profile",sceneRevisionDigest:"revision",
        taskDetails:{title:"Move the blue container",description:"Pick up the container and place it on the target.",requirements:[{label:"Time limit",value:"30 seconds"},{label:"Destination",value:"Green target"}]},
        thumbnailUrl:"/api/task-thumbnail",dataSummary:{sceneVersion:"v1",sceneRevisionDigest:"revision",bundleSizeBytes:797095},
        checkout:{priceCents:2500,currency:"USD",developmentNoCharge:true,paymentsEnabled:false},
        configurations:[{id:"franka",label:"Franka configuration",binding_digest:"binding",policy_candidates:policies}],
        setups:[{id:"saved-one",name:"Franka",policyName:"GR00T",executionBindingId:"franka"}],
        providerTerms:{openai:{digest:"terms"},vast:{digest:"terms"}},testEnvironment:{label:"Development surface; room integration pending"},
      }});
      if(path==="/api/task-thumbnail") return route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#ecebe4"/><rect x="330" y="185" width="300" height="170" rx="12" fill="#397bcb"/></svg>'});
      if(path.startsWith("/api/task-evaluation-scene-intakes/")) return route.fulfill({json:receipt});
      if(path.endsWith("/team-evaluations")) {
        submissions++;
        expect(route.request().postDataJSON().execution.max_total_spend_usd).toBe(20);
        return route.fulfill({status:202,json:{id:`scene-${"a".repeat(64)}`,state:"forward_pending"}});
      }
      return route.fulfill({json:{}});
    });
    await page.goto("/app/packs/source-one/evaluate?select=team");
    await expect(page.getByRole("heading",{name:"Move the blue container"})).toBeVisible();
    await expect(page.getByRole("img",{name:"Task preview"})).toBeVisible();
    await expect(page.getByText("30 seconds")).toBeVisible();
    await page.getByText("Task data",{exact:true}).click();
    await expect(page.getByText(/Configured scene and task assets/)).toBeVisible();
    await page.getByLabel("Saved robot and policy").selectOption("saved-one");
    await expect(page.getByRole("spinbutton")).toHaveCount(0);
    await expect(page.getByText(/you won’t be charged/)).toBeVisible();
    await page.getByRole("checkbox").check();
    await expect(page.getByRole("button",{name:"Start evaluation · $25"})).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({animations:"disabled",path:`output/qa/result-consumer/task-evaluation-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:"Start evaluation · $25"}).click();
    await expect(page.getByRole("heading",{name:"Evaluation queued"})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Move the blue container"})).toBeVisible();
    await expect(page).toHaveURL(/packs\/source-one\/evaluate\?select=team&intake=scene-/);
    expect(submissions).toBe(1);
    for (const [state,pipelineStatus,title] of [
      ["forward_blocked",null,"Evaluation paused"],
      ["accepted","awaiting_execution","Preparing evaluation"],
      ["accepted","running","Evaluation running"],
      ["completed","completed","Evaluation complete"],
      ["expired","expired","Evaluation authorization expired"],
    ]) {
      receipt={...receipt,state,pipeline_status:pipelineStatus?{status:pipelineStatus}:null};
      await page.clock.fastForward(10000);
      await expect(page.getByRole("heading",{name:title!,exact:true})).toBeVisible();
      expect(submissions).toBe(1);
    }
    await page.reload();
    await expect(page.getByRole("heading",{name:"Evaluation authorization expired",exact:true})).toBeVisible();
    expect(submissions).toBe(1);
  });
}
