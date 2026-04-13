import { buildCityLaunchFileSearchStore } from "../../server/utils/geminiFileSearchStore";

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
  const result = await buildCityLaunchFileSearchStore({
    city: getFlagValue(args, "--city"),
    storeName: getFlagValue(args, "--store-name"),
    displayName: getFlagValue(args, "--display-name"),
    replaceExistingDocuments: !hasFlag(args, "--append"),
    dryRun: hasFlag(args, "--dry-run"),
    extraPaths: getCsvFlagValues(args, "--extra-paths"),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: result.dryRun,
        city: result.city,
        citySlug: result.citySlug,
        displayName: result.displayName,
        storeName: result.storeName,
        createdStore: result.createdStore,
        resolvedPathCount: result.resolvedPaths.length,
        resolvedPaths: result.resolvedPaths,
        uploadedDocumentCount: result.uploadedDocuments.length,
        uploadedDocuments: result.uploadedDocuments.map((document) => ({
          repoRelativePath: document.repoRelativePath,
          mimeType: document.mimeType,
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
