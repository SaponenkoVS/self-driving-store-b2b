#!/usr/bin/env bash
# register.sh <invite_code> <gateway_webhook_url> <gateway_webhook_key>
# One-time onboarding for a Grok account. Prints account_token + relay_secret: store them as the
# secrets NSC_TOKEN and NSC_RELAY_SECRET (shown only once).
set -euo pipefail
: "${NSC_RELAY_URL:?set NSC_RELAY_URL}"
body="$(python3 -c '
import json, sys
key = sys.argv[3].strip()
key = key[7:] if key.startswith("Bearer ") else key
print(json.dumps({"invite_code": sys.argv[1], "gateway_url": sys.argv[2], "gateway_key": key}))
' "${1:?invite code}" "${2:?gateway webhook url}" "${3:?gateway webhook key}")"
curl -sS -X POST "${NSC_RELAY_URL%/}/accounts/register" -H 'Content-Type: application/json' \
  --data-binary "$body" -w '\nHTTP %{http_code}\n'
