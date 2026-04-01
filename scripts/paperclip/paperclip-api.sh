#!/usr/bin/env bash

paperclip_api_health() {
  local api_url="$1"
  curl -fsS "${api_url}/api/health" >/dev/null 2>&1
}

paperclip_api_fetch_json() {
  local api_url="$1"
  local path="$2"
  local label="${3:-Paperclip API}"
  local attempts="${4:-3}"
  local delay_seconds="${5:-1}"
  local response=""
  local error_message=""

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if response="$(curl -fsS "${api_url}${path}" 2>&1)"; then
      if [ -n "$response" ]; then
        printf '%s' "$response"
        return 0
      fi
      error_message="${label} returned an empty response for ${path}"
    else
      error_message="${label} unavailable at ${api_url}${path}: ${response}"
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$delay_seconds"
    fi
  done

  echo "$error_message" >&2
  return 1
}

paperclip_require_external_postgres() {
  local requirement="${BLUEPRINT_PAPERCLIP_REQUIRE_EXTERNAL_POSTGRES:-0}"
  if [[ ! "$requirement" =~ ^(1|true|yes)$ ]]; then
    return 0
  fi

  if [ -n "${DATABASE_URL:-}" ]; then
    return 0
  fi

  echo "DATABASE_URL is required for the shared Blueprint Paperclip instance. Set DATABASE_URL or disable BLUEPRINT_PAPERCLIP_REQUIRE_EXTERNAL_POSTGRES for isolated local testing." >&2
  return 1
}
