# PhysX Service - Hugging Face Authentication Fix

## Problem
The physx-service fails to download the `Caoza/PhysX-Anything` model during Docker build due to 401 Unauthorized error from Hugging Face.

## Solution
Add Hugging Face authentication token to the Docker build process.

---

## Step 1: Get Your Hugging Face Token

1. Go to https://huggingface.co/settings/tokens
2. Click "New token"
3. Give it a name (e.g., "physx-service")
4. Select "Read" permissions
5. Copy the token (starts with `hf_`)

---

## Step 2: Modify Dockerfile

In `/home/nijelhunt1999/BlueprintPipeline/physx-service/Dockerfile`, find the section with `download.py` and make these changes:

### Find this line (around step 19):
```dockerfile
RUN pip install --no-cache-dir transformers==4.50.0 tokenizers==0.21.4 qwen-vl-utils accelerate av
```

### Add AFTER that line (before the download.py step):
```dockerfile
# Accept HF_TOKEN as build argument
ARG HF_TOKEN
ENV HUGGING_FACE_HUB_TOKEN=$HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN
```

### Find this section:
```dockerfile
RUN echo "Attempting to download models using download.py..." && \
    if [ -f download.py ]; then \
        python download.py && echo "download.py succeeded" || \
        echo "Warning: download.py failed, trying alternative methods..."; \
    else \
        echo "download.py not found, will try alternative methods..."; \
    fi
```

### Replace with:
```dockerfile
RUN echo "Attempting to download models using download.py..." && \
    if [ -z "$HF_TOKEN" ]; then \
        echo "WARNING: HF_TOKEN not provided. Download may fail for gated models."; \
    else \
        echo "HF_TOKEN provided, will attempt authenticated download..."; \
    fi && \
    if [ -f download.py ]; then \
        python download.py && echo "download.py succeeded" || \
        (echo "ERROR: download.py failed!" && exit 1); \
    else \
        echo "download.py not found!"; \
        exit 1; \
    fi
```

---

## Step 3: Update cloudbuild.yaml (if exists)

If you have a `cloudbuild.yaml` file, update it to accept the token:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '--build-arg'
      - 'HF_TOKEN=${_HF_TOKEN}'
      - '-t'
      - 'gcr.io/$PROJECT_ID/physx-service:latest'
      - '-t'
      - 'gcr.io/$PROJECT_ID/physx-service:$SHORT_SHA'
      - '.'
    timeout: 7200s

substitutions:
  _HF_TOKEN: ''  # Will be provided at build time

options:
  machineType: 'E2_HIGHCPU_8'
  timeout: 7200s
```

---

## Step 4: Build with Token

### Option A: Using gcloud builds submit (Recommended)

```bash
cd /home/nijelhunt1999/BlueprintPipeline/physx-service/

# Replace with your actual token
export HF_TOKEN="hf_your_token_here"

# If you have cloudbuild.yaml:
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _HF_TOKEN="$HF_TOKEN" \
  --timeout=2h \
  .

# If no cloudbuild.yaml:
gcloud builds submit \
  --tag gcr.io/blueprint-8c1ca/physx-service:latest \
  --timeout=2h \
  --build-arg HF_TOKEN="$HF_TOKEN" \
  .
```

### Option B: Using docker build locally

```bash
cd /home/nijelhunt1999/BlueprintPipeline/physx-service/

export HF_TOKEN="hf_your_token_here"

docker build \
  --build-arg HF_TOKEN="$HF_TOKEN" \
  -t gcr.io/blueprint-8c1ca/physx-service:latest \
  .

# Push to GCR
docker push gcr.io/blueprint-8c1ca/physx-service:latest
```

---

## Step 5: Deploy to Cloud Run

```bash
gcloud run deploy physx-service \
  --image gcr.io/blueprint-8c1ca/physx-service:latest \
  --region us-central1 \
  --platform managed \
  --memory 16Gi \
  --cpu 4 \
  --timeout 3600 \
  --max-instances 10 \
  --allow-unauthenticated
```

---

## Verification

After deployment, check the logs:

```bash
# Test the health endpoint
curl https://physx-service-744608654760.us-central1.run.app/health

# Check if model loaded
gcloud run services logs read physx-service \
  --region us-central1 \
  --limit 100 | grep -i "model"
```

Expected output should show:
- ✅ "Model loaded successfully"
- ✅ No "missing_files" errors
- ✅ Service warmup succeeded

---

## Troubleshooting

### Still getting 401 errors?
- Verify token is valid: `huggingface-cli whoami --token $HF_TOKEN`
- Check if model is gated: Visit https://huggingface.co/Caoza/PhysX-Anything
- You may need to accept terms on the model page

### Build timeout?
- Increase timeout: Add `--timeout=3h` to build command
- Use faster machine: Add `--machine-type=E2_HIGHCPU_32` to gcloud builds

### Out of memory during build?
```bash
gcloud builds submit \
  --machine-type=E2_HIGHCPU_32 \
  --disk-size=200 \
  --substitutions _HF_TOKEN="$HF_TOKEN" \
  .
```

---

## Security Notes

- **Never commit HF_TOKEN to git**
- Store token in Secret Manager:
  ```bash
  echo -n "$HF_TOKEN" | gcloud secrets create hf-token --data-file=-
  ```
- Reference in cloudbuild.yaml:
  ```yaml
  availableSecrets:
    secretManager:
      - versionName: projects/blueprint-8c1ca/secrets/hf-token/versions/latest
        env: 'HF_TOKEN'
  ```
