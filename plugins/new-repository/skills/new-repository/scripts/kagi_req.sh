#!/usr/bin/env bash
# kagi_req.sh — submit one kagi request, wait for the phone approval, print the final JSON result.
#
# Usage:
#   KAGI_ID=<id> kagi_req.sh '<json request body, without "seal">'
#
# Prints the raw kagi /res response JSON on stdout when the request is delivered (approved and
# executed). Exits non-zero (with the rejection/error problem+json on stdout) if kagi itself refused
# the request (400/403/410) rather than relaying it. A request the phone's owner declines on their
# phone still comes back as a normal 200 from /res — the embedded "status" will reflect what GitHub
# (or kagi) did; check it, don't assume success just because this script exits 0.
#
# Requires: KAGI_ID env var (the subscription id from the kagi page — ask the user for it, never
# guess or reuse one from a previous unrelated session).

set -euo pipefail

if [ -z "${KAGI_ID:-}" ]; then
  echo "KAGI_ID is not set. Ask the user for their kagi subscription id first." >&2
  exit 2
fi
if [ "$#" -ne 1 ]; then
  echo "usage: kagi_req.sh '<json request body>'" >&2
  exit 2
fi

BASE="https://kagi.kbn.one/api/sub/${KAGI_ID}"
BODY="$1"

submit() {
  curl -sS -w '\n%{http_code}' --max-time 20 \
    -X POST "${BASE}/req" \
    -H 'Content-Type: application/json' \
    --data-raw "$BODY"
}

RESP="$(submit)"
CODE="$(echo "$RESP" | tail -n1)"
JSON="$(echo "$RESP" | sed '$d')"

if [ "$CODE" != "202" ]; then
  echo "$JSON"
  exit 1
fi

TXN="$(echo "$JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["transaction_id"])')"
echo "kagi: waiting for phone approval (transaction ${TXN})..." >&2

while true; do
  RESP="$(curl -sS -w '\n%{http_code}' --max-time 60 "${BASE}/res?transaction_id=${TXN}&wait=55")"
  CODE="$(echo "$RESP" | tail -n1)"
  JSON="$(echo "$RESP" | sed '$d')"
  case "$CODE" in
    202) continue ;;        # still pending — keep polling
    200) echo "$JSON"; exit 0 ;;
    *)   echo "$JSON"; exit 1 ;;
  esac
done
