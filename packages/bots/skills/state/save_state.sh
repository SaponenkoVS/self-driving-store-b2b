#!/usr/bin/env bash
# save_state.sh '<json>' : atomically replace $NSC_BOT_DIR/state.json (adds updated_at)
set -euo pipefail
: "${NSC_BOT_DIR:?set NSC_BOT_DIR}"
python3 - "$NSC_BOT_DIR/state.json" "${1:?usage: save_state.sh '<json>'}" <<'PY'
import datetime, json, os, sys, tempfile
path, raw = sys.argv[1], sys.argv[2]
state = json.loads(raw)
state["updated_at"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)))
with os.fdopen(fd, "w", encoding="utf-8") as f:
    json.dump(state, f, ensure_ascii=False, indent=2)
os.replace(tmp, path)
PY
