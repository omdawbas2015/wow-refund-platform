#!/usr/bin/env bash
#
# Smoke-test the inbound Power Automate webhook with the four sample
# payloads in ./sample-payloads/. Expects the platform to be running at
# APP_URL (default: http://localhost:3000) and the inbound secret to
# match POWER_AUTOMATE_INBOUND_SECRET (default: empty = no auth).
#
# The test prints the classified `intent` for each payload. On a fresh
# database the approval / KNET / Aura payloads will report `IGNORED`
# (with reason "unknown ... batch") — that's correct behavior, not a
# failure. To see real classification, first create the matching
# batches via the operations desk and update the sample subjects.
#
# Usage:
#   ./test-webhook.sh                               # localhost, no secret
#   APP_URL=https://staging.example.com ./test-webhook.sh
#   INBOUND_SECRET=$(cat .secret) ./test-webhook.sh

set -euo pipefail

APP_URL="${APP_URL:-http://localhost:3000}"
INBOUND_SECRET="${INBOUND_SECRET:-${POWER_AUTOMATE_INBOUND_SECRET:-}}"
ENDPOINT="$APP_URL/api/webhooks/power-automate"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SAMPLES="$SCRIPT_DIR/sample-payloads"

post_one() {
  local label="$1"
  local file="$2"

  local headers=(-H "Content-Type: application/json")
  if [[ -n "$INBOUND_SECRET" ]]; then
    headers+=(-H "x-wow-signature: $INBOUND_SECRET")
  fi

  local http_code
  local body
  local resp
  resp=$(curl -sS -X POST "$ENDPOINT" \
    -w '\n%{http_code}' \
    "${headers[@]}" \
    --data-binary "@$file" || true)

  http_code=$(printf '%s' "$resp" | tail -n1)
  body=$(printf '%s' "$resp" | sed '$d')

  local intent ok reason
  intent=$(printf '%s' "$body" | jq -r '.intent // "—"' 2>/dev/null || echo "—")
  ok=$(printf '%s' "$body" | jq -r '.ok // "—"' 2>/dev/null || echo "—")
  reason=$(printf '%s' "$body" | jq -r '.payload.reason // empty' 2>/dev/null || true)

  printf '→ %-22s  status=%s  ok=%-5s  intent=%-20s' \
    "$label" "$http_code" "$ok" "$intent"
  if [[ -n "$reason" ]]; then
    printf '  reason="%s"' "$reason"
  fi
  printf '\n'
}

echo "POSTing sample payloads to $ENDPOINT"
if [[ -n "$INBOUND_SECRET" ]]; then
  echo "(signing with INBOUND_SECRET)"
else
  echo "(no INBOUND_SECRET — webhook will accept unsigned, only OK in dev)"
fi
echo ""

post_one "approval reply"    "$SAMPLES/inbound-approval-reply.json"
post_one "KNET ARN reply"    "$SAMPLES/inbound-knet-arn-reply.json"
post_one "Aura confirmation" "$SAMPLES/inbound-aura-confirmation.json"
post_one "unrelated email"   "$SAMPLES/inbound-unrelated.json"
