#!/usr/bin/env bash
# log.sh "<line>" : append {at, msg} to $NSC_BOT_DIR/log.jsonl
set -euo pipefail
: "${NSC_BOT_DIR:?set NSC_BOT_DIR}"
python3 -c '
import datetime, json, sys
at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
with open(sys.argv[1], "a", encoding="utf-8") as f:
    f.write(json.dumps({"at": at, "msg": sys.argv[2]}, ensure_ascii=False) + "\n")
' "$NSC_BOT_DIR/log.jsonl" "${1:?usage: log.sh <line>}"
