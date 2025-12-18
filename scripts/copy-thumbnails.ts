#!/usr/bin/env tsx
/**
 * Copy matched thumbnails to public folder
 */

import fs from 'fs';
import path from 'path';

interface Match {
  imagePath: string;
  cardId: string;
  cardTitle: string;
  confidence: string;
  reasoning: string;
}

async function main() {
  const matchesPath = path.join(process.cwd(), 'image-matches.json');

  if (!fs.existsSync(matchesPath)) {
    console.error('Error: image-matches.json not found. Run match-thumbnails.ts first.');
    process.exit(1);
  }

  const matches: Match[] = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));

  // Create thumbnails directory in public folder
  const publicDir = path.join(process.cwd(), 'client', 'public', 'thumbnails');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log(`\n📁 Copying ${matches.length} thumbnails to public folder...\n`);

  let copied = 0;
  for (const match of matches) {
    const ext = path.extname(match.imagePath);
    const newFileName = `${match.cardId}${ext}`;
    const destPath = path.join(publicDir, newFileName);

    try {
      fs.copyFileSync(match.imagePath, destPath);
      console.log(`✓ ${newFileName}`);
      copied++;
    } catch (error) {
      console.error(`✗ Failed to copy ${match.imagePath}:`, error);
    }
  }

  console.log(`\n✅ Copied ${copied}/${matches.length} images to client/public/thumbnails/\n`);

  // Generate URL mapping file
  const urlMapping = matches.reduce((acc, match) => {
    const ext = path.extname(match.imagePath);
    acc[match.cardId] = `/thumbnails/${match.cardId}${ext}`;
    return acc;
  }, {} as Record<string, string>);

  const mappingPath = path.join(process.cwd(), 'thumbnail-urls.json');
  fs.writeFileSync(mappingPath, JSON.stringify(urlMapping, null, 2));

  console.log(`📝 URL mapping saved to: thumbnail-urls.json\n`);
}

main();
