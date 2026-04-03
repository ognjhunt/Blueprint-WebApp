type AssetGoal =
  | "landing_page"
  | "email_campaign"
  | "outbound_sequence"
  | "social_cutdown"
  | "proof_reel";

export interface RemotionStoryboardFrame {
  startFrame: number;
  durationFrames: number;
  title: string;
  copy: string;
  visual: string;
}

export interface ProductReelImage {
  mimeType: string;
  dataUrl: string;
}

export interface ProductReelInput {
  storyboard: RemotionStoryboardFrame[];
  images: ProductReelImage[];
  runwayVideoUrl?: string | null;
  fps: number;
  width: number;
  height: number;
  storageObjectPath?: string | null;
}

export interface CreativeBriefInput {
  skuName: string;
  audience: string;
  siteType: string;
  workflow: string;
  proofPoints: string[];
  callToAction: string;
  differentiators: string[];
  buyerObjections?: string[];
  assetGoal: AssetGoal;
}

function nonEmpty(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim() || "").filter(Boolean);
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

export function buildCreativeCampaignKit(input: CreativeBriefInput) {
  const skuName = input.skuName.trim();
  const audience = input.audience.trim();
  const siteType = input.siteType.trim();
  const workflow = input.workflow.trim();
  const proofPoints = nonEmpty(input.proofPoints).slice(0, 6);
  const differentiators = nonEmpty(input.differentiators).slice(0, 4);
  const buyerObjections = nonEmpty(input.buyerObjections || []).slice(0, 3);
  const callToAction = input.callToAction.trim();
  const assetGoal = input.assetGoal;
  const topBuyerObjection = buyerObjections[0] || null;

  const heroLabel = `${titleCase(siteType)} • ${titleCase(workflow)}`;
  const heroHeadlineOptions = [
    `${skuName} for ${siteType} teams that need exact-site proof before a field visit`,
    `Review the exact site before your robot shows up`,
    `A grounded ${workflow} review path for one real ${siteType}`,
  ];

  const supportingBullets = [
    `Grounded on real capture of one ${siteType}, not synthetic stand-ins.`,
    ...(topBuyerObjection ? [`Counter the common buyer objection: ${topBuyerObjection}.`] : []),
    ...proofPoints.map((point) => point.replace(/\.$/, "")),
    ...differentiators.map((point) => point.replace(/\.$/, "")),
  ].slice(0, 5);

  const googleImagePrompt = [
    `Nano Banana campaign image for Blueprint's ${skuName}.`,
    `Show a real-world ${siteType} environment connected to a hosted robotics review workflow.`,
    `Focus on truthful evidence surfaces: capture provenance, site overlays, package manifests, hosted review UI, operator notes.`,
    `Avoid futuristic fantasy imagery, humanoids, fake dashboards, floating holograms, exaggerated sci-fi lighting, or claims of autonomy success.`,
    `Audience: ${audience}. Workflow: ${workflow}.`,
    proofPoints.length > 0 ? `Proof points to visually imply: ${proofPoints.join("; ")}.` : "",
    `Style: clean, premium, operational, photo-real, natural industrial lighting, high-trust B2B product marketing.`,
    `Aspect ratio should match the channel and leave space for headline-safe composition.`,
  ]
    .filter(Boolean)
    .join(" ");

  const nanoBananaVariants = [
    `${googleImagePrompt} Variant focus: wide hero composition for a landing page, 16:9.`,
    `${googleImagePrompt} Variant focus: close proof-led crop showing package manifest and hosted-review surfaces, 4:3.`,
    `${googleImagePrompt} Variant focus: vertical paid-social composition with CTA-safe negative space, 9:16.`,
  ];

  const runwayPrompt = [
    `Create a 15-second ${assetGoal === "social_cutdown" ? "vertical" : "landscape"} product ad.`,
    `Scene 1: establish one real ${siteType} environment with subtle movement and natural lighting.`,
    `Scene 2: show Blueprint's exact-site package and hosted review artifacts, anchored to ${workflow}.`,
    `Scene 3: show operator confidence and a clear CTA: ${callToAction}.`,
    `Keep all claims truthful. No impossible robot behavior. No fake customer logos. No fabricated metrics.`,
    `Use restrained motion graphics and preserve room for on-screen copy.`,
  ].join(" ");

  const remotionStoryboard: RemotionStoryboardFrame[] = [
    {
      startFrame: 0,
      durationFrames: 90,
      title: heroLabel,
      copy: heroHeadlineOptions[0],
      visual: `Real ${siteType} establishing shot with Blueprint proof overlays.`,
    },
    {
      startFrame: 90,
      durationFrames: 90,
      title: "Why this matters",
      copy: [
        topBuyerObjection ? `Buyer concern: ${topBuyerObjection}` : null,
        supportingBullets[0],
        supportingBullets[1],
      ]
        .filter(Boolean)
        .join(" • "),
      visual: "Package manifest, hosted session frame, and provenance markers.",
    },
    {
      startFrame: 180,
      durationFrames: 90,
      title: "What the buyer gets",
      copy: supportingBullets.slice(2).join(" • "),
      visual: "Structured list of package, hosted review, and operator outputs.",
    },
    {
      startFrame: 270,
      durationFrames: 90,
      title: "Next step",
      copy: callToAction,
      visual: "Clean CTA frame with real-site background and product lockup.",
    },
  ];

  const emailDraft = {
    subjectOptions: [
      `${skuName}: exact-site review for your next ${workflow}`,
      `One exact ${siteType} before your team travels`,
      `A narrower way to check ${workflow} on the real site`,
    ],
    previewText: `Blueprint can package and review one real ${siteType} for ${workflow}.`,
    body: [
      `Hi {{first_name}},`,
      "",
      `If your team needs to answer a ${workflow} question on one real ${siteType}, Blueprint's ${skuName} is built for that exact path.`,
      "",
      `What makes it useful:`,
      ...supportingBullets.map((point) => `- ${point}`),
      "",
      `If this is relevant, the next step is simple: ${callToAction}.`,
      "",
      `Best,`,
      `Blueprint`,
    ].join("\n"),
  };

  const outboundSequence = [
    {
      step: 1,
      channel: "email",
      goal: "Introduce the exact-site review wedge in one sentence.",
      subject: emailDraft.subjectOptions[0],
    },
    {
      step: 2,
      channel: "email",
      goal: "Follow up with one proof point and one CTA.",
      subject: emailDraft.subjectOptions[1],
    },
    {
      step: 3,
      channel: "linkedin_or_x",
      goal: "Share a short proof-led artifact or reel, not a generic pitch.",
      subject: null,
    },
  ];

  return {
    offer: {
      skuName,
      assetGoal,
      heroLabel,
      audience,
      workflow,
      siteType,
      callToAction,
    },
    landingPage: {
      heroHeadlineOptions,
      proofBullets: supportingBullets,
      cta: callToAction,
    },
    prompts: {
      googleImagePrompt,
      nanoBananaVariants,
      runwayPrompt,
    },
    remotionStoryboard,
    emailDraft,
    outboundSequence,
    provenanceGuardrails: [
      "Use only real Blueprint evidence, captures, package details, and buyer flows.",
      "Do not imply deployment success, customer traction, or coverage that does not exist.",
      "Do not use fake customer logos, fabricated quotes, or synthetic before/after proof.",
      "Label hosted review, package access, and optional demo layers distinctly.",
    ],
  };
}
