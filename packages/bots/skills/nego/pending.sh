#!/usr/bin/env bash
# pending.sh : threads waiting on my account
source "$(dirname "$0")/_lib.sh"
relay GET "/threads?pending=1"
