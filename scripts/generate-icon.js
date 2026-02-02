#!/usr/bin/env node

/**
 * Jot Icon Generator
 *
 * Generates desktop icons with:
 * - Terracotta background
 * - Rounded edges
 * - "Jot" text in Crimson Pro
 *
 * Usage: bun run scripts/generate-icon.js
 */

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
  // Terracotta color
  backgroundColor: "#C45B35",

  // Text color - black
  textColor: "#000000",

  // Corner radius as percentage of size
  cornerRadiusPercent: 18,

  // Font settings
  fontFamily: "Crimson Pro",
  fontWeight: 600,

  // Font size as percentage of icon size
  fontSizePercent: 70,

  // Output directory
  outputDir: "src-tauri/icons",

  // Font file path
  fontPath: join(__dirname, "fonts/CrimsonPro-600.ttf"),
};

// Required icon sizes for Tauri
const ICON_SIZES = {
  // macOS
  "icon.png": 512,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "32x32.png": 32,

  // Windows Store logos
  "StoreLogo.png": 50,
  "Square30x30Logo.png": 30,
  "Square44x44Logo.png": 44,
  "Square71x71Logo.png": 71,
  "Square89x89Logo.png": 89,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square150x150Logo.png": 150,
  "Square284x284Logo.png": 284,
  "Square310x310Logo.png": 310,
};

/**
 * Draw a rounded rectangle
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Generate icon at specified size
 */
function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const cornerRadius = Math.round(size * (CONFIG.cornerRadiusPercent / 100));
  const fontSize = Math.round(size * (CONFIG.fontSizePercent / 100));

  // Draw rounded rectangle background
  ctx.fillStyle = CONFIG.backgroundColor;
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.fill();

  // Draw text - use actual bounding box for true centering
  ctx.fillStyle = CONFIG.textColor;
  ctx.font = `${CONFIG.fontWeight} ${fontSize}px "${CONFIG.fontFamily}"`;

  // Measure actual visual bounds
  const metrics = ctx.measureText("Jot");
  const textWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  // Calculate position to center the actual visual bounds
  const x = (size - textWidth) / 2 + metrics.actualBoundingBoxLeft;
  const y = (size - textHeight) / 2 + metrics.actualBoundingBoxAscent;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Jot", x, y);

  return canvas;
}

/**
 * Generate PNG buffer from canvas
 */
async function generatePNG(size, outputPath) {
  const canvas = generateIcon(size);
  const buffer = canvas.toBuffer("image/png");
  await writeFile(outputPath, buffer);
  console.log(`  ✓ Generated ${outputPath} (${size}x${size})`);
}

/**
 * Generate ICO file for Windows
 */
async function generateICO(outputPath) {
  const sizes = [16, 32, 48, 256];
  const images = [];

  for (const size of sizes) {
    const canvas = generateIcon(size);
    const png = canvas.toBuffer("image/png");
    images.push({ size, png });
  }

  const ico = createICO(images);
  await writeFile(outputPath, ico);
  console.log(`  ✓ Generated ${outputPath} (ICO with ${sizes.join(", ")}px)`);
}

/**
 * Create ICO file buffer from PNG images
 */
function createICO(images) {
  const numImages = images.length;
  const headerSize = 6 + numImages * 16;

  let offset = headerSize;
  const offsets = [];
  for (const img of images) {
    offsets.push(offset);
    offset += img.png.length;
  }

  const buffer = Buffer.alloc(offset);
  let pos = 0;

  // ICO header
  buffer.writeUInt16LE(0, pos); pos += 2;
  buffer.writeUInt16LE(1, pos); pos += 2;
  buffer.writeUInt16LE(numImages, pos); pos += 2;

  // Image directory entries
  for (let i = 0; i < numImages; i++) {
    const img = images[i];
    const size = img.size === 256 ? 0 : img.size;

    buffer.writeUInt8(size, pos); pos += 1;
    buffer.writeUInt8(size, pos); pos += 1;
    buffer.writeUInt8(0, pos); pos += 1;
    buffer.writeUInt8(0, pos); pos += 1;
    buffer.writeUInt16LE(1, pos); pos += 2;
    buffer.writeUInt16LE(32, pos); pos += 2;
    buffer.writeUInt32LE(img.png.length, pos); pos += 4;
    buffer.writeUInt32LE(offsets[i], pos); pos += 4;
  }

  // Image data
  for (const img of images) {
    img.png.copy(buffer, pos);
    pos += img.png.length;
  }

  return buffer;
}

/**
 * Generate ICNS for macOS using iconutil
 */
async function generateICNS(outputDir) {
  const iconsetDir = join(outputDir, "icon.iconset");
  await mkdir(iconsetDir, { recursive: true });

  const iconsetSizes = [
    { name: "icon_16x16.png", size: 16 },
    { name: "icon_16x16@2x.png", size: 32 },
    { name: "icon_32x32.png", size: 32 },
    { name: "icon_32x32@2x.png", size: 64 },
    { name: "icon_128x128.png", size: 128 },
    { name: "icon_128x128@2x.png", size: 256 },
    { name: "icon_256x256.png", size: 256 },
    { name: "icon_256x256@2x.png", size: 512 },
    { name: "icon_512x512.png", size: 512 },
    { name: "icon_512x512@2x.png", size: 1024 },
  ];

  for (const { name, size } of iconsetSizes) {
    const canvas = generateIcon(size);
    const buffer = canvas.toBuffer("image/png");
    await writeFile(join(iconsetDir, name), buffer);
  }

  console.log(`  ✓ Generated iconset at ${iconsetDir}`);

  // Run iconutil to create .icns
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    await execAsync(`iconutil -c icns "${iconsetDir}" -o "${join(outputDir, "icon.icns")}"`);
    console.log(`  ✓ Generated ${join(outputDir, "icon.icns")}`);

    const { rm } = await import("fs/promises");
    await rm(iconsetDir, { recursive: true });
  } catch (err) {
    console.log(`  ⚠ iconutil not available, iconset left at ${iconsetDir}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log("\n🎨 Jot Icon Generator\n");
  console.log(`  Background: ${CONFIG.backgroundColor} (Terracotta)`);
  console.log(`  Text: "Jot" in Crimson Pro 600 (${CONFIG.textColor})\n`);

  // Register font
  console.log("Loading Crimson Pro font...");
  GlobalFonts.registerFromPath(CONFIG.fontPath, "Crimson Pro");
  console.log(`  ✓ Registered font: ${GlobalFonts.families}\n`);

  const outputDir = join(process.cwd(), CONFIG.outputDir);
  await mkdir(outputDir, { recursive: true });

  console.log("Generating PNG icons...\n");

  for (const [filename, size] of Object.entries(ICON_SIZES)) {
    const outputPath = join(outputDir, filename);
    await generatePNG(size, outputPath);
  }

  console.log("\nGenerating platform-specific icons...\n");

  await generateICO(join(outputDir, "icon.ico"));
  await generateICNS(outputDir);

  console.log("\n✅ Icon generation complete!\n");
}

main().catch((err) => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
