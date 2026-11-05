#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
relay POST "/messages/${1:?usage: ack.sh <msg_id>}/ack"
