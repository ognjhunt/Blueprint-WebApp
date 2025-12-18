#!/bin/bash

# Thumbnail Matching & Upload Workflow
# Complete automation for matching and deploying thumbnails

set -e

echo "🎨 Blueprint Thumbnail Matching & Upload Workflow"
echo "================================================="
echo ""

# Check for API key
if [ -z "$GOOGLE_API_KEY" ]; then
    echo "❌ Error: GOOGLE_API_KEY environment variable not set"
    echo ""
    echo "Get your FREE API key from: https://aistudio.google.com/app/apikey"
    echo "Then run: export GOOGLE_API_KEY='your-key-here'"
    exit 1
fi

# Get images directory
IMAGES_DIR="${1:-$HOME/Downloads}"

if [ ! -d "$IMAGES_DIR" ]; then
    echo "❌ Error: Directory $IMAGES_DIR does not exist"
    exit 1
fi

echo "📂 Images directory: $IMAGES_DIR"
echo ""

# Step 1: Match images to cards
echo "Step 1/3: Matching images to cards..."
echo "======================================"
npx tsx scripts/match-thumbnails.ts "$IMAGES_DIR"

if [ ! -f "image-matches.json" ]; then
    echo "❌ Error: Matching failed - image-matches.json not created"
    exit 1
fi

echo ""
read -p "👀 Review image-matches.json. Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopped. Edit image-matches.json if needed, then re-run."
    exit 0
fi

# Step 2: Copy images to public folder
echo ""
echo "Step 2/3: Copying images to public folder..."
echo "============================================="
npx tsx scripts/copy-thumbnails.ts

# Step 3: Update content.ts
echo ""
echo "Step 3/3: Updating content.ts..."
echo "================================"

# Ask for deployment type
echo ""
echo "Where will you host these images?"
echo "1) Local (use /thumbnails/ - for testing)"
echo "2) CDN/Cloud (enter full URL)"
echo ""
read -p "Choose option (1 or 2): " -n 1 -r
echo ""

if [[ $REPLY == "2" ]]; then
    echo ""
    read -p "Enter base URL (e.g., https://cdn.example.com/thumbnails/): " BASE_URL
    npx tsx scripts/update-content-images.ts "$BASE_URL"
else
    npx tsx scripts/update-content-images.ts "/thumbnails/"
fi

echo ""
echo "✅ COMPLETE!"
echo ""
echo "Next steps:"
echo "==========="
echo "1. Review changes in client/src/data/content.ts"
echo "2. Test locally: npm run dev"
if [[ $REPLY == "2" ]]; then
    echo "3. Upload images from client/public/thumbnails/ to your CDN"
    echo "4. Commit and deploy!"
else
    echo "3. Commit and deploy!"
fi
echo ""
