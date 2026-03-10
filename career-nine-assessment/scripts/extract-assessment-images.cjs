#!/usr/bin/env node
/**
 * Extracts base64-encoded images from assessment JSON files and saves them
 * as separate WebP files. Replaces the base64 strings with URL paths.
 *
 * Usage: node scripts/extract-assessment-images.js <assessment-cache-dir>
 * Example: node scripts/extract-assessment-images.js public/assessment-cache/5
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  // sharp not available - save as PNG instead
  sharp = null;
}

const cacheDir = process.argv[2];
if (!cacheDir) {
  console.error('Usage: node extract-assessment-images.js <assessment-cache-dir>');
  process.exit(1);
}

const assessmentId = path.basename(cacheDir);
const imagesDir = path.join(cacheDir, 'images');

// Walk any object tree looking for optionImageBase64 fields
function findOptions(obj) {
  const results = [];
  if (!obj || typeof obj !== 'object') return results;
  if (Array.isArray(obj)) {
    for (const item of obj) results.push(...findOptions(item));
    return results;
  }
  if (obj.optionImageBase64) results.push(obj);
  for (const val of Object.values(obj)) {
    if (typeof val === 'object') results.push(...findOptions(val));
  }
  return results;
}

async function processFile(jsonFile) {
  if (!fs.existsSync(jsonFile)) return 0;
  const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const options = findOptions(data);
  let extractedCount = 0;
  let savedBytes = 0;

  for (const option of options) {
    if (!option.optionImageBase64 || option.optionImageBase64.trim() === '') continue;
    // Skip if already extracted (URL path instead of base64)
    if (option.optionImageBase64.startsWith('/')) continue;

    const optionId = option.optionId;
    const base64Str = option.optionImageBase64.replace(/^data:image\/\w+;base64,/, '');
    const pngBuffer = Buffer.from(base64Str, 'base64');
    const originalSize = option.optionImageBase64.length;

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    let ext, outputBuffer;
    if (sharp) {
      outputBuffer = await sharp(pngBuffer).webp({ quality: 80 }).toBuffer();
      ext = 'webp';
    } else {
      outputBuffer = pngBuffer;
      ext = 'png';
    }

    const filename = `${optionId}.${ext}`;
    const filePath = path.join(imagesDir, filename);
    // Only write if not already extracted by data.json pass
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, outputBuffer);
    }

    option.optionImageBase64 = `/assessment-cache/${assessmentId}/images/${filename}`;
    savedBytes += originalSize - option.optionImageBase64.length;
    extractedCount++;
  }

  if (extractedCount > 0) {
    fs.writeFileSync(jsonFile, JSON.stringify(data));
  }
  return extractedCount;
}

async function extractImages() {
  const dataCount = await processFile(path.join(cacheDir, 'data.json'));
  const configCount = await processFile(path.join(cacheDir, 'config.json'));
  const total = dataCount + configCount;

  if (total > 0) {
    console.log(`  ✓ Extracted images from assessment ${assessmentId} (data: ${dataCount}, config: ${configCount})`);
  } else {
    console.log(`  - No embedded images in assessment ${assessmentId}`);
  }
}

extractImages().catch(err => {
  console.error(`  ✗ Failed to extract images for assessment ${assessmentId}:`, err.message);
  process.exit(1);
});
