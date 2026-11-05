#!/usr/bin/env bash
# Play the STORE's side of a supplier negotiation from your laptop (demo / testing without the store bots).
# Goes through the Relay's normal pipeline (POST /admin/send), so /live, signing and delivery are real.
#
#   scripts/as-store.sh rfq     <sku> <qty> <deliver_by YYYY-MM-DD>   -> prints the new thread id
#   scripts/as-store.sh counter <thread> <sku> <qty> <unit_price> <deliver_by>
#   scripts/as-store.sh accept  <thread>
#   scripts/as-store.sh reject  <thread> "<note>"
#   scripts/as-store.sh show    <thread>
# Env: RELAY (default http://localhost:8787), SUPPLIER (default steelworks)
set -euo pipefail
cd "$(dirname "$0")/.."
RELAY="${RELAY:-http://localhost:8787}"
SUPPLIER="${SUPPLIER:-steelworks}"
ADMIN=$(grep '^ADMIN_TOKEN=' apps/relay/.env | cut -d= -f2-)
DB=apps/relay/relay.sqlite

send() { # send <json message>
  curl -sS -X POST "$RELAY/admin/send" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
    -d "{\"as\":\"store\",\"message\":$1}" -w '\n'
}
base() { # base <thread> <type>
  printf '{"protocol":"b2b-nego/v1","msg_id":"demo-%s-%s","thread_id":"%s","from":{"account":"store","role":"supplier-manager"},"to":{"account":"%s","role":"seller"},"type":"%s"' \
    "$(date +%s)" "$RANDOM" "$1" "$SUPPLIER" "$2"
}
decision() { echo "DEC-DEMO-$(date +%H%M%S)"; }   # stands in for the guard's decision in this manual test

case "${1:-}" in
  rfq)
    T="T-store-sup-$(date +%Y%m%d%H%M%S)"
    send "$(base "$T" rfq),\"lines\":[{\"sku\":\"$2\",\"qty\":$3,\"deliver_by\":\"$4\"}],\"note\":\"Delivery to our warehouse.\"}"
    echo "thread: $T" ;;
  counter)
    send "$(base "$2" counter),\"decision_id\":\"$(decision)\",\"lines\":[{\"sku\":\"$3\",\"qty\":$4,\"unit_price\":$5,\"currency\":\"EUR\",\"deliver_by\":\"$6\"}]}" ;;
  accept)
    send "$(base "$2" accept),\"decision_id\":\"$(decision)\"}" ;;
  reject)
    send "$(base "$2" reject),\"note\":\"${3:-No thanks}\"}" ;;
  show)
    sqlite3 -separator ' | ' "$DB" "select status, 'round '||round, 'waiting on '||coalesce(pending_on,'-') from threads where id='$2'"
    sqlite3 -separator ' | ' "$DB" "select seq, from_account, type, delivery, coalesce(json_extract(envelope,'\$.lines[0].unit_price'),''), coalesce(json_extract(envelope,'\$.note'),'') from messages where thread_id='$2' order by seq" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
