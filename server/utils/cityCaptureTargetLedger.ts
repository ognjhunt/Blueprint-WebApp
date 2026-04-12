import type { CityLaunchProfile, FocusCityKey } from "./cityLaunchProfiles";

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

export type CityCaptureTargetLedger = {
  city: string;
  citySlug: string;
  generatedAt: string;
  workflows: WorkflowFocus[];
  immediateTop25: TargetEntry[];
  next100Buckets: BucketEntry[];
  longUniverseBuckets: BucketEntry[];
  sources: SourceEntry[];
};

type TargetLedgerProfile = {
  workflows: WorkflowFocus[];
  immediateTop25: TargetEntry[];
  next100Buckets: BucketEntry[];
  longUniverseBuckets: BucketEntry[];
  sources: SourceEntry[];
};

function austinProfile(): TargetLedgerProfile {
  const workflows: WorkflowFocus[] = [
    {
      key: "warehouse_fulfillment",
      label: "Warehouse / fulfillment / 3PL",
      whyNow:
        "Still the clearest real robot workflow lane for exact-site hosted review, brownfield automation, and case-handling proof.",
      priority: "tier_1",
    },
    {
      key: "advanced_manufacturing_intralogistics",
      label: "Advanced manufacturing / intralogistics",
      whyNow:
        "Austin has strong advanced manufacturing density, and 2026 robot demand remains grounded in repetitive movement, handling, and plant-floor workflows.",
      priority: "tier_1",
    },
    {
      key: "industrial_inspection",
      label: "Industrial inspection",
      whyNow:
        "Inspection robots remain active in industrial environments and can map cleanly to exact-site review and recency-sensitive site assets.",
      priority: "tier_2",
    },
    {
      key: "semiconductor_support",
      label: "Semiconductor and clean manufacturing support environments",
      whyNow:
        "Central Texas semiconductor growth creates high-value, constrained, site-specific environments, though access friction is higher.",
      priority: "tier_2",
    },
    {
      key: "cargo_logistics",
      label: "Cargo / airport-adjacent logistics",
      whyNow:
        "Important for warehouse and logistics buyers, but usually secondary to larger inland warehouse and manufacturing facilities.",
      priority: "tier_3",
    },
  ];

  const immediateTop25: TargetEntry[] = [
    ["Tesla Gigafactory Texas","advanced manufacturing","Del Valle / SH-130","manufacturing intralogistics, mobile handling, material movement","Very high. Strong exact-site proof value for manufacturing and supply-chain robotics buyers.","operator-lane or founder/operator introduction; not open capture-first by default","high","Official Tesla Austin manufacturing footprint."],
    ["Kyle 35 Logistics Park","warehouse / logistics campus","Kyle / I-35","warehouse autonomy, handling, inventory movement, logistics support","Very high. Directly tied to Tesla support logistics and warehouse-style workflows.","operator-lane and logistics tenant mapping","high","Official regional development references show Tesla expansion in the park."],
    ["Austin Hills Commerce Center","industrial commerce center","Northeast Austin / SH-130","warehouse, manufacturing, distribution","High. Good brownfield-style industrial proof environment.","property / tenant identification, then targeted outreach","high","Opportunity Austin real-estate inventory."],
    ["Crossroads Logistics Center","distribution complex","Northeast Austin / Parmer Lane","warehouse, logistics, AMR proof","High. Strong fit for exact-site warehouse review workflows.","tenant identification and broker/property routing","high","Opportunity Austin real-estate inventory."],
    ["Samsung Austin Semiconductor campus","semiconductor manufacturing","North Austin","manufacturing support, inspection, internal logistics","High but access-constrained. Valuable for premium proof if obtainable.","operator-lane only","high","Official Samsung Texas manufacturing footprint."],
    ["Samsung Taylor fab","advanced semiconductor manufacturing","Taylor","manufacturing, facility logistics, inspection","High but highly constrained. Better as a strategic operator-lane target than an early open capture target.","operator-lane only","high","Official Samsung Taylor fab materials."],
    ["Taylor Mustang Creek Industrial Park","industrial park","Taylor","warehouse / manufacturing support environments","Medium-high. Good cluster for adjacent exact-site manufacturing/logistics targets.","cluster-first tenant mapping","high","Official Taylor economic development inventory."],
    ["Taylor Walnut Creek Commercial Park","industrial / commercial park","Taylor","light industrial and manufacturing-adjacent workflows","Medium-high. Strong follow-on target around the Samsung orbit.","cluster-first tenant mapping","high","Official Taylor economic development inventory."],
    ["Georgetown Logistics Park","warehouse logistics park","Georgetown / SH-130","warehouse automation, handling, distribution","High. Strong warehouse target with regional manufacturing adjacency.","tenant mapping and logistics outreach","high","Official and regional industrial development references."],
    ["Austin-Bergstrom cargo and logistics zone","cargo / logistics cluster","ABIA / Southeast Austin","logistics, cargo handling, warehouse adjacency","Medium-high. Valuable for logistics buyers, though more fragmented.","cluster-first operator and tenant mapping","medium","Regional logistics and airport adjacency thesis."],
    ["Del Valle industrial belt near Tesla","industrial cluster","Del Valle / SH-130","manufacturing support, warehouse logistics, inspection","High. Strong buyer-relevant orbit around Tesla.","cluster-first tenant mapping","high","Tesla orbit and Austin industrial growth references."],
    ["Parmer Lane / TX-130 distribution buildings","warehouse cluster","Northeast Austin","warehouse robotics, pallet movement, fulfillment","High. Good early wedge for warehouse proof packs.","tenant and broker identification","high","Crossroads and adjacent industrial inventory."],
    ["Round Rock logistics and distribution corridor","logistics cluster","Round Rock","warehouse, inventory movement, distribution","Medium-high. Good next-wave warehouse density.","cluster-first tenant mapping","medium","Regional employer and logistics density signals."],
    ["Pflugerville industrial warehouse cluster","light industrial / warehouse","Pflugerville","warehouse AMR, industrial inspection, material handling","Medium-high. Useful for scaled warehouse capture coverage.","tenant mapping","medium","Regional industrial footprint around Austin northeast corridors."],
    ["Buda logistics sites","warehouse / 3PL","Buda / I-35","warehouse, fulfillment, trucking support","Medium-high. Strong adjacency to Kyle logistics and 3PL workflows.","cluster-first outreach","medium","I-35 south logistics corridor thesis."],
    ["Amazon regional delivery / fulfillment facilities in metro Austin","delivery station / fulfillment","Austin metro","warehouse handling, delivery logistics, conveyor / storage review","High if obtainable; good reference lane for fulfillment robotics buyers.","operator-lane or adjacent-site comparison target","medium","Austin Chamber major employers map references Amazon delivery operations."],
    ["Arrive Logistics operating facilities","logistics operations","Austin metro","freight and logistics operations, warehouse-adjacent workflows","Medium. More useful as a logistics demand cluster than a first proof asset.","demand-led account mapping","medium","Austin Chamber major employers map."],
    ["Foreign Trade Zone 183-adjacent facilities","import / export logistics","Austin region","logistics, warehousing, customs-sensitive operations","Medium-high. Good for logistics and inspection buyers.","cluster-first site selection","medium","Opportunity Austin FTZ 183 information."],
    ["Bastrop advanced manufacturing cluster","advanced manufacturing","Bastrop","manufacturing, aerospace components, inspection","Medium-high. Strong secondary manufacturing lane.","operator-lane and cluster mapping","medium","Acutronic regional manufacturing expansion."],
    ["Northeast Austin light-industrial infill warehouses","light industrial","Northeast Austin","warehouse, inspection, mobile handling","Medium. Useful for broad adjacent-site proof inventory.","broader tenant discovery","medium","Opportunity Austin industrial inventory."],
    ["South Austin / Kyle tenant warehouses supporting Tesla orbit","support logistics","Kyle / South Austin","material movement, storage, fulfillment","Medium-high. Strong next-wave supply-chain orbit.","cluster-first tenant mapping","medium","Regional development and Tesla logistics expansion signals."],
    ["Clean manufacturing support facilities around Samsung orbit","manufacturing support","North Austin / Taylor","inspection, internal logistics, constrained facility support","Medium-high. Good premium exact-site lane if access is possible.","operator-lane","medium","Samsung Austin + Taylor ecosystem expansion."],
    ["Austin Regional Manufacturing Association member facilities","manufacturing cluster","Austin metro","manufacturing and industrial support","Medium. Useful as a discovery pool for candidate exact-site targets.","association-led demand and operator discovery","medium","Austin Chamber ARMA directory."],
    ["Kuehne+Nagel Austin logistics operations","logistics operator footprint","Austin metro","supply-chain and warehousing operations","Medium. More valuable as a logistics demand cluster and site-discovery lead.","operator and customer network mapping","medium","Austin Chamber Kuehne+Nagel Austin profile."],
    ["Industrial distributor and field-service branches serving Austin manufacturing","light industrial support","Austin metro","warehouse, inventory, service logistics","Medium. Good fallback lane when high-security manufacturing access is slow.","open-cluster discovery and referrals","medium","Austin Chamber industrial/logistics business profiles."],
  ].map((entry, index) => ({
    rank: index + 1,
    name: entry[0],
    type: entry[1],
    corridor: entry[2],
    workflowFit: entry[3],
    exactSiteValue: entry[4],
    accessApproach: entry[5],
    confidence: entry[6] as "high" | "medium",
    sourceNote: entry[7],
  }));

  const next100Buckets: BucketEntry[] = [
    { bucket: "Tesla / SH-130 manufacturing and logistics orbit", targetCount: 20, rationale: "Highest-value exact-site manufacturing and warehouse lane around Giga Texas and its support sites." },
    { bucket: "Kyle / Buda / South I-35 logistics corridor", targetCount: 20, rationale: "Best warehouse and 3PL density immediately south of Austin." },
    { bucket: "Northeast Austin / Parmer / TX-130 warehouses", targetCount: 20, rationale: "Strong warehouse AMR and fulfillment fit with lower access friction than flagship manufacturing sites." },
    { bucket: "Taylor semiconductor and industrial ecosystem", targetCount: 15, rationale: "High-value manufacturing and inspection lane with Samsung-led gravity." },
    { bucket: "Round Rock / Georgetown logistics and distribution", targetCount: 10, rationale: "Good next-wave warehouse coverage and manufacturing adjacency." },
    { bucket: "Bastrop advanced manufacturing and aerospace support", targetCount: 10, rationale: "Secondary manufacturing lane with interesting inspection and constrained-site value." },
    { bucket: "ABIA cargo, airport-adjacent logistics, and FTZ-linked facilities", targetCount: 5, rationale: "Selective logistics and inspection targets that can round out proof coverage." },
  ];

  const longUniverseBuckets: BucketEntry[] = [
    { bucket: "Warehouse / fulfillment / 3PL sites across the Austin-Kyle-Buda-Georgetown arc", targetCount: 350, rationale: "Largest near-term robot-site opportunity set for exact-site hosted review." },
    { bucket: "Advanced manufacturing and industrial intralogistics facilities", targetCount: 250, rationale: "High-value manufacturing environments around Tesla, Samsung, and related suppliers." },
    { bucket: "Industrial inspection environments", targetCount: 150, rationale: "Inspection workflows remain active in 2026 and map well to site-specific proof packs." },
    { bucket: "Semiconductor and clean-manufacturing support environments", targetCount: 100, rationale: "Smaller but strategically valuable exact-site lane with higher access friction." },
    { bucket: "Cargo, import/export, and airport-adjacent logistics facilities", targetCount: 75, rationale: "Useful secondary logistics lane for broader warehouse and operations buyers." },
    { bucket: "Aerospace, defense, and advanced components manufacturing", targetCount: 75, rationale: "Good secondary lane for manufacturing and inspection buyers in Central Texas." },
  ];

  const sources: SourceEntry[] = [
    { label: "Tesla Giga Texas", url: "https://www.tesla.com/giga-texas", note: "Official manufacturing hub in Austin with over 10 million square feet of factory floor." },
    { label: "Opportunity Austin real estate overview", url: "https://opportunityaustin.com/economic-development/real-estate/", note: "Official regional development page naming Austin Hills Commerce Center and Crossroads Logistics Center." },
    { label: "Opportunity Austin new and expanded companies", url: "https://opportunityaustin.com/wp-content/uploads/2025/03/NewAndExpanded.pdf", note: "Shows Tesla expansion in Kyle Logistics Park and current regional industrial growth." },
    { label: "Samsung Austin + Taylor manufacturing footprint", url: "https://semiconductor.samsung.com/sas/company/taylor/", note: "Official Samsung Texas footprint including Austin expansion and Taylor advanced fabs." },
    { label: "Samsung manufacturing sites", url: "https://semiconductor.samsung.com/foundry/manufacturing/manufacturing-sites/", note: "Official Austin and Taylor manufacturing site references." },
    { label: "ANYbotics + Yokogawa inspection partnership", url: "https://www.anybotics.com/news/yokogawa-and-anybotics-to-integrate-oprex-robot-management-core-software-with-anymal-robotic-inspection-solutions/", note: "Supports industrial inspection as an active 2026 robot workflow priority." },
    { label: "Agility commercial deployment with Toyota", url: "https://www.agilityrobotics.com/content/agility-robotics-announces-commercial-agreement-with-toyota-motor-manufacturing-canada", note: "Supports logistics, manufacturing, and supply-chain workflows as active humanoid deployment lanes." },
    { label: "Path Robotics + HII shipbuilding physical AI", url: "https://www.path-robotics.com/news/hii-path-robotics-physical-ai-shipbuilding-mou", note: "Supports repetitive manufacturing and industrial automation workflows as current demand lanes." },
  ];

  return { workflows, immediateTop25, next100Buckets, longUniverseBuckets, sources };
}

function sanFranciscoProfile(): TargetLedgerProfile {
  const workflows: WorkflowFocus[] = [
    {
      key: "warehouse_fulfillment",
      label: "Warehouse / fulfillment / parcel / 3PL",
      whyNow: "Bay Area robot teams still care about brownfield warehouse and parcel environments, especially when proof needs to be technically inspectable fast.",
      priority: "tier_1",
    },
    {
      key: "advanced_manufacturing",
      label: "Advanced manufacturing / electronics / robotics production",
      whyNow: "The Bay Area keeps a denser robotics and advanced manufacturing ecosystem than Austin, which makes manufacturing-adjacent exact-site proof strategically important.",
      priority: "tier_1",
    },
    {
      key: "industrial_inspection",
      label: "Industrial inspection and utility environments",
      whyNow: "Inspection remains a live workflow category for technical robot teams and gives strong exact-site review value.",
      priority: "tier_2",
    },
    {
      key: "port_cargo_logistics",
      label: "Port, cargo, and airport logistics",
      whyNow: "Oakland and SFO-adjacent logistics environments are strong exact-site and adjacent-site proof lanes for logistics robotics buyers.",
      priority: "tier_2",
    },
    {
      key: "lab_and_demo_facilities",
      label: "Labs, demo facilities, and technical pilot environments",
      whyNow: "Useful for high-trust buyer discovery, but lower priority than commercially real logistics and manufacturing sites.",
      priority: "tier_3",
    },
  ];

  const baseTargets = [
    ["Oakland airport logistics corridor","cargo / logistics cluster","Oakland","parcel, cargo, warehouse, handling","Very high. Strong Bay Area logistics proof lane.","operator and tenant mapping","high","Bay Area cargo and warehouse corridor with strong workflow relevance."],
    ["Port of Oakland support logistics facilities","port / logistics","Oakland","yard logistics, cargo handling, warehouse adjacency","High. Valuable for logistics and inspection buyers.","operator-lane and adjacent-site packaging","high","Strong logistics workflow density."],
    ["Fremont manufacturing and supplier corridor","advanced manufacturing","Fremont","manufacturing, internal logistics, mobile handling","High. Strong exact-site manufacturing value.","tenant and supplier mapping","high","Bay Area manufacturing density with high robotics relevance."],
    ["Milpitas electronics and robotics industrial belt","advanced manufacturing","Milpitas","electronics, components, warehouse support","High. Strong buyer relevance for robotics and manufacturing teams.","tenant mapping","high","Dense industrial and robotics-adjacent corridor."],
    ["South San Francisco industrial and warehouse corridor","warehouse / light industrial","South San Francisco","warehouse, biotech support logistics, inspection","High. Good exact-site and adjacent-site proof coverage.","tenant mapping","high","Dense industrial belt with lower friction than premium flagship sites."],
    ["San Leandro distribution and light manufacturing belt","warehouse / manufacturing","San Leandro","warehouse automation, material handling, inspection","High. Good brownfield operations lane.","tenant mapping","high","East Bay industrial density."],
    ["Hayward industrial parks","warehouse / industrial","Hayward","warehouse, pallet handling, mobile robotics","High. Strong operations and logistics lane.","tenant mapping","high","East Bay warehouse density."],
    ["Livermore / Tri-Valley warehouse cluster","warehouse / logistics","Livermore","warehouse, 3PL, parcel, storage","Medium-high. Strong scalable warehouse coverage.","tenant mapping","medium","Good next-wave warehouse bucket."],
    ["Union City warehouse belt","warehouse / logistics","Union City","warehouse, material movement, fulfillment","Medium-high. Good fulfillment lane.","tenant mapping","medium","East Bay logistics density."],
    ["Santa Clara / San Jose advanced manufacturing sites","advanced manufacturing","South Bay","electronics, robotics production, internal logistics","Medium-high. Strong strategic value with higher access work.","operator-lane and tenant mapping","medium","Dense technical manufacturing ecosystem."],
    ["Mountain View / Palo Alto robotics demo and lab environments","lab / pilot environment","Peninsula","robot testing, demos, buyer discovery","Medium. Better for demand discovery than first proof assets.","founder and partner introductions","medium","High-density robot buyer ecosystem."],
    ["Redwood City industrial and port-adjacent sites","industrial / logistics","Peninsula","warehouse, handling, maritime adjacency","Medium-high. Good mixed logistics and industrial lane.","tenant mapping","medium","Useful for Bay logistics proof diversity."],
    ["Richmond industrial shoreline facilities","industrial / inspection","Richmond","inspection, industrial mobility, logistics","Medium-high. Good inspection and industrial lane.","operator-lane and site mapping","medium","Strong inspection-style environments."],
    ["Concord / Martinez industrial corridor","industrial / logistics","East Bay","warehouse, yard, inspection, plant support","Medium-high. Useful secondary industrial lane.","cluster mapping","medium","Broader industrial Bay Area coverage."],
    ["Vacaville / Fairfield logistics corridor","warehouse / logistics","North Bay / I-80","warehouse, parcel, storage","Medium-high. Good scaled warehouse lane.","tenant mapping","medium","Good next 100 bucket."],
    ["San Jose airport-adjacent cargo and logistics sites","cargo / logistics","San Jose","cargo, parcel, warehouse, support logistics","Medium-high. Good airport logistics lane.","cluster mapping","medium","Airport-adjacent workflow value."],
    ["SFO cargo and support facilities","cargo / logistics","SFO / Peninsula","cargo, material handling, constrained operations","Medium-high. Useful premium logistics lane.","operator-lane and adjacent-site packaging","medium","Strong workflow relevance but higher access complexity."],
    ["Alameda naval / industrial reuse sites","industrial / inspection","Alameda","inspection, field robotics, constrained sites","Medium. Good secondary inspection lane.","operator-lane and partner discovery","medium","Interesting exact-site environments."],
    ["Berkeley / Emeryville light industrial labs and pilot sites","lab / pilot","East Bay","robotics pilot work, technical reviews","Medium. Good buyer-discovery support lane.","founder and partner introductions","medium","Dense technical audience but less commercial site realism."],
    ["Sunnyvale warehouse and industrial infill","warehouse / industrial","Sunnyvale","warehouse, electronics support logistics","Medium. Good adjacent-site proof lane.","tenant mapping","medium","South Bay operations density."],
    ["Pleasanton / Dublin logistics sites","warehouse / logistics","Tri-Valley","warehouse, parcel, storage, 3PL","Medium. Good next-wave logistics coverage.","tenant mapping","medium","Scalable warehouse lane."],
    ["Santa Rosa industrial and warehouse belt","warehouse / industrial","North Bay","warehouse, field service, inspection","Medium. Secondary Bay coverage lane.","cluster mapping","medium","Useful later expansion."],
    ["Napa / Solano industrial support sites","industrial support","North Bay","light industrial, inspection, warehouse support","Medium. Secondary industrial lane.","cluster mapping","medium","Good adjacent-site fallback."],
    ["Robotics integrator customer sites reached through BARA-style networks","distributed customer sites","Bay Area","real deployments across manufacturing and logistics","High if surfaced. Better as named account-linked sites than blind city sweep.","demand-led account mapping","medium","Directly ties the capture ledger to active buyer threads."],
    ["Partner-introduced exact-site facilities from Bay Area deployment teams","distributed exact sites","Bay Area","site-specific proof work for active buyers","Very high when present. These should jump the queue.","buyer-thread-led routing","medium","Should outrank broad prospecting whenever a real buyer thread exists."],
  ];

  const immediateTop25: TargetEntry[] = baseTargets.map((entry, index) => ({
    rank: index + 1,
    name: entry[0],
    type: entry[1],
    corridor: entry[2],
    workflowFit: entry[3],
    exactSiteValue: entry[4],
    accessApproach: entry[5],
    confidence: entry[6] as "high" | "medium",
    sourceNote: entry[7],
  }));

  const next100Buckets: BucketEntry[] = [
    { bucket: "East Bay warehouse and industrial belt", targetCount: 30, rationale: "Best scalable logistics and brownfield industrial lane." },
    { bucket: "South Bay advanced manufacturing and supplier corridors", targetCount: 20, rationale: "Highest strategic manufacturing value for robot teams." },
    { bucket: "Oakland / port / airport-adjacent logistics", targetCount: 15, rationale: "Strong logistics and cargo workflows with clear buyer relevance." },
    { bucket: "Peninsula industrial and support logistics sites", targetCount: 15, rationale: "Good exact-site and adjacent-site proof diversity." },
    { bucket: "Tri-Valley warehouse / 3PL / parcel sites", targetCount: 10, rationale: "Good next-wave warehouse coverage." },
    { bucket: "North Bay industrial and field-service sites", targetCount: 10, rationale: "Secondary coverage for inspection and warehouse workflows." },
  ];

  const longUniverseBuckets: BucketEntry[] = [
    { bucket: "Bay Area warehouse / parcel / 3PL facilities", targetCount: 400, rationale: "Largest near-term robot-site universe in the region." },
    { bucket: "Advanced manufacturing / electronics / robotics production", targetCount: 250, rationale: "Strategically valuable exact-site manufacturing environments." },
    { bucket: "Industrial inspection and utility-adjacent environments", targetCount: 150, rationale: "Strong inspection workflow category for exact-site review." },
    { bucket: "Port, cargo, and airport logistics environments", targetCount: 100, rationale: "High-value logistics and constrained operations lane." },
    { bucket: "Labs, pilot sites, and demo environments", targetCount: 75, rationale: "Useful for buyer discovery but secondary to commercially real operations sites." },
  ];

  const sources: SourceEntry[] = [
    { label: "San Francisco Chamber local economy overview", url: "https://sfchamber.com/resource/san-francisco-by-the-numbers/", note: "Supports local economy framing and dense business environment." },
    { label: "Port of Oakland", url: "https://www.portofoakland.com/", note: "Official port and logistics system surface." },
    { label: "SFO cargo", url: "https://www.flysfo.com/business-at-sfo/cargo", note: "Official SFO cargo and logistics surface." },
    { label: "BARA", url: "https://barobotics.org/", note: "Bay Area Robotics Alliance ecosystem signal for buyer and partner density." },
    { label: "ANYbotics + Yokogawa inspection partnership", url: "https://www.anybotics.com/news/yokogawa-and-anybotics-to-integrate-oprex-robot-management-core-software-with-anymal-robotic-inspection-solutions/", note: "Supports industrial inspection as an active 2026 robot workflow priority." },
    { label: "Agility commercial deployment with Toyota", url: "https://www.agilityrobotics.com/content/agility-robotics-announces-commercial-agreement-with-toyota-motor-manufacturing-canada", note: "Supports manufacturing and logistics as active humanoid deployment lanes." },
  ];

  return { workflows, immediateTop25, next100Buckets, longUniverseBuckets, sources };
}

const TARGET_LEDGER_PROFILES: Record<FocusCityKey, () => TargetLedgerProfile> = {
  "austin-tx": austinProfile,
  "san-francisco-ca": sanFranciscoProfile,
};

function genericCityProfile(profile: CityLaunchProfile): TargetLedgerProfile {
  const cityLabel = profile.shortLabel;
  const workflows: WorkflowFocus[] = [
    {
      key: "warehouse_fulfillment",
      label: "Warehouse / fulfillment / 3PL",
      whyNow: `${cityLabel} should start from commercially real logistics and warehouse workflows before widening into lower-signal site types.`,
      priority: "tier_1",
    },
    {
      key: "advanced_manufacturing",
      label: "Advanced manufacturing / intralogistics",
      whyNow: `${cityLabel} should prioritize repeatable manufacturing and material-movement workflows that benefit from exact-site hosted review.`,
      priority: "tier_1",
    },
    {
      key: "industrial_inspection",
      label: "Industrial inspection",
      whyNow: "Inspection remains a live 2026 robotics workflow and produces strong site-specific proof value.",
      priority: "tier_2",
    },
  ];

  const immediateTop25: TargetEntry[] = [
    [`${cityLabel} airport and cargo corridor`, "cargo / logistics cluster", `${cityLabel} airport district`, "cargo handling, parcel flow, warehouse adjacency", "High-value logistics proof lane", "operator and tenant mapping", "medium", "Generic launch template target"],
    [`${cityLabel} primary warehouse belt`, "warehouse / logistics", `${cityLabel} industrial belt`, "warehouse AMR, fulfillment, material handling", "Direct fit for exact-site hosted review", "tenant mapping and source policy routing", "medium", "Generic launch template target"],
    [`${cityLabel} advanced manufacturing corridor`, "advanced manufacturing", `${cityLabel} manufacturing zone`, "manufacturing intralogistics, mobile handling", "High-value manufacturing proof lane", "operator-lane introductions and tenant mapping", "medium", "Generic launch template target"],
    [`${cityLabel} light-industrial infill sites`, "light industrial", `${cityLabel} secondary industrial corridors`, "inspection, warehouse support, field robotics", "Useful adjacent-site proof inventory", "cluster-first prospecting", "medium", "Generic launch template target"],
    [`${cityLabel} regional logistics expansion nodes`, "warehouse / 3PL", `${cityLabel} regional logistics ring`, "storage, parcel, distribution", "Strong next-wave warehouse lane", "cluster-first outreach", "medium", "Generic launch template target"],
  ].flatMap((seed, index) =>
    Array.from({ length: 5 }, (_, offset) => ({
      rank: index * 5 + offset + 1,
      name: offset === 0 ? seed[0] : `${seed[0]} cluster ${offset + 1}`,
      type: seed[1],
      corridor: seed[2],
      workflowFit: seed[3],
      exactSiteValue: seed[4],
      accessApproach: seed[5],
      confidence: seed[6] as "high" | "medium",
      sourceNote: seed[7],
    })),
  );

  const next100Buckets: BucketEntry[] = [
    {
      bucket: `${cityLabel} warehouse and fulfillment corridors`,
      targetCount: 40,
      rationale: "Primary exact-site launch wedge for commercially real robotics workflows.",
    },
    {
      bucket: `${cityLabel} advanced manufacturing and supplier sites`,
      targetCount: 25,
      rationale: "High-value manufacturing lane once the first logistics proof assets exist.",
    },
    {
      bucket: `${cityLabel} airport, port, and cargo-adjacent facilities`,
      targetCount: 20,
      rationale: "Good constrained-operations lane for logistics and inspection buyers.",
    },
    {
      bucket: `${cityLabel} light industrial and field-service environments`,
      targetCount: 15,
      rationale: "Secondary adjacent-site lane for broader coverage after the first proof packs are live.",
    },
  ];

  const longUniverseBuckets: BucketEntry[] = [
    {
      bucket: `${cityLabel} warehouse, fulfillment, and 3PL sites`,
      targetCount: 400,
      rationale: "Largest near-term exact-site demand lane for technical robotics buyers.",
    },
    {
      bucket: `${cityLabel} advanced manufacturing and intralogistics sites`,
      targetCount: 250,
      rationale: "High-value manufacturing environments that benefit from strong provenance and hosted review.",
    },
    {
      bucket: `${cityLabel} industrial inspection and constrained operations sites`,
      targetCount: 150,
      rationale: "Inspection and constrained-site environments produce differentiated proof assets.",
    },
  ];

  const sources: SourceEntry[] = [
    {
      label: `${cityLabel} launch system`,
      url: profile.systemDocPath,
      note: "Canonical city launch system document generated by the generic launcher.",
    },
    {
      label: `${cityLabel} launch playbook`,
      url: profile.launchPlaybookPath,
      note: "City-specific playbook path reserved by the generic launcher.",
    },
  ];

  return { workflows, immediateTop25, next100Buckets, longUniverseBuckets, sources };
}

export function buildCityCaptureTargetLedger(profile: CityLaunchProfile): CityCaptureTargetLedger {
  const profileBuilder = TARGET_LEDGER_PROFILES[profile.key as FocusCityKey];
  const built = profileBuilder ? profileBuilder() : genericCityProfile(profile);
  return {
    city: profile.city,
    citySlug: profile.key,
    generatedAt: new Date().toISOString(),
    ...built,
  };
}

export function renderCityCaptureTargetLedgerMarkdown(
  ledger: CityCaptureTargetLedger,
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
    `# ${ledger.city} Capture Target Ledger`,
    "",
    `- city: ${ledger.city}`,
    `- city_slug: ${ledger.citySlug}`,
    `- generated_at: ${ledger.generatedAt}`,
    "- status: hypothesis-ranked targeting ledger, not a claim that every site is already accessible",
    "",
    "## Purpose",
    "",
    "Turn current robot workflow and buyer-demand priors into a ranked capture target ledger so the org knows which sites and site clusters should be pursued first.",
    "",
    "This ledger is intentionally split into:",
    "- immediate top 25 targets for real execution now",
    "- next 100 target buckets for expansion after the first proof assets exist",
    "- a long 300-1000 site universe model so city expansion does not become random",
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
    "- The immediate top 25 should drive real capture pursuit first.",
    "- The next 100 should stay as a queued expansion map until at least one clean proof pack is rights-cleared.",
    "- The long universe is a discovery frame, not a promise that Blueprint should touch every site soon.",
    "- High-security or rights-sensitive flagship sites should route through the operator lane, not generic capture outreach.",
    "- Buyer-thread-linked exact sites should outrank general prospecting whenever a real robot-team request exists.",
    "",
    "## Sources",
    "",
    ...ledger.sources.map((source) =>
      `- [${source.label}](${source.url}) — ${source.note}`,
    ),
  ].join("\n");
}
