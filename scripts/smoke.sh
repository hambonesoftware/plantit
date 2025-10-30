#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:5590}"

function curl_check() {
  local path=$1
  local expect_ct=$2
  local tmp_body tmp_headers
  tmp_body=$(mktemp)
  tmp_headers=$(mktemp)
  local url="${BASE_URL}${path}"

  printf '→ GET %s\n' "$url"
  local status
  status=$(curl -sS -o "$tmp_body" -D "$tmp_headers" -w '%{http_code}' "$url")

  if [[ "$status" != "200" ]]; then
    printf '❌ %s returned status %s (expected 200)\n' "$path" "$status"
    printf 'Response body:\n'
    cat "$tmp_body"
    return 1
  fi

  local content_type
  content_type=$(grep -i '^content-type:' "$tmp_headers" | tail -n 1 | cut -d' ' -f2- | tr -d '\r')

  if [[ -z "$content_type" || $content_type != ${expect_ct}* ]]; then
    printf '❌ %s returned Content-Type %s (expected %s)\n' "$path" "$content_type" "$expect_ct"
    return 1
  fi

  printf '✅ %s (Content-Type: %s)\n' "$path" "$content_type"
  cat "$tmp_body"
}

curl_check '/' 'text/html'
curl_check '/app.js' 'text/javascript'

health_body=$(curl -sS -H 'Accept: application/json' "${BASE_URL}/api/health")
if [[ "$health_body" != *'"ok":true'* && "$health_body" != *'"ok": true'* ]]; then
  printf '❌ /api/health response invalid:\n%s\n' "$health_body"
  exit 1
fi
printf '✅ /api/health responded with ok=true\n'

echo 'All smoke checks passed.'
