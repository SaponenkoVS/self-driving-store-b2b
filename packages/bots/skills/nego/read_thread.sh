#!/usr/bin/env bash
# read_thread.sh <thread_id> [since_seq]
source "$(dirname "$0")/_lib.sh"
relay GET "/threads/${1:?usage: read_thread.sh <thread_id> [since_seq]}?since=${2:-0}"
