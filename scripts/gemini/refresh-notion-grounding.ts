import { refreshNotionGrounding } from "../../server/utils/notionGrounding";

function getFlagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return args[index + 1] || null;
}

async function main() {
  const args = process.argv.slice(2);
  const limitPerDatabase = Number(getFlagValue(args, "--limit-per-database") || "20");
  const result = await refreshNotionGrounding({
    city: getFlagValue(args, "--city"),
    limitPerDatabase: Number.isFinite(limitPerDatabase) ? limitPerDatabase : 20,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        city: result.city,
        rootRelativePath: result.rootRelativePath,
        manifestPath: result.manifestPath,
        indexPath: result.indexPath,
        selectedPageCount: result.selectedPages.length,
        writtenPathCount: result.writtenPaths.length,
        selectedPages: result.selectedPages,
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
