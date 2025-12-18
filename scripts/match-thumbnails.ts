#!/usr/bin/env tsx
/**
 * Automated Thumbnail Matching Script
 * Uses Gemini 3 Flash AI vision to match downloaded images to card descriptions
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Card data from content.ts
const CARDS = [
  // Dataset Bundles
  { id: 'prep-line-essentials', title: 'Prep-Line Essentials', description: '150-scene bundle covering prep tables, dish pits, and service pass-throughs with drawer, door, and appliance articulation baked in.', type: 'dataset' },
  { id: 'retail-restock-loop', title: 'Retail Restock Loop', description: '110 grocery and convenience aisles with planogrammed shelving, refrigeration bays, and pallet drops for mixed-SKU restock policies.', type: 'dataset' },
  { id: 'warehouse-flow-kit', title: 'Warehouse Flow Kit', description: '200-lane dataset covering cross-dock staging, tote picking, and pallet buffers tuned for AMR and arm-on-rail deployments.', type: 'dataset' },
  { id: 'lab-procedures-pack', title: 'Lab Procedures Pack', description: '65 precision lab benches with gloveboxes, articulated enclosures, and sample handoff tooling for panel + insertion curricula.', type: 'dataset' },
  { id: 'utility-panel-tour', title: 'Utility Panel Tour', description: '90 mechanical rooms and utility closets with valves, breakers, and switches for inspection and panel interaction testing.', type: 'dataset' },
  { id: 'laundry-assist-starter', title: 'Laundry Assist Starter', description: '50 assistive home laundry alcoves with washers, dryers, and hampers for folding and transfer training.', type: 'dataset' },

  // Individual Scenes
  { id: 'commercial-dishroom-station', title: 'Commercial Dishroom Station', description: 'High-traffic dishwashing station with articulated rack loaders, spray nozzles, and drying shelves for manipulation training.', type: 'scene' },
  { id: 'grocery-refrigeration-bay', title: 'Grocery Refrigeration Bay', description: 'Walk-in refrigeration unit with articulated doors, stocked shelves, and temperature monitoring for retail restocking.', type: 'scene' },
  { id: 'warehouse-pallet-buffer', title: 'Warehouse Pallet Buffer Zone', description: 'Staging area with mixed pallet heights, wrapped goods, and forklift clearances for logistics training.', type: 'scene' },
  { id: 'precision-lab-glovebox', title: 'Precision Lab Glovebox', description: 'Sealed glovebox enclosure with articulated glove ports, pass-through chambers, and sample handling fixtures.', type: 'scene' },
  { id: 'service-corridor-panel', title: 'Service Corridor Control Panel', description: 'Wall-mounted electrical panel with breakers, switches, and status LEDs for inspection and control training.', type: 'scene' },
  { id: 'home-washer-dryer-stack', title: 'Home Washer-Dryer Stack', description: 'Residential laundry pair with articulated doors, control dials, and detergent dispensers for assistive robotics.', type: 'scene' },
  { id: 'prep-table-articulated', title: 'Prep Table with Articulated Storage', description: 'Commercial prep station featuring under-counter drawers, cutting boards, and utensil racks for kitchen manipulation.', type: 'scene' },
  { id: 'retail-checkout-counter', title: 'Retail Checkout Counter', description: 'Point-of-sale station with scanner, cash drawer, bagging area, and payment terminal for retail automation.', type: 'scene' },
  { id: 'cross-dock-staging-zone', title: 'Cross-Dock Staging Zone', description: 'Loading dock staging area with pallet positions, restraints, and clearance markers for logistics workflows.', type: 'scene' },
  { id: 'sample-prep-workbench', title: 'Sample Prep Workbench', description: 'Laboratory workbench with articulated equipment mounts, sample racks, and precision measurement tools.', type: 'scene' },
  { id: 'mechanical-room-valve-bank', title: 'Mechanical Room Valve Bank', description: 'Industrial valve cluster with pressure gauges, shut-off valves, and piping for inspection routines.', type: 'scene' },
  { id: 'folding-station-deluxe', title: 'Folding Station Deluxe', description: 'Dedicated folding table with hanging rod, sorted bins, and shelf organization for laundry automation.', type: 'scene' },
  { id: 'quick-serve-pass-window', title: 'Quick-Serve Pass Window', description: 'Kitchen service window with warming shelves, order displays, and condiment stations for food service automation.', type: 'scene' },
  { id: 'pharmacy-dispensing-unit', title: 'Pharmacy Dispensing Unit', description: 'Secure medication cabinet with lockable drawers, label printer, and counting tray for pharmaceutical automation.', type: 'scene' },
  { id: 'tote-picking-aisle', title: 'Tote Picking Aisle', description: 'Narrow warehouse aisle with tote racks, barcode scanners, and mobile robot clearances for order fulfillment.', type: 'scene' },
  { id: 'cleanroom-airlockstation', title: 'Cleanroom Airlock Station', description: 'Dual-door cleanroom entry with garment hooks, shoe covers, and air shower controls for contamination control.', type: 'scene' },
  { id: 'hvac-control-hub', title: 'HVAC Control Hub', description: 'Climate control panel with thermostats, damper controls, and airflow sensors for building automation.', type: 'scene' },
  { id: 'bedroom-closet-organizer', title: 'Bedroom Closet Organizer', description: 'Walk-in closet system with hanging rods, drawer units, and shoe racks for home organization automation.', type: 'scene' },

  // Portal Scenes
  { id: 'SCN-001', title: 'Tribeca Loft Kitchen', description: 'Model cabinet interiors with collision-safe shelving, add rig-ready hinges to all upper cabinets, populate countertop with randomized produce props, and author lighting rig for day + evening variations.', type: 'portal' },
  { id: 'SCN-002', title: 'SoMa Robotics Lab', description: 'Rebuild wiring bundles with accurate cable constraints, add labelled tool shadow boards with 12 unique props, and set up motion paths for dual-arm workcell calibration.', type: 'portal' },
  { id: 'SCN-003', title: 'Boulder Gear Shop', description: 'Retopo shelving for accurate shelf-edge detections, author cloth simulation presets for hanging jackets, and add POS counter training props (tablets, loyalty cards).', type: 'portal' },
  { id: 'SCN-004', title: 'Austin Smart Kitchen', description: 'Build inside geometry for ovens + smart fridge drawers, author ingredient library with 24 manipulable items, set up collision proxies for countertops and island, and bake lighting + reflection cubes for metal surfaces.', type: 'portal' },
  { id: 'SCN-005', title: 'Micro-Fulfillment Hub', description: 'Author modular pallet variants with LODs, rig conveyor belts for runtime speed adjustments, label bulk storage with barcode and QR assets, and light for overnight operations with baked GI.', type: 'portal' },
  { id: 'SCN-006', title: 'Med Prep Suite', description: 'Model interior storage for med cabinets with trays, create 8 dosage kit props with texture variations, place signage decals per sterile procedure policy, and simulate soft lighting for overnight nursing crew.', type: 'portal' },

  // Scene Recipes
  { id: 'grocery-endcap-reset', title: 'Grocery Endcap Reset', description: 'Planogrammed endcap with refrigeration, shelf facings, and clutter hooks for restock and facing policies.', type: 'recipe' },
  { id: 'warehouse-tote-pick-cell', title: 'Warehouse Tote Pick Cell', description: 'Racked tote lane with AMR clearances, staging pallets, and barcode signage tuned for pick-place curricula.', type: 'recipe' },
  { id: 'service-kitchen-pass', title: 'Service Kitchen Pass', description: 'Prep line with pass-through window, drawers, and articulated appliances for manipulation and access policies.', type: 'recipe' },
  { id: 'lab-bench-prep', title: 'Lab Bench Prep Suite', description: 'Wet lab bench with sample racks, glovebox enclosure, and pass-through for precision handling policies.', type: 'recipe' },
  { id: 'panel-service-closet', title: 'Panel Service Closet', description: 'Utility closet with wall-mounted panels, valves, and service clearances for inspection and controls policies.', type: 'recipe' },
  { id: 'laundry-folding-alcove', title: 'Laundry Folding Alcove', description: 'Home laundry nook with washer/dryer stack, hampers, and folding surface tuned for cloth handling policies.', type: 'recipe' },
];

interface Match {
  imagePath: string;
  cardId: string;
  cardTitle: string;
  confidence: string;
  reasoning: string;
}

async function analyzeImage(
  model: any,
  imagePath: string,
  imageBuffer: Buffer
): Promise<Match | null> {
  const cardsList = CARDS.map(
    (card, idx) => `${idx + 1}. ID: "${card.id}" | Title: "${card.title}" | Description: "${card.description}"`
  ).join('\n');

  const prompt = `You are analyzing a thumbnail image for a robotics simulation environment.

Your task: Identify which card this image best matches from the list below.

AVAILABLE CARDS:
${cardsList}

Look at the image and determine which card it represents based on:
- Visual elements (equipment, furniture, layout)
- Environment type (kitchen, warehouse, lab, retail, etc.)
- Specific features mentioned in descriptions

Respond in this EXACT JSON format:
{
  "cardId": "the-matching-card-id",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of why this image matches this card"
}`;

  try {
    // Convert buffer to base64 for Gemini
    const imageBase64 = imageBuffer.toString('base64');

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64,
        },
      },
      { text: prompt },
    ]);

    const response = await result.response;
    const responseText = response.text();

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`No JSON found in response for ${imagePath}`);
      return null;
    }

    const matchResult = JSON.parse(jsonMatch[0]);
    const card = CARDS.find(c => c.id === matchResult.cardId);

    if (!card) {
      console.error(`Card ID ${matchResult.cardId} not found`);
      return null;
    }

    return {
      imagePath,
      cardId: matchResult.cardId,
      cardTitle: card.title,
      confidence: matchResult.confidence,
      reasoning: matchResult.reasoning,
    };
  } catch (error) {
    console.error(`Error analyzing ${imagePath}:`, error);
    return null;
  }
}

async function main() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_API_KEY environment variable not set');
    console.error('Get your API key from: https://aistudio.google.com/app/apikey');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  // Get images directory from command line argument
  const imagesDir = process.argv[2] || path.join(process.env.HOME!, 'Downloads');

  if (!fs.existsSync(imagesDir)) {
    console.error(`Error: Directory ${imagesDir} does not exist`);
    process.exit(1);
  }

  console.log(`\n🔍 Scanning for images in: ${imagesDir}\n`);
  console.log(`Using Gemini 3 Flash (gemini-2.0-flash-exp)\n`);

  const files = fs.readdirSync(imagesDir)
    .filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'))
    .map(f => path.join(imagesDir, f));

  if (files.length === 0) {
    console.error('No image files found');
    process.exit(1);
  }

  console.log(`Found ${files.length} images\n`);

  const matches: Match[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[${i + 1}/${files.length}] Analyzing: ${path.basename(file)}`);

    const imageBuffer = fs.readFileSync(file);

    const match = await analyzeImage(model, file, imageBuffer);

    if (match) {
      matches.push(match);
      console.log(`  ✓ Matched to: ${match.cardTitle} (${match.confidence} confidence)`);
      console.log(`  → ${match.reasoning}\n`);
    } else {
      console.log(`  ✗ Could not match\n`);
    }

    // Rate limiting - wait 500ms between requests (Gemini is faster)
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Save results
  const outputPath = path.join(process.cwd(), 'image-matches.json');
  fs.writeFileSync(outputPath, JSON.stringify(matches, null, 2));

  console.log(`\n✅ Complete! Matched ${matches.length}/${files.length} images`);
  console.log(`Results saved to: ${outputPath}\n`);

  // Print summary
  console.log('SUMMARY:');
  console.log('========');
  matches.forEach(m => {
    console.log(`${path.basename(m.imagePath)} → ${m.cardTitle} (${m.confidence})`);
  });
}

main();
