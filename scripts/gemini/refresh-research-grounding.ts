import { getConfiguredEnvValue } from "../../server/config/env";
import { buildCityLaunchFileSearchStore } from "../../server/utils/geminiFileSearchStore";
import { refreshNotionGrounding } from "../../server/utils/notionGrounding";

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

function hasFlag(args: string[], flag: string) {
  return args.includes(flag);
}

function getCsvFlagValues(args: string[], flag: string) {
  const rawValue = getFlagValue(args, flag);
  if (!rawValue) {
    return undefined;
  }

  const values = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const city = getFlagValue(args, "--city");
  const skipNotion = hasFlag(args, "--skip-notion");
  const storeName =
    getFlagValue(args, "--store-name")
    || getConfiguredEnvValue(
      "BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE",
      "BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE",
    )
    || undefined;

  const notionGrounding = skipNotion
    ? null
    : await refreshNotionGrounding({
      city,
    });
  const result = await buildCityLaunchFileSearchStore({
    city,
    storeName,
    displayName: getFlagValue(args, "--display-name"),
    replaceExistingDocuments: !hasFlag(args, "--append"),
    dryRun: hasFlag(args, "--dry-run"),
    extraPaths: getCsvFlagValues(args, "--extra-paths"),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        notionGrounding:
          notionGrounding
            ? {
              rootRelativePath: notionGrounding.rootRelativePath,
              selectedPageCount: notionGrounding.selectedPages.length,
              writtenPathCount: notionGrounding.writtenPaths.length,
            }
            : null,
        dryRun: result.dryRun,
        city: result.city,
        citySlug: result.citySlug,
        displayName: result.displayName,
        storeName: result.storeName,
        createdStore: result.createdStore,
        resolvedPathCount: result.resolvedPaths.length,
        uploadedDocumentCount: result.uploadedDocuments.length,
        uploadedDocuments: result.uploadedDocuments.map((document) => ({
          repoRelativePath: document.repoRelativePath,
          replacedDocumentNames: document.replacedDocumentNames,
        })),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
