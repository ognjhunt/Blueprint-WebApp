# Thumbnail Matching & Upload Guide

This guide walks you through automatically matching your generated thumbnails to the correct cards and uploading them.

## Step 1: Install Dependencies

```bash
npm install @anthropic-ai/sdk tsx
```

## Step 2: Set Up Your API Key

Get your Anthropic API key from https://console.anthropic.com/ and set it:

```bash
export ANTHROPIC_API_KEY="your-api-key-here"
```

## Step 3: Run the Matching Script

```bash
# If images are in ~/Downloads
npx tsx scripts/match-thumbnails.ts

# Or specify a custom directory
npx tsx scripts/match-thumbnails.ts /path/to/your/images
```

This will:
- Scan all PNG/JPG images in the directory
- Use Claude's vision API to analyze each image
- Match it to the correct card based on visual content
- Generate `image-matches.json` with the results

## Step 4: Review the Matches

Check `image-matches.json` to verify the matches look correct. Each entry shows:
- Which image file matched which card
- Confidence level (high/medium/low)
- Reasoning for the match

## Step 5: Upload Images

You have several options:

### Option A: Upload to Cloudflare R2 (Recommended - Free)

1. Create an R2 bucket at https://dash.cloudflare.com/
2. Upload all matched images to your bucket
3. Make the bucket public
4. Update the URLs in the next step

### Option B: Upload to AWS S3

1. Create an S3 bucket
2. Upload images and make them public
3. Use the S3 URLs

### Option C: Use the Project's Public Folder (For Testing)

```bash
# Copy matched images to public folder
npx tsx scripts/copy-thumbnails.ts
```

## Step 6: Update content.ts with New URLs

Once images are uploaded, run:

```bash
npx tsx scripts/update-content-images.ts https://your-cdn-url.com/thumbnails/
```

This will automatically update all the image URLs in `client/src/data/content.ts` based on your matches.

## Troubleshooting

**"No images found"**: Make sure your images are in the correct directory and are PNG/JPG format

**"Card ID not found"**: The AI might have returned an incorrect ID. Check the confidence level - low confidence matches may need manual review

**Rate limiting**: The script includes 1-second delays between API calls to avoid rate limits

## Manual Override

If you need to manually adjust a match, edit `image-matches.json` before running the update script:

```json
{
  "imagePath": "/path/to/image.png",
  "cardId": "correct-card-id",
  "cardTitle": "Correct Card Title",
  "confidence": "manual",
  "reasoning": "Manually corrected"
}
```
