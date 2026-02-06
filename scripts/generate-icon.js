#!/usr/bin/env node

/**
 * Jot Icon Generator
 *
 * Generates desktop icons with Apple Liquid Glass-inspired design:
 * - Gradient background with depth
 * - Specular highlights (top edge glow)
 * - Subtle shadows for text depth
 * - Glass-like overlay effect
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
  // Base terracotta colors for gradient (subtle)
  gradientTop: "#CC6045",      // Slightly lighter terracotta (top)
  gradientBottom: "#C05839",   // Base terracotta (bottom)

  // Highlight color (specular)
  highlightColor: "rgba(255, 255, 255, 0.25)",

  // Text colors
  textColor: "#FFFFFF",        // White
  textShadowColor: "rgba(0, 0, 0, 0.4)",

  // Glass overlay
  glassOverlayTop: "rgba(255, 255, 255, 0.15)",
  glassOverlayBottom: "rgba(255, 255, 255, 0.02)",

  // Corner radius as percentage of size
  cornerRadiusPercent: 22,     // Slightly more rounded for modern look

  // Font settings
  fontFamily: "Newsreader",
  fontWeight: 700,

  // Font size as percentage of icon size
  fontSizePercent: 55,

  // Output directory
  outputDir: "src-tauri/icons",

  // Font file path (bold italic version for "jot" logo)
  fontPath: join(__dirname, "fonts/Newsreader-700-Italic.ttf"),
};

// macOS icon sizes (Liquid Glass style)
const MACOS_ICON_SIZES = {
  "icon.png": 512,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "32x32.png": 32,
};

// Windows icon sizes (flat style)
const WINDOWS_ICON_SIZES = {
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
 * Draw a rounded rectangle path
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
 * Generate flat icon at specified size (for Windows)
 */
function generateFlatIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const cornerRadius = Math.round(size * (CONFIG.cornerRadiusPercent / 100));
  const fontSize = Math.round(size * (CONFIG.fontSizePercent / 100));

  // Solid terracotta background (midpoint of gradient)
  ctx.fillStyle = "#C05839";
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.fill();

  // Text
  ctx.font = `${CONFIG.fontWeight} ${fontSize}px "${CONFIG.fontFamily}"`;

  // Measure actual visual bounds for perfect centering
  const metrics = ctx.measureText("jot");
  const textWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  const x = (size - textWidth) / 2 + metrics.actualBoundingBoxLeft;
  const y = (size - textHeight) / 2 + metrics.actualBoundingBoxAscent;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CONFIG.textColor;
  ctx.fillText("jot", x, y);

  return canvas;
}

/**
 * Generate icon at specified size with Liquid Glass effects (for macOS)
 */
function generateLiquidGlassIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const cornerRadius = Math.round(size * (CONFIG.cornerRadiusPercent / 100));
  const fontSize = Math.round(size * (CONFIG.fontSizePercent / 100));

  // === LAYER 1: Base gradient background ===
  const bgGradient = ctx.createLinearGradient(0, 0, 0, size);
  bgGradient.addColorStop(0, CONFIG.gradientTop);
  bgGradient.addColorStop(1, CONFIG.gradientBottom);

  ctx.fillStyle = bgGradient;
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.fill();

  // === LAYER 2: Inner shadow (depth at edges) ===
  ctx.save();
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.clip();

  // Bottom/right inner shadow
  const innerShadowGradient = ctx.createLinearGradient(0, size * 0.7, 0, size);
  innerShadowGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  innerShadowGradient.addColorStop(1, "rgba(0, 0, 0, 0.15)");
  ctx.fillStyle = innerShadowGradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // === LAYER 3: Top specular highlight (light reflection) ===
  ctx.save();
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.clip();

  const highlightGradient = ctx.createLinearGradient(0, 0, 0, size * 0.5);
  highlightGradient.addColorStop(0, CONFIG.highlightColor);
  highlightGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.08)");
  highlightGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = highlightGradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // === LAYER 4: Glass overlay (subtle shine) ===
  ctx.save();
  roundRect(ctx, 0, 0, size, size, cornerRadius);
  ctx.clip();

  // Diagonal glass shine
  const glassGradient = ctx.createLinearGradient(0, 0, size, size * 0.6);
  glassGradient.addColorStop(0, CONFIG.glassOverlayTop);
  glassGradient.addColorStop(0.4, "rgba(255, 255, 255, 0.05)");
  glassGradient.addColorStop(1, CONFIG.glassOverlayBottom);
  ctx.fillStyle = glassGradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  // === LAYER 5: Inner border highlight (edge definition) ===
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = Math.max(1, size * 0.004);
  roundRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth, cornerRadius - ctx.lineWidth / 2);
  ctx.stroke();
  ctx.restore();

  // === LAYER 6: Text with shadow ===
  ctx.font = `${CONFIG.fontWeight} ${fontSize}px "${CONFIG.fontFamily}"`;

  // Measure actual visual bounds for perfect centering
  const metrics = ctx.measureText("jot");
  const textWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

  // Calculate position to center the actual visual bounds
  const x = (size - textWidth) / 2 + metrics.actualBoundingBoxLeft;
  const y = (size - textHeight) / 2 + metrics.actualBoundingBoxAscent;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Text shadow (subtle depth)
  const shadowOffset = Math.max(1, size * 0.006);
  const shadowBlur = Math.max(2, size * 0.015);
  ctx.save();
  ctx.shadowColor = CONFIG.textShadowColor;
  ctx.shadowOffsetX = shadowOffset;
  ctx.shadowOffsetY = shadowOffset;
  ctx.shadowBlur = shadowBlur;
  ctx.fillStyle = CONFIG.textColor;
  ctx.fillText("jot", x, y);
  ctx.restore();

  // Main text (on top of shadow)
  ctx.fillStyle = CONFIG.textColor;
  ctx.fillText("jot", x, y);

  // === LAYER 7: Text inner highlight (subtle top edge glow) ===
  // This creates a very subtle lighter edge on the text
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const textHighlight = ctx.createLinearGradient(0, y - textHeight, 0, y);
  textHighlight.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  textHighlight.addColorStop(0.3, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = textHighlight;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  return canvas;
}

/**
 * Generate PNG buffer from canvas
 */
async function generatePNG(size, outputPath, useLiquidGlass = true) {
  const canvas = useLiquidGlass ? generateLiquidGlassIcon(size) : generateFlatIcon(size);
  const buffer = canvas.toBuffer("image/png");
  await writeFile(outputPath, buffer);
  const style = useLiquidGlass ? "Liquid Glass" : "Flat";
  console.log(`  ✓ Generated ${outputPath} (${size}x${size}, ${style})`);
}

/**
 * Generate ICO file for Windows (flat style)
 */
async function generateICO(outputPath) {
  const sizes = [16, 32, 48, 256];
  const images = [];

  for (const size of sizes) {
    const canvas = generateFlatIcon(size);
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
    const canvas = generateLiquidGlassIcon(size);
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
  console.log("\n🎨 Jot Icon Generator (Liquid Glass Edition)\n");
  console.log("  Style: Apple Liquid Glass-inspired");
  console.log(`  Gradient: ${CONFIG.gradientTop} → ${CONFIG.gradientBottom}`);
  console.log(`  Text: "jot" in Newsreader 700 Italic\n`);

  // Register font
  console.log("Loading Newsreader font...");
  GlobalFonts.registerFromPath(CONFIG.fontPath, "Newsreader");
  console.log("  ✓ Font registered\n");

  const outputDir = join(process.cwd(), CONFIG.outputDir);
  await mkdir(outputDir, { recursive: true });

  console.log("Generating macOS icons (Liquid Glass)...\n");

  for (const [filename, size] of Object.entries(MACOS_ICON_SIZES)) {
    const outputPath = join(outputDir, filename);
    await generatePNG(size, outputPath, true);
  }

  console.log("\nGenerating Windows icons (Flat)...\n");

  for (const [filename, size] of Object.entries(WINDOWS_ICON_SIZES)) {
    const outputPath = join(outputDir, filename);
    await generatePNG(size, outputPath, false);
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
