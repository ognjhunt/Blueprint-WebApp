type WorkflowFocus = {
  key: string;
  label: string;
  whyNow: string;
  priority: "tier_1" | "tier_2" | "tier_3";
};

type TargetEntry = {
  rank: number;
  name: string;
  type: string;
  corridor: string;
  workflowFit: string;
  exactSiteValue: string;
  accessApproach: string;
  confidence: "high" | "medium";
  sourceNote: string;
};

type BucketEntry = {
  bucket: string;
  targetCount: number;
  rationale: string;
};

type SourceEntry = {
  label: string;
  url: string;
  note: string;
};

export type AustinCaptureTargetLedger = {
  city: "Austin, TX";
  generatedAt: string;
  workflows: WorkflowFocus[];
  immediateTop25: TargetEntry[];
  next100Buckets: BucketEntry[];
  longUniverseBuckets: BucketEntry[];
  sources: SourceEntry[];
};

function buildSources(): SourceEntry[] {
  return [
    {
      label: "Tesla Giga Texas",
      url: "https://www.tesla.com/giga-texas",
      note: "Official manufacturing hub in Austin with over 10 million square feet of factory floor.",
    },
    {
      label: "Opportunity Austin real estate overview",
      url: "https://opportunityaustin.com/economic-development/real-estate/",
      note: "Official regional development page naming Austin Hills Commerce Center and Crossroads Logistics Center.",
    },
    {
      label: "Opportunity Austin new and expanded companies",
      url: "https://opportunityaustin.com/wp-content/uploads/2025/03/NewAndExpanded.pdf",
      note: "Shows Tesla expansion in Kyle Logistics Park and current regional industrial growth.",
    },
    {
      label: "Samsung Austin + Taylor manufacturing footprint",
      url: "https://semiconductor.samsung.com/sas/company/taylor/",
      note: "Official Samsung Texas footprint including Austin expansion and Taylor advanced fabs.",
    },
    {
      label: "Samsung manufacturing sites",
      url: "https://semiconductor.samsung.com/foundry/manufacturing/manufacturing-sites/",
      note: "Official Austin and Taylor manufacturing site references.",
    },
    {
      label: "ANYbotics + Yokogawa inspection partnership",
      url: "https://www.anybotics.com/news/yokogawa-and-anybotics-to-integrate-oprex-robot-management-core-software-with-anymal-robotic-inspection-solutions/",
      note: "Supports industrial inspection as an active 2026 robot workflow priority.",
    },
    {
      label: "Agility commercial deployment with Toyota",
      url: "https://www.agilityrobotics.com/content/agility-robotics-announces-commercial-agreement-with-toyota-motor-manufacturing-canada",
      note: "Supports logistics, manufacturing, and supply-chain workflows as active humanoid deployment lanes.",
    },
    {
      label: "Path Robotics + HII shipbuilding physical AI",
      url: "https://www.path-robotics.com/news/hii-path-robotics-physical-ai-shipbuilding-mou",
      note: "Supports repetitive manufacturing and industrial automation workflows as current demand lanes.",
    },
    {
      label: "Austin Chamber major employers map",
      url: "https://cdn1.austinchamber.com/%20ed/files/MajorEmployersMapAustin.pdf?mtime=20230612145721",
      note: "Useful official map for Amazon, Arrive Logistics, and other regional logistics anchors.",
    },
    {
      label: "Opportunity Austin Taylor region",
      url: "https://opportunityaustin.com/about-austin/the-region/williamson-county/taylor/",
      note: "Official Taylor industrial parks and manufacturing density references.",
    },
    {
      label: "Acutronic regional manufacturing expansion",
      url: "https://opportunityaustin.com/acutronic-announces-major-expansion-new-investment-across-the-austin-texas-region/",
      note: "Supports Bastrop / advanced manufacturing as a secondary regional lane.",
    },
  ];
}

function buildWorkflowFocus(): WorkflowFocus[] {
  return [
    {
      key: "warehouse_fulfillment",
      label: "Warehouse / fulfillment / 3PL",
      whyNow: "Still the clearest real robot workflow lane for exact-site hosted review, brownfield automation, and case-handling proof.",
      priority: "tier_1",
    },
    {
      key: "advanced_manufacturing_intralogistics",
      label: "Advanced manufacturing / intralogistics",
      whyNow: "Austin has strong advanced manufacturing density, and 2026 robot demand remains grounded in repetitive movement, handling, and plant-floor workflows.",
      priority: "tier_1",
    },
    {
      key: "industrial_inspection",
      label: "Industrial inspection",
      whyNow: "Inspection robots remain active in industrial environments and can map cleanly to exact-site review and recency-sensitive site assets.",
      priority: "tier_2",
    },
    {
      key: "semiconductor_support",
      label: "Semiconductor and clean manufacturing support environments",
      whyNow: "Central Texas semiconductor growth creates high-value, constrained, site-specific environments, though access friction is higher.",
      priority: "tier_2",
    },
    {
      key: "cargo_logistics",
      label: "Cargo / airport-adjacent logistics",
      whyNow: "Important for warehouse and logistics buyers, but usually secondary to larger inland warehouse and manufacturing facilities.",
      priority: "tier_3",
    },
  ];
}

function buildImmediateTop25(): TargetEntry[] {
  return [
    {
      rank: 1,
      name: "Tesla Gigafactory Texas",
      type: "advanced manufacturing",
      corridor: "Del Valle / SH-130",
      workflowFit: "manufacturing intralogistics, mobile handling, material movement",
      exactSiteValue: "Very high. Strong exact-site proof value for manufacturing and supply-chain robotics buyers.",
      accessApproach: "operator-lane or founder/operator introduction; not open capture-first by default",
      confidence: "high",
      sourceNote: "Official Tesla Austin manufacturing footprint.",
    },
    {
      rank: 2,
      name: "Kyle 35 Logistics Park",
      type: "warehouse / logistics campus",
      corridor: "Kyle / I-35",
      workflowFit: "warehouse autonomy, handling, inventory movement, logistics support",
      exactSiteValue: "Very high. Directly tied to Tesla support logistics and warehouse-style workflows.",
      accessApproach: "operator-lane and logistics tenant mapping",
      confidence: "high",
      sourceNote: "Official regional development references show Tesla expansion in the park.",
    },
    {
      rank: 3,
      name: "Austin Hills Commerce Center",
      type: "industrial commerce center",
      corridor: "Northeast Austin / SH-130",
      workflowFit: "warehouse, manufacturing, distribution",
      exactSiteValue: "High. Good brownfield-style industrial proof environment.",
      accessApproach: "property / tenant identification, then targeted outreach",
      confidence: "high",
      sourceNote: "Opportunity Austin real-estate inventory.",
    },
    {
      rank: 4,
      name: "Crossroads Logistics Center",
      type: "distribution complex",
      corridor: "Northeast Austin / Parmer Lane",
      workflowFit: "warehouse, logistics, AMR proof",
      exactSiteValue: "High. Strong fit for exact-site warehouse review workflows.",
      accessApproach: "tenant identification and broker/property routing",
      confidence: "high",
      sourceNote: "Opportunity Austin real-estate inventory.",
    },
    {
      rank: 5,
      name: "Samsung Austin Semiconductor campus",
      type: "semiconductor manufacturing",
      corridor: "North Austin",
      workflowFit: "manufacturing support, inspection, internal logistics",
      exactSiteValue: "High but access-constrained. Valuable for premium proof if obtainable.",
      accessApproach: "operator-lane only",
      confidence: "high",
      sourceNote: "Official Samsung Texas manufacturing footprint.",
    },
    {
      rank: 6,
      name: "Samsung Taylor fab",
      type: "advanced semiconductor manufacturing",
      corridor: "Taylor",
      workflowFit: "manufacturing, facility logistics, inspection",
      exactSiteValue: "High but highly constrained. Better as a strategic operator-lane target than an early open capture target.",
      accessApproach: "operator-lane only",
      confidence: "high",
      sourceNote: "Official Samsung Taylor fab materials.",
    },
    {
      rank: 7,
      name: "Taylor Mustang Creek Industrial Park",
      type: "industrial park",
      corridor: "Taylor",
      workflowFit: "warehouse / manufacturing support environments",
      exactSiteValue: "Medium-high. Good cluster for adjacent exact-site manufacturing/logistics targets.",
      accessApproach: "cluster-first tenant mapping",
      confidence: "high",
      sourceNote: "Official Taylor economic development inventory.",
    },
    {
      rank: 8,
      name: "Taylor Walnut Creek Commercial Park",
      type: "industrial / commercial park",
      corridor: "Taylor",
      workflowFit: "light industrial and manufacturing-adjacent workflows",
      exactSiteValue: "Medium-high. Strong follow-on target around the Samsung orbit.",
      accessApproach: "cluster-first tenant mapping",
      confidence: "high",
      sourceNote: "Official Taylor economic development inventory.",
    },
    {
      rank: 9,
      name: "Georgetown Logistics Park",
      type: "warehouse logistics park",
      corridor: "Georgetown / SH-130",
      workflowFit: "warehouse automation, handling, distribution",
      exactSiteValue: "High. Strong warehouse target with regional manufacturing adjacency.",
      accessApproach: "tenant mapping and logistics outreach",
      confidence: "high",
      sourceNote: "Official and regional industrial development references.",
    },
    {
      rank: 10,
      name: "Austin-Bergstrom cargo and logistics zone",
      type: "cargo / logistics cluster",
      corridor: "ABIA / Southeast Austin",
      workflowFit: "logistics, cargo handling, warehouse adjacency",
      exactSiteValue: "Medium-high. Valuable for logistics buyers, though more fragmented.",
      accessApproach: "cluster-first operator and tenant mapping",
      confidence: "medium",
      sourceNote: "Regional logistics and airport adjacency thesis.",
    },
    {
      rank: 11,
      name: "Del Valle industrial belt near Tesla",
      type: "industrial cluster",
      corridor: "Del Valle / SH-130",
      workflowFit: "manufacturing support, warehouse logistics, inspection",
      exactSiteValue: "High. Strong buyer-relevant orbit around Tesla.",
      accessApproach: "cluster-first tenant mapping",
      confidence: "high",
      sourceNote: "Tesla orbit and Austin industrial growth references.",
    },
    {
      rank: 12,
      name: "Parmer Lane / TX-130 distribution buildings",
      type: "warehouse cluster",
      corridor: "Northeast Austin",
      workflowFit: "warehouse robotics, pallet movement, fulfillment",
      exactSiteValue: "High. Good early wedge for warehouse proof packs.",
      accessApproach: "tenant and broker identification",
      confidence: "high",
      sourceNote: "Crossroads and adjacent industrial inventory.",
    },
    {
      rank: 13,
      name: "Round Rock logistics and distribution corridor",
      type: "logistics cluster",
      corridor: "Round Rock",
      workflowFit: "warehouse, inventory movement, distribution",
      exactSiteValue: "Medium-high. Good next-wave warehouse density.",
      accessApproach: "cluster-first tenant mapping",
      confidence: "medium",
      sourceNote: "Regional employer and logistics density signals.",
    },
    {
      rank: 14,
      name: "Pflugerville industrial warehouse cluster",
      type: "light industrial / warehouse",
      corridor: "Pflugerville",
      workflowFit: "warehouse AMR, industrial inspection, material handling",
      exactSiteValue: "Medium-high. Useful for scaled warehouse capture coverage.",
      accessApproach: "tenant mapping",
      confidence: "medium",
      sourceNote: "Regional industrial footprint around Austin northeast corridors.",
    },
    {
      rank: 15,
      name: "Buda logistics sites",
      type: "warehouse / 3PL",
      corridor: "Buda / I-35",
      workflowFit: "warehouse, fulfillment, trucking support",
      exactSiteValue: "Medium-high. Strong adjacency to Kyle logistics and 3PL workflows.",
      accessApproach: "cluster-first outreach",
      confidence: "medium",
      sourceNote: "I-35 south logistics corridor thesis.",
    },
    {
      rank: 16,
      name: "Amazon regional delivery / fulfillment facilities in metro Austin",
      type: "delivery station / fulfillment",
      corridor: "Austin metro",
      workflowFit: "warehouse handling, delivery logistics, conveyor / storage review",
      exactSiteValue: "High if obtainable; good reference lane for fulfillment robotics buyers.",
      accessApproach: "operator-lane or adjacent-site comparison target",
      confidence: "medium",
      sourceNote: "Austin Chamber major employers map references Amazon delivery operations.",
    },
    {
      rank: 17,
      name: "Arrive Logistics operating facilities",
      type: "logistics operations",
      corridor: "Austin metro",
      workflowFit: "freight and logistics operations, warehouse-adjacent workflows",
      exactSiteValue: "Medium. More useful as a logistics demand cluster than a first proof asset.",
      accessApproach: "demand-led account mapping",
      confidence: "medium",
      sourceNote: "Austin Chamber major employers map.",
    },
    {
      rank: 18,
      name: "Foreign Trade Zone 183-adjacent facilities",
      type: "import / export logistics",
      corridor: "Austin region",
      workflowFit: "logistics, warehousing, customs-sensitive operations",
      exactSiteValue: "Medium-high. Good for logistics and inspection buyers.",
      accessApproach: "cluster-first site selection",
      confidence: "medium",
      sourceNote: "Opportunity Austin FTZ 183 information.",
    },
    {
      rank: 19,
      name: "Bastrop advanced manufacturing cluster",
      type: "advanced manufacturing",
      corridor: "Bastrop",
      workflowFit: "manufacturing, aerospace components, inspection",
      exactSiteValue: "Medium-high. Strong secondary manufacturing lane.",
      accessApproach: "operator-lane and cluster mapping",
      confidence: "medium",
      sourceNote: "Acutronic regional manufacturing expansion.",
    },
    {
      rank: 20,
      name: "Northeast Austin light-industrial infill warehouses",
      type: "light industrial",
      corridor: "Northeast Austin",
      workflowFit: "warehouse, inspection, mobile handling",
      exactSiteValue: "Medium. Useful for broad adjacent-site proof inventory.",
      accessApproach: "broader tenant discovery",
      confidence: "medium",
      sourceNote: "Opportunity Austin industrial inventory.",
    },
    {
      rank: 21,
      name: "South Austin / Kyle tenant warehouses supporting Tesla orbit",
      type: "support logistics",
      corridor: "Kyle / South Austin",
      workflowFit: "material movement, storage, fulfillment",
      exactSiteValue: "Medium-high. Strong next-wave supply-chain orbit.",
      accessApproach: "cluster-first tenant mapping",
      confidence: "medium",
      sourceNote: "Regional development and Tesla logistics expansion signals.",
    },
    {
      rank: 22,
      name: "Clean manufacturing support facilities around Samsung orbit",
      type: "manufacturing support",
      corridor: "North Austin / Taylor",
      workflowFit: "inspection, internal logistics, constrained facility support",
      exactSiteValue: "Medium-high. Good premium exact-site lane if access is possible.",
      accessApproach: "operator-lane",
      confidence: "medium",
      sourceNote: "Samsung Austin + Taylor ecosystem expansion.",
    },
    {
      rank: 23,
      name: "Austin Regional Manufacturing Association member facilities",
      type: "manufacturing cluster",
      corridor: "Austin metro",
      workflowFit: "manufacturing and industrial support",
      exactSiteValue: "Medium. Useful as a discovery pool for candidate exact-site targets.",
      accessApproach: "association-led demand and operator discovery",
      confidence: "medium",
      sourceNote: "Austin Chamber ARMA directory.",
    },
    {
      rank: 24,
      name: "Kuehne+Nagel Austin logistics operations",
      type: "logistics operator footprint",
      corridor: "Austin metro",
      workflowFit: "supply-chain and warehousing operations",
      exactSiteValue: "Medium. More valuable as a logistics demand cluster and site-discovery lead.",
      accessApproach: "operator and customer network mapping",
      confidence: "medium",
      sourceNote: "Austin Chamber Kuehne+Nagel Austin profile.",
    },
    {
      rank: 25,
      name: "Industrial distributor and field-service branches serving Austin manufacturing",
      type: "light industrial support",
      corridor: "Austin metro",
      workflowFit: "warehouse, inventory, service logistics",
      exactSiteValue: "Medium. Good fallback lane when high-security manufacturing access is slow.",
      accessApproach: "open-cluster discovery and referrals",
      confidence: "medium",
      sourceNote: "Austin Chamber industrial/logistics business profiles.",
    },
  ];
}

function buildNext100Buckets(): BucketEntry[] {
  return [
    {
      bucket: "Tesla / SH-130 manufacturing and logistics orbit",
      targetCount: 20,
      rationale: "Highest-value exact-site manufacturing and warehouse lane around Giga Texas and its support sites.",
    },
    {
      bucket: "Kyle / Buda / South I-35 logistics corridor",
      targetCount: 20,
      rationale: "Best warehouse and 3PL density immediately south of Austin.",
    },
    {
      bucket: "Northeast Austin / Parmer / TX-130 warehouses",
      targetCount: 20,
      rationale: "Strong warehouse AMR and fulfillment fit with lower access friction than flagship manufacturing sites.",
    },
    {
      bucket: "Taylor semiconductor and industrial ecosystem",
      targetCount: 15,
      rationale: "High-value manufacturing and inspection lane with Samsung-led gravity.",
    },
    {
      bucket: "Round Rock / Georgetown logistics and distribution",
      targetCount: 10,
      rationale: "Good next-wave warehouse coverage and manufacturing adjacency.",
    },
    {
      bucket: "Bastrop advanced manufacturing and aerospace support",
      targetCount: 10,
      rationale: "Secondary manufacturing lane with interesting inspection and constrained-site value.",
    },
    {
      bucket: "ABIA cargo, airport-adjacent logistics, and FTZ-linked facilities",
      targetCount: 5,
      rationale: "Selective logistics and inspection targets that can round out proof coverage.",
    },
  ];
}

function buildLongUniverseBuckets(): BucketEntry[] {
  return [
    {
      bucket: "Warehouse / fulfillment / 3PL sites across the Austin-Kyle-Buda-Georgetown arc",
      targetCount: 350,
      rationale: "Largest near-term robot-site opportunity set for exact-site hosted review.",
    },
    {
      bucket: "Advanced manufacturing and industrial intralogistics facilities",
      targetCount: 250,
      rationale: "High-value manufacturing environments around Tesla, Samsung, and related suppliers.",
    },
    {
      bucket: "Industrial inspection environments",
      targetCount: 150,
      rationale: "Inspection workflows remain active in 2026 and map well to site-specific proof packs.",
    },
    {
      bucket: "Semiconductor and clean-manufacturing support environments",
      targetCount: 100,
      rationale: "Smaller but strategically valuable exact-site lane with higher access friction.",
    },
    {
      bucket: "Cargo, import/export, and airport-adjacent logistics facilities",
      targetCount: 75,
      rationale: "Useful secondary logistics lane for broader warehouse and operations buyers.",
    },
    {
      bucket: "Aerospace, defense, and advanced components manufacturing",
      targetCount: 75,
      rationale: "Good secondary lane for manufacturing and inspection buyers in Central Texas.",
    },
  ];
}

export function buildAustinCaptureTargetLedger(): AustinCaptureTargetLedger {
  return {
    city: "Austin, TX",
    generatedAt: new Date().toISOString(),
    workflows: buildWorkflowFocus(),
    immediateTop25: buildImmediateTop25(),
    next100Buckets: buildNext100Buckets(),
    longUniverseBuckets: buildLongUniverseBuckets(),
    sources: buildSources(),
  };
}

export function renderAustinCaptureTargetLedgerMarkdown(
  ledger: AustinCaptureTargetLedger,
) {
  const immediateRows = ledger.immediateTop25.map((entry) =>
    `| ${entry.rank} | ${entry.name} | ${entry.type} | ${entry.corridor} | ${entry.workflowFit} | ${entry.confidence} | ${entry.accessApproach} |`,
  ).join("\n");

  const next100Rows = ledger.next100Buckets.map((entry) =>
    `| ${entry.bucket} | ${entry.targetCount} | ${entry.rationale} |`,
  ).join("\n");

  const longRows = ledger.longUniverseBuckets.map((entry) =>
    `| ${entry.bucket} | ${entry.targetCount} | ${entry.rationale} |`,
  ).join("\n");

  return [
    "# Austin Capture Target Ledger",
    "",
    `- city: ${ledger.city}`,
    `- generated_at: ${ledger.generatedAt}`,
    "- status: hypothesis-ranked targeting ledger, not a claim that every site is already accessible",
    "",
    "## Purpose",
    "",
    "Turn Austin buyer-workflow priors into a ranked capture target ledger so the org knows which sites and site clusters should be pursued first.",
    "",
    "This ledger is intentionally split into:",
    "- immediate top 25 targets for real execution now",
    "- next 100 target buckets for expansion after the first proof assets exist",
    "- a long 300-1000 site universe model so Austin expansion does not become random",
    "",
    "## Workflow Priorities",
    "",
    ...ledger.workflows.map((workflow) =>
      `- ${workflow.label} (${workflow.priority}): ${workflow.whyNow}`,
    ),
    "",
    "## Immediate Top 25",
    "",
    "| Rank | Target | Type | Corridor | Workflow fit | Confidence | Access approach |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    immediateRows,
    "",
    "## Next 100 Expansion Buckets",
    "",
    "| Bucket | Target count | Rationale |",
    "| --- | ---: | --- |",
    next100Rows,
    "",
    "## Long 300-1000 Universe Model",
    "",
    "| Universe bucket | Target count | Rationale |",
    "| --- | ---: | --- |",
    longRows,
    "",
    "## Operating Rules",
    "",
    "- The immediate top 25 should drive real Austin capture pursuit first.",
    "- The next 100 should stay as a queued expansion map until at least one Austin proof pack is clean and rights-cleared.",
    "- The long universe is a discovery frame, not a promise that Blueprint should touch every site soon.",
    "- High-security or rights-sensitive manufacturing sites should route through the operator lane, not generic capture outreach.",
    "- Warehouse and logistics density should be favored first because it matches the clearest 2026 robot-team workflow demand.",
    "",
    "## Sources",
    "",
    ...ledger.sources.map((source) =>
      `- [${source.label}](${source.url}) — ${source.note}`,
    ),
  ].join("\n");
}
