/**
 * Generate macOS .icns from existing Windows .ico (CI-friendly).
 *
 * Approach:
 * 1) Extract the largest PNG image from the .ico and save as assets/icon.png
 * 2) On macOS, generate an .iconset via `sips`, then build .icns via `iconutil`
 *
 * Usage:
 *   node scripts/generate-icns-from-ico.js assets/icon.ico assets/icon.icns assets/icon.png
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

async function main() {
  const inputIco = process.argv[2] || "assets/icon.ico";
  const outputIcns = process.argv[3] || "assets/icon.icns";
  const outputPng = process.argv[4] || "assets/icon.png";

  if (!fs.existsSync(inputIco)) {
    console.error(`Input .ico not found: ${inputIco}`);
    process.exit(1);
  }

  const icoToPng = require("ico-to-png");

  const icoBuf = fs.readFileSync(inputIco);
  const pngBuffers = await icoToPng(icoBuf);
  if (!pngBuffers || pngBuffers.length === 0) {
    console.error("No PNG images could be extracted from the .ico file.");
    process.exit(1);
  }

  // Pick the largest PNG buffer (usually highest resolution).
  let best = pngBuffers[0];
  for (const b of pngBuffers) if (b.length > best.length) best = b;

  fs.mkdirSync(path.dirname(outputPng), { recursive: true });
  fs.writeFileSync(outputPng, best);
  console.log(`Generated PNG: ${outputPng}`);

  if (process.platform !== "darwin") {
    console.log("Not macOS: skipping .icns generation (requires sips/iconutil).");
    return;
  }

  // Build .iconset folder
  const iconsetDir = fs.mkdtempSync(path.join(os.tmpdir(), "icon.iconset-"));
  const sizes = [16, 32, 64, 128, 256, 512];

  // iconutil expects specific filenames
  // icon_16x16.png, icon_16x16@2x.png, ... icon_512x512.png, icon_512x512@2x.png
  for (const size of sizes) {
    const out1x = path.join(iconsetDir, `icon_${size}x${size}.png`);
    const out2x = path.join(iconsetDir, `icon_${size}x${size}@2x.png`);

    execFileSync("sips", ["-z", String(size), String(size), outputPng, "--out", out1x], {
      stdio: "inherit",
    });
    execFileSync("sips", ["-z", String(size * 2), String(size * 2), outputPng, "--out", out2x], {
      stdio: "inherit",
    });
  }

  fs.mkdirSync(path.dirname(outputIcns), { recursive: true });
  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", outputIcns], { stdio: "inherit" });
  console.log(`Generated ICNS: ${outputIcns}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

