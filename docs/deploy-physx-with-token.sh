#!/bin/bash
# Deploy physx-service with Hugging Face authentication
# Run this in Google Cloud Shell

set -e  # Exit on error

echo "============================================"
echo "PhysX Service Deployment with HF Token"
echo "============================================"
echo ""

# Configuration
PHYSX_SERVICE_DIR="/home/nijelhunt1999/BlueprintPipeline/physx-service"
PROJECT_ID="blueprint-8c1ca"
REGION="us-central1"
SERVICE_NAME="physx-service"

# Check if HF_TOKEN is set
if [ -z "$HF_TOKEN" ]; then
    echo "ERROR: HF_TOKEN environment variable is not set!"
    echo ""
    echo "Please set your Hugging Face token:"
    echo "  export HF_TOKEN='hf_your_token_here'"
    echo ""
    echo "Get your token from: https://huggingface.co/settings/tokens"
    exit 1
fi

echo "✓ HF_TOKEN is set"
echo ""

# Check if directory exists
if [ ! -d "$PHYSX_SERVICE_DIR" ]; then
    echo "ERROR: Directory not found: $PHYSX_SERVICE_DIR"
    exit 1
fi

echo "✓ Found physx-service directory"
echo ""

cd "$PHYSX_SERVICE_DIR"

# Backup original Dockerfile
if [ ! -f "Dockerfile.backup" ]; then
    echo "Creating backup: Dockerfile.backup"
    cp Dockerfile Dockerfile.backup
fi

# Check if Dockerfile has HF_TOKEN support
if grep -q "ARG HF_TOKEN" Dockerfile; then
    echo "✓ Dockerfile already has HF_TOKEN support"
else
    echo "⚠ WARNING: Dockerfile doesn't have HF_TOKEN support yet!"
    echo "Please apply the changes from: docs/dockerfile.patch"
    echo ""
    read -p "Have you updated the Dockerfile? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please update Dockerfile first."
        exit 1
    fi
fi

echo ""
echo "============================================"
echo "Starting Cloud Build"
echo "============================================"
echo ""

# Check if cloudbuild.yaml exists
if [ -f "cloudbuild.yaml" ]; then
    echo "Using cloudbuild.yaml"
    BUILD_CMD="gcloud builds submit \
      --config cloudbuild.yaml \
      --substitutions _HF_TOKEN=\"$HF_TOKEN\" \
      --timeout=2h \
      --project=$PROJECT_ID"
else
    echo "No cloudbuild.yaml found, using direct docker build"
    BUILD_CMD="gcloud builds submit \
      --tag gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
      --timeout=2h \
      --build-arg HF_TOKEN=\"$HF_TOKEN\" \
      --project=$PROJECT_ID"
fi

echo "Build command: $BUILD_CMD"
echo ""
read -p "Start build? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled."
    exit 0
fi

# Run the build
echo "Starting build (this may take 1-2 hours)..."
eval $BUILD_CMD

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✓ Build succeeded!"
    echo "============================================"
    echo ""

    # If cloudbuild.yaml deploys automatically, we're done
    if [ -f "cloudbuild.yaml" ] && grep -q "gcloud run deploy" cloudbuild.yaml; then
        echo "Service deployed automatically via cloudbuild.yaml"
    else
        echo "Deploying to Cloud Run..."
        gcloud run deploy $SERVICE_NAME \
          --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
          --region $REGION \
          --platform managed \
          --memory 16Gi \
          --cpu 4 \
          --timeout 3600 \
          --max-instances 10 \
          --allow-unauthenticated \
          --project=$PROJECT_ID
    fi

    echo ""
    echo "============================================"
    echo "✓ Deployment complete!"
    echo "============================================"
    echo ""

    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
      --region $REGION \
      --project=$PROJECT_ID \
      --format='value(status.url)')

    echo "Service URL: $SERVICE_URL"
    echo ""
    echo "Testing health endpoint..."
    sleep 5

    curl -s "$SERVICE_URL/health" | jq . || echo "Health check response received"

    echo ""
    echo "Check logs with:"
    echo "  gcloud run services logs read $SERVICE_NAME --region $REGION --limit 50"

else
    echo ""
    echo "============================================"
    echo "✗ Build failed!"
    echo "============================================"
    echo ""
    echo "Check logs with:"
    echo "  gcloud builds list --limit 1"
    echo "  gcloud builds log <BUILD_ID>"
    exit 1
fi
