# Quick Start: Fix PhysX Service Model Download

## 🚀 5-Minute Fix

### Step 1: Get HF Token (1 min)
1. Go to https://huggingface.co/settings/tokens
2. Click "New token" → Name it "physx" → Select "Read" → Create
3. Copy the token (starts with `hf_`)

### Step 2: Edit Dockerfile (2 min)

Open: `/home/nijelhunt1999/BlueprintPipeline/physx-service/Dockerfile`

**Find line with:**
```dockerfile
RUN pip install --no-cache-dir transformers==4.50.0 tokenizers==0.21.4 qwen-vl-utils accelerate av
```

**Add these 3 lines RIGHT AFTER IT:**
```dockerfile
ARG HF_TOKEN
ENV HUGGING_FACE_HUB_TOKEN=$HF_TOKEN
ENV HF_TOKEN=$HF_TOKEN
```

**Find:**
```dockerfile
RUN echo "Attempting to download models using download.py..." && \
    if [ -f download.py ]; then \
        python download.py && echo "download.py succeeded" || \
        echo "Warning: download.py failed, trying alternative methods..."; \
    else \
        echo "download.py not found, will try alternative methods..."; \
    fi
```

**Replace with:**
```dockerfile
RUN echo "Attempting to download models using download.py..." && \
    if [ -z "$HF_TOKEN" ]; then \
        echo "ERROR: HF_TOKEN not provided!"; \
        exit 1; \
    fi && \
    python download.py
```

### Step 3: Build & Deploy (2 min to start, 1-2 hours to complete)

In **Google Cloud Shell**:

```bash
# Set your token
export HF_TOKEN="hf_YOUR_TOKEN_HERE"

# Navigate to directory
cd /home/nijelhunt1999/BlueprintPipeline/physx-service/

# Build and deploy
gcloud builds submit \
  --tag gcr.io/blueprint-8c1ca/physx-service:latest \
  --timeout=2h \
  --build-arg HF_TOKEN="$HF_TOKEN" \
  .
```

### Step 4: Deploy to Cloud Run

```bash
gcloud run deploy physx-service \
  --image gcr.io/blueprint-8c1ca/physx-service:latest \
  --region us-central1 \
  --memory 16Gi \
  --cpu 4 \
  --timeout 3600 \
  --allow-unauthenticated
```

### Step 5: Verify

```bash
# Check service
curl https://physx-service-744608654760.us-central1.run.app/health

# Should return: {"status": "ready"} or similar
```

---

## ✅ Expected Results

Build logs should show:
```
✓ Fetching 18 files: 100%
✓ Model weights downloaded
✓ VLM directory: ~15-50GB (not 5MB!)
✓ model-00001-of-XXXX.safetensors found
✓ tokenizer.json found
```

Runtime logs should show:
```
✓ Service warmup succeeded
✓ Model loaded successfully
✓ No "missing_files" errors
```

---

## ❌ If It Still Fails

### 401 Error?
Visit https://huggingface.co/Caoza/PhysX-Anything and accept terms

### Timeout?
```bash
gcloud builds submit \
  --machine-type=E2_HIGHCPU_32 \
  --timeout=3h \
  --build-arg HF_TOKEN="$HF_TOKEN" \
  .
```

### Out of Disk?
```bash
gcloud builds submit \
  --disk-size=200 \
  --build-arg HF_TOKEN="$HF_TOKEN" \
  .
```

---

## 📁 Files Created

All documentation is in `/home/user/Blueprint-WebApp/docs/`:
- `PHYSX_SERVICE_FIX.md` - Full documentation
- `dockerfile.patch` - Exact changes needed
- `cloudbuild.yaml.template` - Optional build config
- `deploy-physx-with-token.sh` - Automated script
- `QUICK_START.md` - This file
