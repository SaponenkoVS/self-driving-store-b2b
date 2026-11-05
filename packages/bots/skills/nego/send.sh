#!/usr/bin/env bash
# send.sh <message.json> : fill in protocol/msg_id/from and POST to the Relay.
source "$(dirname "$0")/_lib.sh"
: "${NSC_ACCOUNT:?set NSC_ACCOUNT}"; : "${NSC_ROLE:?set NSC_ROLE}"
file="${1:?usage: send.sh <message.json>}"

# Adds a msg_id to the file on first send (so re-running after a network error is a safe duplicate),
# then prints the full outgoing message.
body="$(python3 - "$file" <<'PY'
import json, os, sys, uuid
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    msg = json.load(f)
if not msg.get("msg_id"):
    msg["msg_id"] = str(uuid.uuid4())
    with open(path, "w", encoding="utf-8") as f:
        json.dump(msg, f, ensure_ascii=False, indent=2)
msg["protocol"] = "b2b-nego/v1"
msg["from"] = {"account": os.environ["NSC_ACCOUNT"], "role": os.environ["NSC_ROLE"]}
print(json.dumps(msg, ensure_ascii=False))
PY
)"
relay POST /messages "$body"
