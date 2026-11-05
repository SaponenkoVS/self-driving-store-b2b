---
name: state
description: Save and log what you are doing so you can resume after a restart. Use after every message you send and at the end of every wake-up.
---

# State and log

- `save_state.sh '<json>'`: replaces your `state.json` atomically and adds `updated_at`. Save after **every** send, e.g.
  `save_state.sh '{"task_id":"T-bella-0001","step":"waiting_for_guard","last_seq":3,"draft_order_id":"D-1042"}'`
- `log.sh "<short line>"`: appends to `log.jsonl` (the dashboard shows the last lines).
- When a task ends (confirmed or rejected): `save_state.sh '{}'`, then add one lesson line to `memory.md` if you learned something about the other company (e.g. "Steelworks counters about 5% above our first offer").

The bot folder is `$NSC_BOT_DIR` (e.g. `bots/store/customer-manager`).
