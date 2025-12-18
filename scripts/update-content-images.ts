#!/usr/bin/env tsx
/**
 * Update content.ts with new thumbnail URLs
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
  const baseUrl = process.argv[2] || '/thumbnails/';

  console.log(`\n🔧 Updating content.ts with base URL: ${baseUrl}\n`);

  const matchesPath = path.join(process.cwd(), 'image-matches.json');

  if (!fs.existsSync(matchesPath)) {
    console.error('Error: image-matches.json not found. Run match-thumbnails.ts first.');
    process.exit(1);
  }

  const matches: Match[] = JSON.parse(fs.readFileSync(matchesPath, 'utf-8'));

  // Create URL mapping
  const urlMap = new Map<string, string>();
  matches.forEach(match => {
    const ext = path.extname(match.imagePath);
    const url = `${baseUrl}${match.cardId}${ext}`;
    urlMap.set(match.cardId, url);
  });

  // Read content.ts
  const contentPath = path.join(process.cwd(), 'client', 'src', 'data', 'content.ts');
  let content = fs.readFileSync(contentPath, 'utf-8');

  let updatedCount = 0;

  // Update each matched card
  urlMap.forEach((newUrl, cardId) => {
    // Try different property names that might contain images
    const imageProps = ['heroImage', 'thumbnail', 'thumb'];

    imageProps.forEach(prop => {
      // Match the slug and update the image property
      // Pattern: slug: "card-id"  followed by  heroImage: "old-url"
      const slugPattern = new RegExp(
        `slug:\\s*["']${cardId}["'][\\s\\S]*?${prop}:\\s*["'][^"']*["']`,
        'g'
      );

      const matches = content.match(slugPattern);
      if (matches) {
        matches.forEach(match => {
          const updated = match.replace(
            new RegExp(`(${prop}:\\s*["'])[^"']*["']`),
            `$1${newUrl}"`
          );
          content = content.replace(match, updated);
          updatedCount++;
        });
      }
    });
  });

  // Write updated content
  fs.writeFileSync(contentPath, content);

  console.log(`✅ Updated ${updatedCount} image URLs in content.ts\n`);

  // Print what was updated
  console.log('UPDATED CARDS:');
  console.log('==============');
  urlMap.forEach((url, cardId) => {
    console.log(`${cardId} → ${url}`);
  });

  console.log(`\n💡 Tip: Review client/src/data/content.ts to verify changes\n`);
}

main();
