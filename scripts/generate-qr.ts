import QRCode from "qrcode";
import { writeFile } from "fs/promises";
import path from "path";

// Smart link that relies on Universal/App Links to open the Blueprint app
const url = "https://bp.link/go";
const outPath = path.resolve("Blueprint-QR.png");

async function generate() {
  try {
    const data = await QRCode.toBuffer(url, { width: 512 });
    await writeFile(outPath, data);
    console.log(`QR code created at ${outPath}`);
  } catch (err) {
    console.error("Failed to generate QR code", err);
  }
}

generate();
