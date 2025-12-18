# 🎨 Thumbnail Upload Quick Start

## TL;DR - One Command Solution

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-key-here"

# Run the automated workflow
./scripts/thumbnail-workflow.sh ~/Downloads
```

This will:
1. ✅ Use AI vision to match each image to the correct card
2. ✅ Copy images to the public folder
3. ✅ Update content.ts with the new URLs

---

## What You Need

1. **Your 36 thumbnail images** (in Downloads or any folder)
2. **Anthropic API key** (get free credits at https://console.anthropic.com/)
3. **5 minutes**

---

## Step-by-Step

### 1. Install Dependencies (First Time Only)

```bash
npm install @anthropic-ai/sdk tsx
```

### 2. Get Your API Key

- Go to https://console.anthropic.com/
- Sign up (you get free credits)
- Create an API key
- Copy it

### 3. Set the API Key

```bash
export ANTHROPIC_API_KEY="your-key-here"
```

### 4. Run the Workflow

```bash
# If images are in ~/Downloads
./scripts/thumbnail-workflow.sh

# Or specify where your images are
./scripts/thumbnail-workflow.sh /path/to/your/images
```

### 5. Follow the Prompts

The script will:
- Scan your images
- Use Claude Vision API to analyze each one
- Match it to the correct card (shows you reasoning)
- Ask you to review the matches
- Copy images to `client/public/thumbnails/`
- Update `client/src/data/content.ts`

### 6. Test It

```bash
npm run dev
```

Visit the Environments, Portal, and Scene Recipes pages to see your new thumbnails!

---

## Hosting Options

### Option 1: Local (For Testing) ✅ RECOMMENDED TO START

The script copies images to `client/public/thumbnails/` which means they'll be served from your app.

**Pros**: Works immediately, no extra setup
**Cons**: Increases deploy size

### Option 2: Upload to CDN (Production)

After running the workflow locally, upload the images from `client/public/thumbnails/` to:

**Cloudflare R2** (Free, Recommended)
- Create bucket: https://dash.cloudflare.com/
- Upload your 36 images
- Make bucket public
- Get the public URL (e.g., `https://pub-xxx.r2.dev/`)

**AWS S3**
- Create S3 bucket
- Upload images
- Make public
- Use S3 URL

Then re-run just the update script:
```bash
npx tsx scripts/update-content-images.ts https://your-cdn-url.com/thumbnails/
```

---

## Troubleshooting

**"No images found"**
→ Make sure you're pointing to the right directory and files are PNG/JPG

**"Card ID not found"**
→ The AI might have misidentified an image. Check `image-matches.json` and manually correct the `cardId` field, then re-run steps 2-3

**"Low confidence" matches**
→ Review those matches in `image-matches.json` - you can manually override them

**Rate limiting**
→ The script includes 1s delays between API calls. If you hit limits, wait a minute and re-run

---

## Manual Matching (If AI Gets It Wrong)

Edit `image-matches.json` before running the copy/update steps:

```json
{
  "imagePath": "/path/to/ChatGPT Image Dec 18, 2025, 11_31_24 AM.png",
  "cardId": "prep-line-essentials",
  "cardTitle": "Prep-Line Essentials",
  "confidence": "manual",
  "reasoning": "Manually corrected"
}
```

Then re-run:
```bash
npx tsx scripts/copy-thumbnails.ts
npx tsx scripts/update-content-images.ts
```

---

## What Gets Updated

The scripts update these properties in `client/src/data/content.ts`:
- `heroImage` (for datasets and recipes)
- `thumbnail` (for marketplace scenes)

All 36 cards across:
- 6 Dataset Bundles (Environments page)
- 18 Individual Scenes (Environments page)
- 6 Portal Scenes (Portal page)
- 6 Scene Recipes (Recipes page)

---

## Questions?

Check the detailed docs: `scripts/README-thumbnails.md`

Or the individual scripts:
- `scripts/match-thumbnails.ts` - AI matching
- `scripts/copy-thumbnails.ts` - Copy to public folder
- `scripts/update-content-images.ts` - Update content.ts
