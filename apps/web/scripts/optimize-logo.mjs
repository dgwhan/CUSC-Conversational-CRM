#!/usr/bin/env node
/**
 * Logo optimization script.
 * Resizes CUSC-Logo.png (1922x945) to 400px wide and outputs:
 *   - CUSC-Logo.webp (WebP, quality 80) ~5-8 KB
 *   - CUSC-Logo@2x.png (PNG, 400px wide) as fallback
 *
 * Run: node scripts/optimize-logo.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import { statSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.resolve(__dirname, '../src/assets/logo/CUSC-Logo.png');
const WEBP_1X = path.resolve(__dirname, '../src/assets/logo/CUSC-Logo-1x.webp');
const WEBP_2X = path.resolve(__dirname, '../src/assets/logo/CUSC-Logo.webp');
const PNG_1X = path.resolve(__dirname, '../src/assets/logo/CUSC-Logo-1x.png');
const PNG_2X = path.resolve(__dirname, '../src/assets/logo/CUSC-Logo@2x.png');

async function optimize() {
  const input = sharp(INPUT);
  const meta = await input.metadata();
  console.log(`Input: ${meta.width}x${meta.height} px, ${(statSync(INPUT).size / 1024).toFixed(1)} KB`);

  // WebP 1x (for 1x screens and Lighthouse mobile/desktop emulation)
  await sharp(INPUT)
    .resize(200, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toFile(WEBP_1X);
  console.log(`WebP 1x: ${(statSync(WEBP_1X).size / 1024).toFixed(1)} KB -> ${WEBP_1X}`);

  // WebP 2x (for retina screens)
  await sharp(INPUT)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toFile(WEBP_2X);
  console.log(`WebP 2x: ${(statSync(WEBP_2X).size / 1024).toFixed(1)} KB -> ${WEBP_2X}`);

  // PNG 1x fallback
  await sharp(INPUT)
    .resize(200, null, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toFile(PNG_1X);
  console.log(`PNG 1x: ${(statSync(PNG_1X).size / 1024).toFixed(1)} KB -> ${PNG_1X}`);

  // PNG 2x fallback
  await sharp(INPUT)
    .resize(400, null, { fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: false })
    .toFile(PNG_2X);
  console.log(`PNG 2x: ${(statSync(PNG_2X).size / 1024).toFixed(1)} KB -> ${PNG_2X}`);
}

optimize().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
