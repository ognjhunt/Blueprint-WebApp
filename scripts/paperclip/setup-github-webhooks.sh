#!/usr/bin/env bash
# setup-github-webhooks.sh
#
# Creates GitHub webhooks on all 3 Blueprint repos to forward events to Paperclip.
# Requires a public URL for the Paperclip instance (e.g. via ngrok or smee.io).
#
# Usage:
#   PAPERCLIP_PUBLIC_URL=https://abc123.ngrok.io ./setup-github-webhooks.sh
#
# Prerequisites:
#   - gh CLI authenticated
#   - PAPERCLIP_PUBLIC_URL set to a publicly reachable Paperclip URL
#   - Webhook secret already stored in Paperclip (see bootstrap script)

set -euo pipefail
export PATH="/opt/homebrew/bin:/Users/nijelhunt_1/.nvm/versions/node/v22.21.1/bin:$PATH"

PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:?Set PAPERCLIP_PUBLIC_URL to the public URL for your Paperclip instance}"
WEBHOOK_URL="${PAPERCLIP_PUBLIC_URL}/api/plugins/blueprint.automation/webhooks/github"
GITHUB_OWNER="ognjhunt"
REPOS=("Blueprint-WebApp" "BlueprintCapturePipeline" "BlueprintCapture")
WEBHOOK_SECRET="${WEBHOOK_SECRET:-$(openssl rand -hex 32)}"
EVENTS="push,pull_request,pull_request_review,workflow_run,issues"

echo "Webhook URL: $WEBHOOK_URL"
echo "Events: $EVENTS"
echo ""

for repo in "${REPOS[@]}"; do
  echo "--- $GITHUB_OWNER/$repo ---"

  # Check if webhook already exists
  EXISTING=$(gh api "repos/$GITHUB_OWNER/$repo/hooks" --jq ".[] | select(.config.url == \"$WEBHOOK_URL\") | .id" 2>/dev/null || true)

  if [ -n "$EXISTING" ]; then
    echo "  Webhook already exists (id: $EXISTING), updating..."
    gh api "repos/$GITHUB_OWNER/$repo/hooks/$EXISTING" \
      --method PATCH \
      --field "config[url]=$WEBHOOK_URL" \
      --field "config[content_type]=json" \
      --field "config[secret]=$WEBHOOK_SECRET" \
      --field "events[]=$EVENTS" \
      --field "active=true" \
      --silent
    echo "  Updated."
  else
    echo "  Creating webhook..."
    gh api "repos/$GITHUB_OWNER/$repo/hooks" \
      --method POST \
      --field "name=web" \
      --field "config[url]=$WEBHOOK_URL" \
      --field "config[content_type]=json" \
      --field "config[secret]=$WEBHOOK_SECRET" \
      --field "events[]=push" \
      --field "events[]=pull_request" \
      --field "events[]=pull_request_review" \
      --field "events[]=workflow_run" \
      --field "events[]=issues" \
      --field "active=true" \
      --silent
    echo "  Created."
  fi
done

echo ""
echo "GitHub webhooks configured. Events will forward to:"
echo "  $WEBHOOK_URL"
echo ""
echo "If running locally, use a tunnel to expose Paperclip:"
echo "  ngrok http 3100"
echo "  # Then re-run with PAPERCLIP_PUBLIC_URL=https://your-ngrok-url.ngrok.io"
