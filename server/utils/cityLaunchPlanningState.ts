import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugifyCityName } from "./cityLaunchProfiles";
import { validateCityLaunchPlaybookMarkdown } from "./cityLaunchPlanningHarness";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const DEFAULT_REPORTS_ROOT = path.join(
  REPO_ROOT,
  "ops/paperclip/reports/city-launch-deep-research",
);

export type CityLaunchPlanningStateStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "refresh_in_progress";

export type CityLaunchPlanningState = {
  city: string;
  citySlug: string;
  status: CityLaunchPlanningStateStatus;
  reportsRoot: string;
  cityReportsRoot: string;
  canonicalPlaybookPath: string;
  runDirectory: string | null;
  manifestPath: string | null;
  latestArtifactPath: string | null;
  completedArtifactPath: string | null;
  latestRunTimestamp: string | null;
  warnings: string[];
};

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileHasValidPlaybook(filePath: string, city: string) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return validateCityLaunchPlaybookMarkdown({ city, markdown: content }).ok;
  } catch {
    return false;
  }
}

async function resolveLatestRunDirectory(cityReportsRoot: string) {
  if (!(await fileExists(cityReportsRoot))) {
    return null;
  }

  const entries = await fs.readdir(cityReportsRoot, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  if (directories.length === 0) {
    return null;
  }

  return {
    timestamp: directories[0],
    runDirectory: path.join(cityReportsRoot, directories[0]),
  };
}

async function resolveLatestArtifactPath(runDirectory: string | null) {
  if (!runDirectory) {
    return null;
  }

  const candidates = [
    "99-final-playbook.md",
    "20-follow-up-research-round-9.md",
    "20-follow-up-research-round-8.md",
    "20-follow-up-research-round-7.md",
    "20-follow-up-research-round-6.md",
    "20-follow-up-research-round-5.md",
    "20-follow-up-research-round-4.md",
    "20-follow-up-research-round-3.md",
    "20-follow-up-research-round-2.md",
    "20-follow-up-research-round-1.md",
    "10-critique-round-9.md",
    "10-critique-round-8.md",
    "10-critique-round-7.md",
    "10-critique-round-6.md",
    "10-critique-round-5.md",
    "10-critique-round-4.md",
    "10-critique-round-3.md",
    "10-critique-round-2.md",
    "10-critique-round-1.md",
    "01-initial-research.md",
  ];

  for (const candidate of candidates) {
    const candidatePath = path.join(runDirectory, candidate);
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

async function resolveLatestCompletedArtifactPath(cityReportsRoot: string, city: string) {
  if (!(await fileExists(cityReportsRoot))) {
    return null;
  }

  const directories = (await fs.readdir(cityReportsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const candidates = [
    "99-final-playbook.md",
    "20-follow-up-research-round-9.md",
    "20-follow-up-research-round-8.md",
    "20-follow-up-research-round-7.md",
    "20-follow-up-research-round-6.md",
    "20-follow-up-research-round-5.md",
    "20-follow-up-research-round-4.md",
    "20-follow-up-research-round-3.md",
    "20-follow-up-research-round-2.md",
    "20-follow-up-research-round-1.md",
    "10-critique-round-9.md",
    "10-critique-round-8.md",
    "10-critique-round-7.md",
    "10-critique-round-6.md",
    "10-critique-round-5.md",
    "10-critique-round-4.md",
    "10-critique-round-3.md",
    "10-critique-round-2.md",
    "10-critique-round-1.md",
    "01-initial-research.md",
  ];

  for (const directory of directories) {
    const runDirectory = path.join(cityReportsRoot, directory);
    for (const candidate of candidates) {
      const candidatePath = path.join(runDirectory, candidate);
      if (!(await fileExists(candidatePath))) {
        continue;
      }
      if (!(await fileHasValidPlaybook(candidatePath, city))) {
        continue;
      }
      return candidatePath;
    }
  }

  return null;
}

export async function resolveCityLaunchPlanningState(input: {
  city: string;
  reportsRoot?: string;
}) {
  const city = input.city.trim();
  const citySlug = slugifyCityName(city);
  const reportsRoot = input.reportsRoot || DEFAULT_REPORTS_ROOT;
  const cityReportsRoot = path.join(reportsRoot, citySlug);
  const canonicalPlaybookPath = path.join(
    REPO_ROOT,
    "ops/paperclip/playbooks",
    `city-launch-${citySlug}-deep-research.md`,
  );
  const latestRun = await resolveLatestRunDirectory(cityReportsRoot);
  const latestArtifactPath = await resolveLatestArtifactPath(latestRun?.runDirectory || null);
  const manifestPath = latestRun?.runDirectory
    ? path.join(latestRun.runDirectory, "manifest.json")
    : null;
  const canonicalExists = await fileExists(canonicalPlaybookPath);
  const canonicalValid = canonicalExists
    ? await fileHasValidPlaybook(canonicalPlaybookPath, city)
    : false;
  const latestCompletedArtifactPath = await resolveLatestCompletedArtifactPath(cityReportsRoot, city);

  let status: CityLaunchPlanningStateStatus = "not_started";
  let completedArtifactPath: string | null = null;
  const warnings: string[] = [];

  if (canonicalExists && canonicalValid) {
    completedArtifactPath = canonicalPlaybookPath;
    status = "completed";
  } else if (latestCompletedArtifactPath) {
    completedArtifactPath = latestCompletedArtifactPath;
    status = "completed";
  }

  if (canonicalExists && !canonicalValid) {
    warnings.push("Canonical city-launch playbook exists but fails the current machine-readable validation contract.");
  }

  const hasPartialRun = Boolean(
    latestRun?.runDirectory
    && latestArtifactPath
    && completedArtifactPath !== latestArtifactPath,
  );

  if (status === "completed" && hasPartialRun) {
    status = "refresh_in_progress";
    warnings.push("A newer city-launch planning refresh is still in progress.");
  } else if (status === "not_started" && latestRun?.runDirectory && latestArtifactPath) {
    status = "in_progress";
    warnings.push("City-launch planning has partial artifacts but no final playbook yet.");
  }

  if (status === "not_started") {
    warnings.push("No city-launch planning artifacts were found for this city.");
  }

  return {
    city,
    citySlug,
    status,
    reportsRoot,
    cityReportsRoot,
    canonicalPlaybookPath,
    runDirectory: latestRun?.runDirectory || null,
    manifestPath,
    latestArtifactPath,
    completedArtifactPath,
    latestRunTimestamp: latestRun?.timestamp || null,
    warnings,
  } satisfies CityLaunchPlanningState;
}
