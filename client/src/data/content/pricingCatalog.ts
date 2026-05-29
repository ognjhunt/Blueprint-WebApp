export type BundleTier = "standard" | "pro" | "enterprise" | "foundation";

export interface BundleFeature {
  name: string;
  description: string;
  includedIn: BundleTier[];
}

export interface PremiumCapability {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  detailedDescription: string;
  /** Fixed price for this add-on */
  price: number;
  /** Display string for price (e.g., "+$1,500") */
  priceDisplay: string;
  tier: "immediate" | "strategic" | "enterprise";
  icon: string;
  benefits: string[];
  technicalDetails: string[];
  useCases: string[];
  /** If true, this add-on requires scene purchase (not episodes-only) */
  requiresScene?: boolean;
  /** If true, this add-on requires episodes purchase (not scene-only) */
  requiresEpisodes?: boolean;
  /** Slugs of add-ons that cannot be selected together with this one */
  incompatibleWith?: string[];
}

export interface BundleTierConfig {
  tier: BundleTier;
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  episodeCount: string;
  variationCount: string;
  highlights: string[];
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  isFeatured?: boolean;
  isEnterprise?: boolean;
}

// Premium capabilities that enhance base scene bundles
export const premiumCapabilities: PremiumCapability[] = [
  // === TIER 1: IMMEDIATE HIGH-IMPACT ===
  {
    slug: "vla-finetuning",
    title: "VLA Fine-Tuning Packages",
    shortTitle: "VLA Training",
    description:
      "Turnkey fine-tuning configs for OpenVLA, Pi0, SmolVLA, and GR00T N1.5.",
    detailedDescription:
      "Pre-configured training pipelines with hyperparameters, evaluation scripts, and model checkpoints. Saves 2-4 weeks of ML engineering time per model.",
    price: 4500,
    priceDisplay: "+$4,500",
    tier: "immediate",
    icon: "brain",
    benefits: [
      "Ready-to-run training configs for 4 VLA architectures",
      "Pre-tuned hyperparameters validated on Blueprint data",
      "Evaluation scripts with sim2real metrics",
    ],
    technicalDetails: [
      "OpenVLA 7B with LoRA fine-tuning configs",
      "Pi0 (Physical Intelligence) integration",
      "SmolVLA 450M for edge deployment",
      "GR00T N1.5 configs for humanoid training",
    ],
    useCases: [
      "Foundation model teams needing diverse training data",
      "Labs evaluating VLA architectures",
      "Companies building language-conditioned robots",
    ],
    requiresEpisodes: true,
  },
  {
    slug: "language-annotations",
    title: "Language-Conditioned Data",
    shortTitle: "Language Data",
    description:
      "Natural language instructions for every episode with 10+ variations per task.",
    detailedDescription:
      "Genie Sim 3.0 LLM-generated language annotations in multiple styles (imperative, descriptive, casual). Enables vision-language-action model training without manual annotation.",
    price: 1500,
    priceDisplay: "+$1,500",
    tier: "immediate",
    icon: "message-square",
    benefits: [
      "10+ language variations per task",
      "Multiple annotation styles for robustness",
      "Automatic integration with LeRobot export",
    ],
    technicalDetails: [
      "Template-based generation for common tasks",
      "LLM-powered variation expansion (Gemini)",
      "Imperative, descriptive, and casual styles",
      "JSON/Parquet export formats",
    ],
    useCases: [
      "VLA model training (OpenVLA, Pi0, SmolVLA)",
      "Language-conditioned imitation learning",
      "Multi-task policy training",
    ],
    requiresEpisodes: true,
  },
  {
    slug: "sim2real-validation",
    title: "Sim2Real Validation",
    shortTitle: "Sim2Real QA",
    description:
      "Automated sim-to-real transfer validation with partner lab testing.",
    detailedDescription:
      "Complete validation framework with automated reporting, partner lab integration, and quality guarantees. Based on NVIDIA research showing 5%→87% improvement with proper domain randomization.",
    price: 8500,
    priceDisplay: "+$8,500",
    tier: "immediate",
    icon: "check-circle",
    benefits: [
      "Automated transfer gap analysis",
      "Partner lab integration for real-world testing",
      "Quality guarantees (50%/70%/85% success tiers)",
    ],
    technicalDetails: [
      "Domain randomization validation",
      "Physics accuracy verification",
      "Real-world deployment metrics",
      "Failure case analysis with remediation",
    ],
    useCases: [
      "Pre-deployment validation",
      "Research paper benchmarking",
      "Customer proof-of-concept demonstrations",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "contact-rich-tasks",
    title: "Contact-Rich Tasks",
    shortTitle: "Precision Assembly",
    description:
      "Specialized episodes for peg-in-hole, snap-fit, and precision insertion.",
    detailedDescription:
      "High-precision contact physics with force/torque feedback, compliance control, and sub-millimeter tolerances. Based on NVIDIA's faster-than-realtime assembly training research.",
    price: 9000,
    priceDisplay: "+$9,000",
    tier: "immediate",
    icon: "target",
    benefits: [
      "Sub-millimeter tolerance physics",
      "Force/torque profile generation",
      "Compliance control trajectories",
    ],
    technicalDetails: [
      "Peg-in-hole insertion (0.1-2mm clearance)",
      "Snap-fit assembly with force feedback",
      "Screw driving with torque monitoring",
      "Cable insertion and routing",
    ],
    useCases: [
      "Electronics assembly automation",
      "Automotive manufacturing",
      "Precision laboratory tasks",
    ],
    requiresEpisodes: true,
  },

  // === TIER 2: STRATEGIC ADDITIONS ===
  {
    slug: "tactile-sensor",
    title: "Tactile Sensor Data",
    shortTitle: "Tactile Data",
    description:
      "Simulated tactile sensor data for GelSight, GelSlim, and DIGIT sensors.",
    detailedDescription:
      "Complete tactile simulation layer with depth maps, force distributions, and marker displacement tracking. Enables training of tactile-visual policies.",
    price: 3000,
    priceDisplay: "+$3,000",
    tier: "strategic",
    icon: "hand",
    benefits: [
      "GelSight/GelSlim marker simulation",
      "DIGIT optical tactile sensor model",
      "Contact force distribution maps",
    ],
    technicalDetails: [
      "160x120 tactile image generation",
      "Dual-gripper tactile simulation",
      "Force-to-deformation modeling",
      "Integration with LeRobot observation space",
    ],
    useCases: [
      "Contact-rich manipulation",
      "Delicate object handling",
      "Assembly verification",
    ],
    requiresEpisodes: true,
  },
  {
    slug: "multi-robot-fleet",
    title: "Multi-Robot Coordination",
    shortTitle: "Fleet Coordination",
    description:
      "Handoff scenarios and collaborative assembly for multi-robot deployments.",
    detailedDescription:
      "Multi-agent coordination episodes with synchronized timing, collision avoidance, and task handoff protocols.",
    price: 8000,
    priceDisplay: "+$8,000",
    tier: "strategic",
    icon: "users",
    benefits: [
      "Robot-to-robot handoff episodes",
      "Collaborative assembly sequences",
      "Fleet navigation coordination",
    ],
    technicalDetails: [
      "2-8 robot coordination",
      "Synchronized action timing",
      "Shared workspace management",
      "Priority and scheduling protocols",
    ],
    useCases: [
      "Warehouse logistics",
      "Manufacturing cells",
      "Hospital logistics",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "deformable-objects",
    title: "Deformable Objects",
    shortTitle: "Deformables",
    description:
      "Cloth folding, cable routing, and soft object manipulation.",
    detailedDescription:
      "Finite element method simulation for deformable materials including fabrics, cables, ropes, and soft packaging.",
    price: 6000,
    priceDisplay: "+$6,000",
    tier: "strategic",
    icon: "layers",
    benefits: [
      "Cloth folding trajectories",
      "Cable routing and insertion",
      "Soft packaging manipulation",
    ],
    technicalDetails: [
      "Cloth simulation with self-collision",
      "Cable dynamics with friction",
      "Soft body deformation",
      "Material property randomization",
    ],
    useCases: [
      "Laundry automation",
      "Cable assembly",
      "Food packaging",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "custom-robot",
    title: "Custom Robot Integration",
    shortTitle: "Custom Robot",
    description:
      "URDF/USD onboarding for your exact robot hardware.",
    detailedDescription:
      "Complete robot integration pipeline: URDF→USD conversion, kinematics validation, and episode retargeting for your specific hardware.",
    price: 5000,
    priceDisplay: "+$5,000",
    tier: "strategic",
    icon: "cpu",
    benefits: [
      "URDF→USD automated conversion",
      "Kinematics validation suite",
      "Episode retargeting pipeline",
    ],
    technicalDetails: [
      "Joint limit validation",
      "Workspace analysis",
      "Collision geometry optimization",
      "Control frequency matching",
    ],
    useCases: [
      "Custom arm deployments",
      "Modified COTS robots",
      "Research prototype robots",
    ],
    requiresScene: true,
  },
  {
    slug: "bimanual",
    title: "Bimanual Manipulation",
    shortTitle: "Bimanual",
    description:
      "Coordinated dual-arm episodes for humanoid and dual-arm robots.",
    detailedDescription:
      "Synchronized bimanual manipulation with coordination primitives for emerging humanoid platforms.",
    price: 7500,
    priceDisplay: "+$7,500",
    tier: "strategic",
    icon: "move",
    benefits: [
      "Coordinated lift sequences",
      "Hold-and-manipulate patterns",
      "Bimanual handoff episodes",
    ],
    technicalDetails: [
      "Dual-arm trajectory synchronization",
      "Force distribution coordination",
      "Workspace overlap management",
      "Asymmetric task allocation",
    ],
    useCases: [
      "Humanoid robots (Figure, 1X, Sanctuary)",
      "Dual-arm industrial cells",
      "Research bimanual platforms",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },

  // === TIER 3: EVALUATION SERVICES ===
  {
    slug: "policy-benchmarking",
    title: "Policy Benchmarking",
    shortTitle: "Benchmarking",
    description:
      "GPU-accelerated policy evaluation with detailed performance reports.",
    detailedDescription:
      "Send your trained policies to Blueprint for standardized benchmarking on this scene. Receive detailed reports with success rates, completion times, collision counts, and generalization metrics across 1000+ evaluation episodes.",
    price: 350,
    priceDisplay: "+$350",
    tier: "immediate",
    icon: "bar-chart",
    benefits: [
      "1000+ evaluation episodes",
      "Standardized metrics (success rate, completion time, collisions)",
      "Comparison against baseline policies",
    ],
    technicalDetails: [
      "Isaac Lab-Arena GPU-accelerated execution",
      "Affordance-based task auto-generation",
      "JSON/PDF report with visualizations",
      "LeRobot Hub metrics integration",
    ],
    useCases: [
      "Pre-deployment policy validation",
      "Research paper benchmarking",
      "Policy comparison across architectures",
    ],
    requiresScene: true,
  },
  {
    slug: "lerobot-hub-publishing",
    title: "LeRobot Hub Publishing",
    shortTitle: "Hub Publishing",
    description:
      "Package and publish your environment to Hugging Face LeRobot Hub.",
    detailedDescription:
      "We handle the full packaging and publishing pipeline: Arena-format conversion, metadata generation, dataset cards, and Hugging Face Hub registration. Your environment becomes discoverable by the global robotics community.",
    price: 750,
    priceDisplay: "+$750",
    tier: "immediate",
    icon: "globe",
    benefits: [
      "Full Hub-ready packaging",
      "Dataset card with usage examples",
      "Community discoverability and citations",
    ],
    technicalDetails: [
      "Arena Scene class generation",
      "Asset registry and Hub config",
      "Automated dataset card with benchmarks",
      "Version control and update pipeline",
    ],
    useCases: [
      "Research labs sharing environments",
      "Companies building public benchmarks",
      "Open-source robotics contributions",
    ],
    requiresScene: true,
  },

  // === NEW TIER: PREMIUM ANALYTICS (High-Value Data Quality Validation) ===
  {
    slug: "failure-mode-analysis",
    title: "Failure Mode Analysis",
    shortTitle: "Failure Analytics",
    description:
      "Comprehensive failure taxonomy and root cause analysis for every failed episode.",
    detailedDescription:
      "Automatically categorize and analyze why episodes fail: collision detection, grasp slippage, placement errors, timeouts, and contact violations. Frame-by-frame failure detection with actionable recommendations for training data filtering. Saves labs 10x debugging time.",
    price: 12000,
    priceDisplay: "+$12,000",
    tier: "strategic",
    icon: "bar-chart",
    benefits: [
      "Failure taxonomy: collision, grasp_fail, placement_error, timeout, contact_violation",
      "Frame-by-frame failure detection and localization",
      "Root cause classification with confidence scores",
      "Filtering recommendations for data quality improvement",
      "Failure pattern distribution analysis",
      "Recovery sequence identification",
    ],
    technicalDetails: [
      "Contact force monitoring and threshold detection",
      "Trajectory validation against constraints",
      "Grasp stability analysis (force closure metrics)",
      "Task success criteria validation",
      "Episode-level failure reports with visualization",
      "Aggregated failure statistics by scene/object/task",
    ],
    useCases: [
      "Data quality assessment before model training",
      "Understanding which scenarios to exclude from training",
      "Identifying edge cases and failure modes",
      "Improving dataset filtering and curation",
      "Debugging failed policy executions",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "sim2real-fidelity-matrix",
    title: "Sim-to-Real Fidelity Matrix",
    shortTitle: "Sim2Real Fidelity",
    description:
      "Comprehensive physics validation and transfer confidence scores across all simulation aspects.",
    detailedDescription:
      "Grades simulation fidelity across physics accuracy (friction, mass, dynamics), visual realism (textures, lighting, materials), sensor fidelity (camera, depth, proprioception), contact dynamics (force response, deformation), and domain randomization coverage. Generates a 'trust matrix' telling labs which aspects of simulation they can rely on for training. Literally saves $100K+ in failed real-robot experiments.",
    price: 15000,
    priceDisplay: "+$15,000",
    tier: "strategic",
    icon: "cpu",
    benefits: [
      "Physics fidelity scores (A-F scale): friction, mass distribution, joint dynamics",
      "Visual fidelity assessment: texture accuracy, material properties, lighting",
      "Sensor simulation validation: camera distortion, depth accuracy, proprioception drift",
      "Contact dynamics evaluation: force response accuracy, deformation modeling",
      "Transfer confidence scores (0-100%) for each aspect",
      "Domain randomization coverage analysis",
    ],
    technicalDetails: [
      "Physics parameter extraction from USD and Isaac Sim",
      "Sensor accuracy validation against real-world data",
      "Force/torque profile comparison: simulation vs. real hardware",
      "Contact point clustering and statistics",
      "Domain randomization coverage matrix",
      "Visual material PBR validation",
      "Multi-robot fidelity comparison",
    ],
    useCases: [
      "Pre-deployment transfer gap analysis",
      "Identifying which simulation aspects need real-world fine-tuning",
      "Cross-robot fidelity validation",
      "Reducing sim-to-real transfer risk",
      "Research paper validation and benchmarking",
      "Justifying training data quality to stakeholders",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "embodiment-transfer-analysis",
    title: "Embodiment Transfer Analysis",
    shortTitle: "Cross-Robot Analysis",
    description:
      "Quantify which robot embodiments can benefit from this dataset with transfer predictions.",
    detailedDescription:
      "Analyzes cross-robot compatibility and generates a matrix showing: per-robot success rates, kinematic capability matching, workspace overlap analysis, and transfer learning predictions. Answers: 'Can I use Franka data to train UR10?' Increases dataset value 3-5x for multi-robot labs by proving cross-embodiment transferability.",
    price: 18000,
    priceDisplay: "+$18,000",
    tier: "strategic",
    icon: "users",
    benefits: [
      "Per-robot success rate analysis",
      "Kinematic compatibility matrix (joint limits, workspace, reach)",
      "Cross-embodiment transfer predictions with confidence scores",
      "Workspace coverage analysis for each robot type",
      "Robot-specific trajectory retargeting recommendations",
      "Multi-arm configuration compatibility scoring",
    ],
    technicalDetails: [
      "Robot kinematics database (Franka, UR, GR1, Fetch, ABB, FANUC)",
      "Joint limit and workspace intersection analysis",
      "Trajectory feasibility validation per robot",
      "Grasp quality compatibility scoring",
      "Force/torque envelope matching",
      "Transfer learning potential quantification",
      "Robot-specific failure mode analysis",
    ],
    useCases: [
      "Multi-robot labs optimizing dataset ROI",
      "Validating data transferability across embodiments",
      "Proving dataset value to multiple hardware platforms",
      "Planning robot fleet training strategies",
      "Research comparing cross-embodiment learning",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "grasp-quality-metrics",
    title: "Grasp Quality Metrics",
    shortTitle: "Grasp Analysis",
    description:
      "Advanced grasp stability and robustness analysis for manipulation dataset quality.",
    detailedDescription:
      "Comprehensive grasp quality assessment: force closure computation, contact point analysis (where on the object was it grasped), grasp robustness estimation (probability of slip), approach vector analysis, and grasp configuration quality scoring. Essential for contact-rich learning since grasp learning is 60% of real manipulation research.",
    price: 14000,
    priceDisplay: "+$14,000",
    tier: "strategic",
    icon: "hand",
    benefits: [
      "Force closure analysis and grasp stability scores",
      "Contact point quality assessment and clustering",
      "Grasp approach vector optimization analysis",
      "Slip probability estimation based on friction",
      "Grasp configuration diversity scoring",
      "Gripper-specific grasp quality metrics",
      "Object-specific grasp robustness profiles",
    ],
    technicalDetails: [
      "Grasp matrix rank and condition number computation",
      "Contact point normal and tangential force analysis",
      "Friction cone validation per contact point",
      "Approach velocity and acceleration profiling",
      "Gripper jaw force distribution analysis",
      "Object center-of-mass relative contact position",
      "Grasp quality metrics: epsilon (minimum singular value), volume, wrench closure",
    ],
    useCases: [
      "Grasp learning and manipulation research",
      "Contact-rich task validation",
      "Identifying robust vs. fragile grasps in dataset",
      "Improving manipulation success rates",
      "Training stable grasping policies",
      "Understanding grasp generalization properties",
    ],
    requiresEpisodes: true,
  },
  {
    slug: "generalization-curves",
    title: "Generalization & Learning Curves",
    shortTitle: "Learning Analysis",
    description:
      "Detailed analysis of dataset generalization potential and learning efficiency.",
    detailedDescription:
      "Task difficulty stratification (easy vs. hard variants), per-object success rates, learning efficiency metrics (convergence speed, data efficiency curves), scene variation impact analysis, and curriculum learning recommendations. Tells labs: 'How much data do I really need?' and 'Will this cover my use case?' Critical for planning data acquisition budgets.",
    price: 11000,
    priceDisplay: "+$11,000",
    tier: "strategic",
    icon: "trending-up",
    benefits: [
      "Task difficulty stratification with success rate breakdown",
      "Per-object success rates and interaction patterns",
      "Learning efficiency curves (episodes vs. convergence)",
      "Data efficiency estimation (minimum data needed)",
      "Scene variation impact quantification",
      "Curriculum learning sequence recommendations",
      "Generalization gap analysis",
    ],
    technicalDetails: [
      "Task complexity scoring based on trajectory length and interaction count",
      "Object category success rate aggregation",
      "Learning curve fitting (exponential, power law models)",
      "Sample efficiency analysis",
      "Scene variation coverage mapping",
      "Curriculum ordering by difficulty",
      "Cross-validation generalization metrics",
    ],
    useCases: [
      "Planning data acquisition budgets",
      "Curriculum learning strategy design",
      "Understanding data efficiency",
      "Validating dataset coverage for specific use cases",
      "Identifying gaps in scene/object/task coverage",
      "Research benchmarking and comparison",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
  {
    slug: "trajectory-optimality",
    title: "Trajectory Optimality Analysis",
    shortTitle: "Trajectory Quality",
    description:
      "Path quality, efficiency, and smoothness metrics for all trajectories.",
    detailedDescription:
      "Comprehensive trajectory quality assessment: energy efficiency (joint torque integral), path straightness (deviation from optimal), smoothness (jerk analysis), joint limit margins, velocity profile analysis, and singularity avoidance. Validates trajectory quality for training and identifies inefficient motion patterns that hurt policy learning.",
    price: 9500,
    priceDisplay: "+$9,500",
    tier: "strategic",
    icon: "zap",
    benefits: [
      "Energy efficiency scoring (joint torque integrals)",
      "Path optimality analysis vs. optimal trajectory",
      "Smoothness metrics (jerk, acceleration continuity)",
      "Joint limit margin analysis",
      "Velocity profile characterization",
      "Singularity proximity detection",
      "Trajectory anomaly detection",
    ],
    technicalDetails: [
      "Torque-limited trajectory optimization baseline",
      "Cartesian path straightness scoring",
      "Jerk integral and smoothness continuous metrics",
      "Joint velocity and acceleration profiling",
      "Jacobian condition number tracking",
      "Collision margin computation along trajectory",
      "Comparison to RRT*, Trajopt, and iLQR solutions",
    ],
    useCases: [
      "Training policy data quality validation",
      "Identifying inefficient motion patterns",
      "Comparing trajectory generation methods",
      "Optimizing for energy-efficient policies",
      "Understanding motion quality impact on learning",
      "Robotics research benchmarking",
    ],
    requiresEpisodes: true,
  },

  // === PREMIUM ANALYTICS BUNDLE ===
  {
    slug: "premium-analytics-bundle",
    title: "Premium Analytics Bundle",
    shortTitle: "Full Analytics",
    description:
      "Complete data quality validation package: failure analysis, sim2real fidelity, embodiment transfer, grasp quality, generalization curves, and trajectory optimality.",
    detailedDescription:
      "Comprehensive analytics suite that transforms your raw dataset into an enterprise-grade product. Includes: failure mode analysis ($12k), sim2real fidelity matrix ($15k), embodiment transfer analysis ($18k), grasp quality metrics ($14k), generalization curves ($11k), and trajectory optimality analysis ($9.5k). Valued at $80k if purchased separately. This is the premium offering that robotics labs pay $50k-$200k for.",
    price: 45000,
    priceDisplay: "+$45,000",
    tier: "strategic",
    icon: "bar-chart",
    benefits: [
      "All 6 premium analytics modules included",
      "Comprehensive EXECUTIVE_SUMMARY.md for stakeholders",
      "Failure mode taxonomy and filtering recommendations",
      "Sim-to-real confidence scores for transfer risk assessment",
      "Multi-robot compatibility matrix",
      "Grasp quality and stability analysis",
      "Learning curves and data efficiency estimates",
      "Trajectory quality and optimality metrics",
    ],
    technicalDetails: [
      "Integrated analytics service orchestration",
      "Cross-module data validation and consistency",
      "Multi-format report generation (JSON, PDF, HTML)",
      "Automated visualization and dashboard generation",
      "Historical tracking and version control",
      "Custom metric computation and aggregation",
    ],
    useCases: [
      "Foundation model teams validating datasets",
      "Robotics companies launching premium data products",
      "Research institutions publishing benchmark datasets",
      "Enterprise deployments requiring data quality guarantees",
      "Licensing dataset to multiple organizations",
    ],
    requiresScene: true,
    requiresEpisodes: true,
  },
];

// Bundle tier configurations
export const bundleTiers: BundleTierConfig[] = [
  {
    tier: "standard",
    name: "Standard",
    price: "$5,499",
    description:
      "Complete scene with simulation-ready USD, domain randomization, and Genie Sim 3.0-generated episodes. LLM task generation, VLM evaluation, and basic quality metrics included.",
    episodeCount: "2,500",
    variationCount: "500-1,000",
    highlights: [
      "Physics-accurate USD scene",
      "Genie Sim 3.0 data generation",
      "2,500 VLM-evaluated episodes",
      "cuRobo trajectory planning",
      "Basic quality metrics included",
    ],
    features: [
      "SimReady USD package",
      "Articulation + collision setup",
      "Genie Sim 3.0 LLM task generation",
      "cuRobo GPU-accelerated trajectories",
      "VLM-evaluated episodes (2,500)",
      "LeRobot v0.3.3 format export",
      "Isaac Lab environment configs",
      "Basic quality metrics (success rates, episode counts)",
      "30-day support",
    ],
    ctaLabel: "Get Started",
    ctaHref: "/contact?tier=standard",
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$12,499",
    description:
      "Enhanced bundle with language annotations, VLA training packages, basic analytics, and 2x episode count. Ideal for VLA model training and quality-conscious research labs.",
    episodeCount: "5,000",
    variationCount: "1,000-2,000",
    highlights: [
      "Everything in Standard",
      "Language annotations (10 variations/task)",
      "VLA fine-tuning configs (2 models)",
      "5,000 episodes",
      "Failure mode analysis + generalization curves",
    ],
    features: [
      "Everything in Standard",
      "Language-conditioned annotations",
      "10 language variations per task",
      "VLA fine-tuning package (OpenVLA + SmolVLA)",
      "5,000 manipulation episodes",
      "Failure Mode Analysis (categorize & understand failures)",
      "Generalization & Learning Curves (data efficiency analysis)",
      "Per-object success rates and task difficulty scoring",
      "Priority email support",
      "90-day support window",
    ],
    ctaLabel: "Upgrade to Pro",
    ctaHref: "/contact?tier=pro",
    isFeatured: true,
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: "$25,000",
    description:
      "Full-stack bundle with comprehensive analytics, sim2real validation, tactile simulation, and advanced manipulation capabilities. Complete data quality validation for mission-critical deployments.",
    episodeCount: "10,000",
    variationCount: "2,000+",
    highlights: [
      "Everything in Pro",
      "Premium Analytics Suite (4/6 modules)",
      "Sim2Real Fidelity Matrix (transfer confidence)",
      "Embodiment Transfer Analysis (multi-robot validation)",
      "Grasp Quality Metrics (manipulation quality)",
      "Trajectory Optimality Analysis (path quality)",
      "Tactile sensor simulation",
      "Contact-rich task premium",
      "All 4 VLA models",
    ],
    features: [
      "Everything in Pro",
      "Failure Mode Analysis (root cause taxonomy)",
      "Sim2Real Fidelity Matrix (physics validation, A-F grades)",
      "Embodiment Transfer Analysis (cross-robot compatibility matrix)",
      "Grasp Quality Metrics (force closure, contact analysis)",
      "Generalization & Learning Curves (curriculum learning)",
      "Trajectory Optimality Analysis (energy efficiency, path quality)",
      "Tactile sensor data layer (GelSight/DIGIT)",
      "Contact-rich task episodes (peg-in-hole, assembly)",
      "All VLA fine-tuning configs (OpenVLA, Pi0, SmolVLA, GR00T)",
      "10,000 manipulation episodes",
      "Custom robot embodiment (1 robot)",
      "Dedicated Slack channel",
      "1 year support",
    ],
    ctaLabel: "Contact Sales",
    ctaHref: "/contact?tier=enterprise",
    isEnterprise: true,
  },
  {
    tier: "foundation",
    name: "Foundation",
    price: "$500K–$2M+",
    priceNote: "per year",
    description:
      "Platform license for foundation model teams. Unlimited scenes, streaming access, complete premium analytics suite, and custom data pipelines. Enterprise-grade data quality validation for every dataset.",
    episodeCount: "Unlimited",
    variationCount: "Unlimited",
    highlights: [
      "Everything in Enterprise",
      "Premium Analytics Bundle (All 7 modules)",
      "Complete data quality validation",
      "1,000+ scenes library access",
      "Streaming dataset delivery",
      "Exclusive scene commissions",
      "Multi-embodiment retargeting",
      "Executive-ready analytics reports",
    ],
    features: [
      "Everything in Enterprise",
      "Premium Analytics Bundle (ALL 6 modules):",
      "  • Failure Mode Analysis (root cause + filtering)",
      "  • Sim2Real Fidelity Matrix (physics validation)",
      "  • Embodiment Transfer Analysis (cross-robot matrix)",
      "  • Grasp Quality Metrics (stability analysis)",
      "  • Generalization & Learning Curves (efficiency)",
      "  • Trajectory Optimality Analysis (path quality)",
      "  • Executive Summary Reports & Visualizations",
      "1,000+ scene catalog access (streaming or batch)",
      "Streaming dataset API (continuous training)",
      "Exclusive scene commissions (custom development)",
      "Priority custom captures",
      "Multi-embodiment retargeting (unlimited robots)",
      "Dedicated engineering support",
      "Quarterly roadmap input",
      "SLA guarantees (99.5% availability)",
      "Custom metric computation & aggregation",
    ],
    ctaLabel: "Talk to Founders",
    ctaHref: "/contact?tier=foundation",
    isEnterprise: true,
  },
];

// Feature comparison matrix for pricing page
export const bundleFeatureMatrix: BundleFeature[] = [
  // === Core Offerings ===
  { name: "SimReady USD Scene", description: "Physics-accurate geometry with articulation", includedIn: ["standard", "pro", "enterprise", "foundation"] },
  { name: "Domain Randomization", description: "Lighting, textures, poses, clutter", includedIn: ["standard", "pro", "enterprise", "foundation"] },
  { name: "LeRobot Episodes", description: "AI-generated manipulation trajectories", includedIn: ["standard", "pro", "enterprise", "foundation"] },
  { name: "Isaac Lab Configs", description: "Ready-to-train environment configs", includedIn: ["standard", "pro", "enterprise", "foundation"] },
  { name: "Language Annotations", description: "Natural language task instructions", includedIn: ["pro", "enterprise", "foundation"] },
  { name: "VLA Fine-Tuning (2 models)", description: "OpenVLA + SmolVLA configs", includedIn: ["pro", "enterprise", "foundation"] },
  { name: "VLA Fine-Tuning (All 4)", description: "OpenVLA, Pi0, SmolVLA, GR00T", includedIn: ["enterprise", "foundation"] },

  // === PREMIUM ANALYTICS (NEW - HIGH VALUE) ===
  { name: "Failure Mode Analysis", description: "Root cause taxonomy, failure filtering, quality improvement recommendations", includedIn: ["pro", "enterprise", "foundation"] },
  { name: "Sim2Real Fidelity Matrix", description: "Physics, visual, sensor, contact fidelity grades (A-F) with transfer confidence scores", includedIn: ["enterprise", "foundation"] },
  { name: "Embodiment Transfer Analysis", description: "Cross-robot compatibility matrix, per-robot success rates, transfer predictions", includedIn: ["enterprise", "foundation"] },
  { name: "Grasp Quality Metrics", description: "Force closure, contact analysis, grasp stability, robustness scoring", includedIn: ["enterprise", "foundation"] },
  { name: "Generalization & Learning Curves", description: "Task difficulty stratification, data efficiency, curriculum learning recommendations", includedIn: ["pro", "enterprise", "foundation"] },
  { name: "Trajectory Optimality Analysis", description: "Energy efficiency, path quality, smoothness, joint limit analysis", includedIn: ["enterprise", "foundation"] },
  { name: "Premium Analytics Bundle", description: "All 6 analytics modules + executive reporting (valued at $80k separately)", includedIn: ["foundation"] },

  // === Advanced Capabilities ===
  { name: "Sim2Real Validation", description: "Transfer gap analysis + guarantees", includedIn: ["enterprise", "foundation"] },
  { name: "Tactile Sensor Data", description: "GelSight/DIGIT simulation", includedIn: ["enterprise", "foundation"] },
  { name: "Contact-Rich Tasks", description: "Peg-in-hole, assembly, insertion", includedIn: ["enterprise", "foundation"] },
  { name: "Custom Robot Support", description: "URDF→USD + episode retargeting", includedIn: ["enterprise", "foundation"] },
  { name: "Multi-Robot Fleet", description: "Coordination episodes", includedIn: ["foundation"] },
  { name: "Bimanual Manipulation", description: "Dual-arm coordinated episodes", includedIn: ["foundation"] },
  { name: "Deformable Objects", description: "Cloth, cable, soft object physics", includedIn: ["foundation"] },

  // === Platform Features ===
  { name: "Streaming Access", description: "Dataset API for continuous training", includedIn: ["foundation"] },
  { name: "Exclusive Commissions", description: "Priority custom scene development", includedIn: ["foundation"] },
  { name: "Executive Analytics Reports", description: "PDF/HTML reports with visualizations and stakeholder summaries", includedIn: ["enterprise", "foundation"] },
];
