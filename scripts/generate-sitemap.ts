import fs from "node:fs";
import path from "node:path";
import { buildSitemapXml, getPublicAssetDir } from "../server/utils/public-artifacts";

const xml = buildSitemapXml();
const outputPath = path.join(getPublicAssetDir(true), "sitemap.xml");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, xml, "utf8");

console.log(`Sitemap written to ${outputPath}`);
