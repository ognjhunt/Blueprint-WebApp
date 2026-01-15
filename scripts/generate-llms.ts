import fs from "node:fs";
import path from "node:path";
import {
  excludedPrivateRoutes,
  publicRouteAliases,
  publicRoutes,
} from "../client/src/routes/publicRoutes";

const writeFile = (filename: string, content: string) => {
  const outputPath = path.resolve("client", "public", filename);
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`${filename} written to ${outputPath}`);
};

const highPriorityRoutes = publicRoutes.filter((route) => route.priority >= 0.7);

const llmsText = `Blueprint is a robotics data platform delivering SimReady 3D environments, datasets, evaluation tooling, and marketplace content to help teams train, validate, and deploy AI faster.\n\n` +
  `High-priority public URLs:\n` +
  highPriorityRoutes.map((route) => `- ${route.path}`).join("\n") +
  `\n\nFull content: /llms-full.txt\n`;

const structuredSummaries = publicRoutes
  .map(
    (route) =>
      `- **${route.label} (\`${route.path}\`)**: ${route.summary}`,
  )
  .join("\n");

const canonicalUrls = publicRoutes
  .map((route) => `- ${route.path} (${route.label})`)
  .join("\n");

const excludedRoutes = excludedPrivateRoutes
  .map((route) => `- ${route.path}: ${route.reason}`)
  .join("\n");

const aliases = publicRouteAliases
  .map((alias) => `- ${alias.path} → ${alias.aliasFor}: ${alias.reason}`)
  .join("\n");

const llmsFullText = `# Blueprint — long-form overview\n\n` +
  `## Product overview\n` +
  `Blueprint is a robotics data platform for creating, delivering, and validating simulation-ready assets. It provides SimReady 3D environments, datasets, and evaluation tooling so robotics teams can train, benchmark, and deploy AI systems with confidence. Blueprint also offers on-site capture and custom scene production to transform real locations into reusable digital twins for simulation.\n\n` +
  `## Positioning\n` +
  `- **Robotics simulation data platform:** access a curated marketplace of scenes and datasets, run evaluations, and integrate assets into simulator workflows.\n` +
  `- **Sim-to-real readiness:** assets are built for physics accuracy, semantic labeling, and task coverage so teams can train and validate policies with confidence.\n` +
  `- **Custom scene production:** Blueprint can capture real locations and deliver tailored SimReady environments for specific tasks.\n\n` +
  `## Key capabilities\n` +
  `- SimReady environments and datasets with semantic labels and physics-ready materials.\n` +
  `- Marketplace discovery for scenes, training sets, and bundle packs.\n` +
  `- Evaluation and analytics for data quality, policy benchmarking, and sim-to-real transfer.\n` +
  `- On-site capture and custom scene production for robotics teams.\n` +
  `- Integration-focused docs and guides for simulator pipelines.\n\n` +
  `## Structured summaries of important pages\n` +
  `${structuredSummaries}\n\n` +
  `## FAQs (canonical)\n` +
  `- **What is Blueprint?** A robotics data platform for building simulation-ready digital twins and datasets, delivering the assets, data, and tools needed to train and validate AI systems.\n` +
  `- **How are assets delivered?** Through the Marketplace and custom capture projects, with standardized specs for simulation pipelines.\n` +
  `- **Do you offer custom scenes?** Yes—teams can request on-site capture and custom SimReady environments.\n` +
  `- **Who is Blueprint for?** Robotics teams, simulation engineers, and organizations building AI systems that need high-quality 3D environments and data.\n` +
  `- **How do I get started?** Browse the Marketplace, review documentation, and contact the team for tailored datasets or services.\n\n` +
  `## Canonical URLs\n` +
  `${canonicalUrls}\n\n` +
  `## Backwards-compatible aliases\n` +
  `${aliases}\n\n` +
  `## Excluded private or gated routes\n` +
  `${excludedRoutes}\n`;

writeFile("llms.txt", llmsText);
writeFile("llms-full.txt", llmsFullText);
