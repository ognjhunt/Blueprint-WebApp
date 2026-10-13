// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { dailyResearchDraftSelection, researchDraftDay } from "../agents/communications-daily-research-drafts";
import { admitPublishedResearch, admitPublishedHypothesis } from "../agents/communications-intake";

// Synthetic selection only; this cannot establish research/QA/contact eligibility.
const NOW=Date.parse("2026-10-13T00:30:00Z"),DAY="2026-10-12",SHA="a".repeat(64),SLICE="b".repeat(64),SITE="c".repeat(64);
function fixture() {
  const control:any={enabled:true,config:{enabled:true},workflow:{enabled:true},source_commit:"d".repeat(40),
    site_universe:{enabled:true,sha256:SHA,slice_size:5},outreach_ready:{enabled:true,current:{sha256:SHA,direction:{
      effective_from:"2026-10-12T12:00:00Z",expires_at:"2026-10-17T13:18:32Z",scope:{paths:["daily_qa"],max_rows_per_batch:5}}}}};
  const row:any={date:DAY,run_key:`blueprint-researcher:${DAY}`,state:"completed",packet_digest:SHA,raw_output_digest:SHA,
    qa:{state:"validated",artifact_digest:SHA},review:{accepted_keys:[],outreach_ready_keys:["selected","unrelated-agent-added"]},
    outreach_ready:{state:"enabled",direction_sha256:SHA},site_universe:{state:"attached",pin:{sha256:SHA},slice_sha256:SLICE,site_ids:[SITE]},
    packet:{site_universe:{state:"attached",slice_sha256:SLICE,export_sha256:SHA,link_issue_count:0,
      outcomes:[{site_id:SITE,candidate_key:"selected",outcome:"candidate"}]}}};
  return {control,snapshot:{schema_version:"blueprint.research-snapshot.v1",row}};
}
describe("native daily draft selection boundary",()=>{
  it("uses Chicago's actual day and selects only published candidates joined to the frozen batch",()=>{
    const f=fixture(),before=structuredClone(f);expect(researchDraftDay(NOW)).toBe(DAY);
    expect(dailyResearchDraftSelection(f.control,f.snapshot,NOW,DAY)).toMatchObject({date:DAY,candidateKeys:["selected"]});
    expect(f).toEqual(before);
  });
  it("keeps a late completed cycle selectable across midnight until the next native 07:00 trigger",()=>{
    expect(researchDraftDay(Date.parse("2026-10-13T05:01:00Z"))).toBe(DAY);
    expect(researchDraftDay(Date.parse("2026-10-13T11:59:00Z"))).toBe(DAY);
    expect(researchDraftDay(Date.parse("2026-10-13T12:00:00Z"))).toBe("2026-10-13");
    expect(researchDraftDay(Date.parse("2026-11-01T12:59:00Z"))).toBe("2026-10-31");
    expect(researchDraftDay(Date.parse("2026-11-01T13:00:00Z"))).toBe("2026-11-01");
  });
  const changes:[string,(f:ReturnType<typeof fixture>)=>void][]=[
    ["root hold",f=>f.control.enabled=false], ["config hold",f=>f.control.config.enabled=false],
    ["workflow off",f=>f.control.workflow.enabled=false], ["historical day",f=>f.snapshot.row.date="2026-10-11"],
    ["screen origin",f=>f.snapshot.row.run_key="blueprint-site-screen:other"], ["uncompleted row",f=>f.snapshot.row.state="collecting"],
    ["QA not validated",f=>f.snapshot.row.qa.state="pending"], ["direction expired",f=>f.control.outreach_ready.current.direction.expires_at=DAY+"T12:00:00Z"],
    ["changed direction",f=>f.snapshot.row.outreach_ready.direction_sha256=SLICE], ["wrong path",f=>f.control.outreach_ready.current.direction.scope.paths=["site_screen"]],
    ["broad batch",f=>f.control.site_universe.slice_size=20], ["changed export",f=>f.control.site_universe.sha256=SLICE],
    ["changed slice",f=>f.snapshot.row.packet.site_universe.slice_sha256=SHA], ["untrusted join",f=>f.snapshot.row.packet.site_universe.link_issue_count=1],
    ["foreign site",f=>f.snapshot.row.packet.site_universe.outcomes[0].site_id=SLICE], ["duplicate outcome",f=>f.snapshot.row.packet.site_universe.outcomes.push(f.snapshot.row.packet.site_universe.outcomes[0])],
    ["only unrelated candidates",f=>f.snapshot.row.review.outreach_ready_keys=["unrelated-agent-added"]],
  ];
  for(const [label,change]of changes)it(`refuses ${label} before selecting any job`,()=>{
    const f=fixture();change(f);expect(dailyResearchDraftSelection(f.control,f.snapshot,NOW,DAY)).toBeNull();
  });
  it("does not admit a native day preceding the actual prospective owner direction",()=>{
    const f=fixture();expect(dailyResearchDraftSelection(f.control,f.snapshot,NOW,"2026-10-13")).toBeNull();
  });
  for(const admit of [admitPublishedResearch,admitPublishedHypothesis])for(const wrong of ["date","key"])it(`${admit.name} rejects an unrelated ${wrong} before reads, claims or writes`,async()=>{
    const db={doc:vi.fn(()=>{throw Error("unexpected database access");}),runTransaction:vi.fn(()=>{throw Error("unexpected claim");})};
    const assertCurrent=vi.fn(async()=>undefined),deps:any={db,now:()=>NOW,dailySelection:{date:DAY,candidateKeys:["selected"],assertCurrent}};
    await expect(admit({row:{date:wrong==="date"?"2026-10-11":DAY}},wrong==="key"?"unrelated":"selected",deps)).rejects.toThrow("communications_daily_selection_changed");
    expect(db.doc).not.toHaveBeenCalled();expect(db.runTransaction).not.toHaveBeenCalled();expect(assertCurrent).not.toHaveBeenCalled();
  });
});
