#!/usr/bin/env bash
# Shared helpers for the nego scripts.
set -euo pipefail
: "${NSC_RELAY_URL:?set the NSC_RELAY_URL secret}"
: "${NSC_TOKEN:?set the NSC_TOKEN secret}"
NSC_RELAY_URL="${NSC_RELAY_URL%/}"
NSC_TOKEN="$(printf '%s' "$NSC_TOKEN" | tr -d '\r\n')"

relay() { # relay METHOD PATH [json-body]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method" "$NSC_RELAY_URL$path" -H "Authorization: Bearer $NSC_TOKEN" -w '\nHTTP %{http_code}\n')
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' --data-binary "$body"); fi
  curl "${args[@]}"
}
