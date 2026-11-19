#!/usr/bin/env bash
# Say which clone serves the review run's ports, at what commit, and whether that clone still
# exists. A run whose folder was removed keeps its ports and serves 404s, and can't be stopped
# by path, so this prints the PIDs to stop it by.
# Usage: scripts/review-run.sh [port ...]   (default: 5173 5147, the review run's web and server)
set -u
ports=("$@")
[ ${#ports[@]} -eq 0 ] && ports=(5173 5147)

# The clone a process runs from: the first path in its own or an ancestor's command line that
# contains /server/src/ScoreMap.AppHost or /web/. DCP, which holds the ports, names its
# AppHost with --monitor <pid> rather than as its parent, so follow that too.
clone_of() {
  local pid=$1 hops=0 cmd monitor path
  while [ -n "$pid" ] && [ "$pid" -gt 1 ] && [ $hops -lt 12 ]; do
    cmd=$(ps -o command= -p "$pid" 2>/dev/null) || return
    path=$(grep -oE '/[^ ]*/(server/src/ScoreMap\.AppHost|web)/' <<<"$cmd" | head -1)
    if [ -n "$path" ]; then sed -E 's#/(server/src/ScoreMap\.AppHost|web)/$##' <<<"$path"; return; fi
    monitor=$(grep -oE -- '--monitor [0-9]+' <<<"$cmd" | awk '{print $2}')
    if [ -n "$monitor" ]; then pid=$monitor; else pid=$(ps -o ppid= -p "$pid" | tr -d ' '); fi
    hops=$((hops + 1))
  done
}

for port in "${ports[@]}"; do
  pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  if [ -z "$pid" ]; then echo "$port: free"; continue; fi
  clone=$(clone_of "$pid")
  if [ -z "$clone" ]; then
    echo "$port: held by pid $pid ($(ps -o comm= -p "$pid")), not a ScoreMap run"
  elif [ ! -d "$clone" ]; then
    echo "$port: ORPHAN run from $clone (folder removed). Stop it: pkill -f '$clone/'"
  else
    sha=$(git -C "$clone" rev-parse --short HEAD 2>/dev/null)
    branch=$(git -C "$clone" branch --show-current 2>/dev/null)
    dirty=$([ -n "$(git -C "$clone" status --porcelain 2>/dev/null)" ] && echo ", uncommitted changes" || echo ", clean")
    echo "$port: $clone at $sha [$branch]$dirty"
  fi
done
