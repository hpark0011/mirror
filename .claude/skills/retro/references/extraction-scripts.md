# Extraction Scripts

Python scripts for Phase 1 (Scope & Extract). Run via Bash tool.

All scripts read JSONL files line-by-line to avoid loading large files into memory.

---

## Script 1: List Sessions

Lists session files with metadata, sorted by modification time (newest first). Filters by scope argument.

```python
#!/usr/bin/env python3
"""List and filter session JSONL files.

Usage:
    python3 -c "..." <sessions_dir> <scope>

scope formats:
    "10"   — last 10 sessions (default)
    "5"    — last 5 sessions
    "7d"   — sessions from last 7 days
    "2w"   — sessions from last 2 weeks
    "all"  — all sessions
"""
import json, os, sys, time

def list_sessions(sessions_dir, scope="10"):
    files = []
    for f in os.listdir(sessions_dir):
        if not f.endswith(".jsonl"):
            continue
        path = os.path.join(sessions_dir, f)
        size = os.path.getsize(path)
        if size < 2048:  # skip trivial sessions < 2KB
            continue
        mtime = os.path.getmtime(path)
        files.append({"path": path, "session_id": f.replace(".jsonl", ""), "size": size, "mtime": mtime})

    files.sort(key=lambda x: x["mtime"], reverse=True)

    # Apply scope filter
    if scope == "all":
        pass
    elif scope.endswith("d"):
        days = int(scope[:-1])
        cutoff = time.time() - (days * 86400)
        files = [f for f in files if f["mtime"] >= cutoff]
    elif scope.endswith("w"):
        weeks = int(scope[:-1])
        cutoff = time.time() - (weeks * 7 * 86400)
        files = [f for f in files if f["mtime"] >= cutoff]
    else:
        count = int(scope)
        files = files[:count]

    print(json.dumps(files, indent=2))

sessions_dir = sys.argv[1]
scope = sys.argv[2] if len(sys.argv) > 2 else "10"
list_sessions(sessions_dir, scope)
```

---

## Script 2: Extract Session Summary

Parses a single JSONL file and outputs a compact JSON summary. Streams line-by-line — safe for large files.

```python
#!/usr/bin/env python3
"""Extract summary from a single session JSONL file.

Usage:
    python3 -c "..." <session_file>

Outputs JSON with:
    metadata, counts, tool_breakdown, signals, sample_messages
"""
import json, sys, re, os

def extract_session(path):
    session_id = os.path.basename(path).replace(".jsonl", "")
    size = os.path.getsize(path)

    # Counters
    user_msgs = 0
    assistant_msgs = 0
    total_turns = 0
    tools = {}
    first_timestamp = None
    last_timestamp = None
    git_branch = None

    # Signals
    revert_keywords = 0
    frustration_keywords = 0
    settimeout_usage = 0
    try_catch_swallow = 0
    consecutive_same_tool = 0
    last_tool = None
    max_consecutive_same = 0
    current_consecutive = 0
    bash_cat_count = 0
    bash_grep_count = 0

    # Samples
    first_user_messages = []
    first_edit_turn = None

    revert_re = re.compile(r'\b(revert|undo|roll\s*back|backed out|went back)\b', re.I)
    frustration_re = re.compile(r'\b(still broken|not working|same error|same issue|wrong again|try again)\b', re.I)
    settimeout_re = re.compile(r'setTimeout', re.I)
    try_swallow_re = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}', re.I)

    turn = 0
    with open(path, 'r', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")
            ts = msg.get("timestamp")
            if ts:
                if first_timestamp is None:
                    first_timestamp = ts
                last_timestamp = ts

            if msg_type == "user":
                user_msgs += 1
                turn += 1
                text = ""
                content = msg.get("message", {}).get("content", "")
                if isinstance(content, str):
                    text = content
                elif isinstance(content, list):
                    text = " ".join(
                        c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"
                    )
                # Strip system tags
                text = re.sub(r'<system-reminder>.*?</system-reminder>', '', text, flags=re.S)
                if len(first_user_messages) < 5:
                    first_user_messages.append(text[:200])

                # Check signals in user text
                revert_keywords += len(revert_re.findall(text))
                frustration_keywords += len(frustration_re.findall(text))

            elif msg_type == "assistant":
                assistant_msgs += 1
                turn += 1
                content = msg.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        # Tool usage
                        if block.get("type") == "tool_use":
                            tool_name = block.get("name", "unknown")
                            tools[tool_name] = tools.get(tool_name, 0) + 1

                            # Track consecutive same tool
                            if tool_name == last_tool:
                                current_consecutive += 1
                                max_consecutive_same = max(max_consecutive_same, current_consecutive)
                            else:
                                current_consecutive = 1
                                last_tool = tool_name

                            # Track first edit
                            if tool_name in ("Edit", "Write", "MultiEdit") and first_edit_turn is None:
                                first_edit_turn = turn

                            # Bash misuse detection
                            if tool_name == "Bash":
                                cmd = json.dumps(block.get("input", {}))
                                if re.search(r'\bcat\b', cmd):
                                    bash_cat_count += 1
                                if re.search(r'\bgrep\b|\brg\b', cmd):
                                    bash_grep_count += 1

                        # Text blocks — check for signals
                        if block.get("type") == "text":
                            text = block.get("text", "")
                            settimeout_usage += len(settimeout_re.findall(text))
                            try_catch_swallow += len(try_swallow_re.findall(text))
                            revert_keywords += len(revert_re.findall(text))

            elif msg_type == "progress":
                # Extract git branch if available
                content = msg.get("content", "")
                if isinstance(content, str):
                    branch_match = re.search(r'branch:\s*(\S+)', content)
                    if branch_match:
                        git_branch = branch_match.group(1)

    # Compute duration
    duration_minutes = None
    if first_timestamp and last_timestamp:
        try:
            from datetime import datetime
            fmt = "%Y-%m-%dT%H:%M:%S"
            t1 = first_timestamp[:19]
            t2 = last_timestamp[:19]
            d1 = datetime.fromisoformat(t1)
            d2 = datetime.fromisoformat(t2)
            duration_minutes = round((d2 - d1).total_seconds() / 60, 1)
        except Exception:
            pass

    # Tool categories
    read_tools = tools.get("Read", 0) + tools.get("Grep", 0) + tools.get("Glob", 0)
    write_tools = tools.get("Edit", 0) + tools.get("Write", 0) + tools.get("MultiEdit", 0)
    investigation_ratio = round(read_tools / max(write_tools, 1), 2)

    result = {
        "session_id": session_id,
        "git_branch": git_branch,
        "first_timestamp": first_timestamp,
        "last_timestamp": last_timestamp,
        "duration_minutes": duration_minutes,
        "size_bytes": size,
        "user_messages": user_msgs,
        "assistant_messages": assistant_msgs,
        "total_turns": turn,
        "tool_breakdown": dict(sorted(tools.items(), key=lambda x: -x[1])),
        "investigation_ratio": investigation_ratio,
        "read_tools": read_tools,
        "write_tools": write_tools,
        "signals": {
            "revert_keywords": revert_keywords,
            "frustration_keywords": frustration_keywords,
            "setTimeout_usage": settimeout_usage,
            "try_catch_swallow": try_catch_swallow,
            "max_consecutive_same_tool": max_consecutive_same,
            "bash_cat_count": bash_cat_count,
            "bash_grep_count": bash_grep_count,
            "first_edit_turn": first_edit_turn,
        },
        "sample_user_messages": first_user_messages,
    }
    print(json.dumps(result, indent=2))

extract_session(sys.argv[1])
```

---

## Script 3: Aggregate Summaries

Takes a directory of individual JSON summaries and produces cross-session aggregate stats.

```python
#!/usr/bin/env python3
"""Aggregate individual session summaries into cross-session stats.

Usage:
    python3 -c "..." <summaries_dir>

Reads all .json files in the directory. Outputs aggregate JSON.
"""
import json, os, sys

def aggregate(summaries_dir):
    summaries = []
    for f in sorted(os.listdir(summaries_dir)):
        if not f.endswith(".json"):
            continue
        with open(os.path.join(summaries_dir, f)) as fh:
            summaries.append(json.load(fh))

    if not summaries:
        print(json.dumps({"error": "no summaries found"}))
        return

    total_duration = sum(s.get("duration_minutes") or 0 for s in summaries)
    total_turns = sum(s.get("total_turns", 0) for s in summaries)
    total_user_msgs = sum(s.get("user_messages", 0) for s in summaries)
    total_assistant_msgs = sum(s.get("assistant_messages", 0) for s in summaries)

    # Tool ranking across all sessions
    all_tools = {}
    for s in summaries:
        for tool, count in s.get("tool_breakdown", {}).items():
            all_tools[tool] = all_tools.get(tool, 0) + count
    tool_ranking = dict(sorted(all_tools.items(), key=lambda x: -x[1]))

    # Flag counts
    flag_counts = {
        "sessions_with_reverts": sum(1 for s in summaries if s.get("signals", {}).get("revert_keywords", 0) > 0),
        "sessions_with_frustration": sum(1 for s in summaries if s.get("signals", {}).get("frustration_keywords", 0) > 0),
        "sessions_with_setTimeout": sum(1 for s in summaries if s.get("signals", {}).get("setTimeout_usage", 0) > 0),
        "sessions_with_bash_misuse": sum(1 for s in summaries if (s.get("signals", {}).get("bash_cat_count", 0) + s.get("signals", {}).get("bash_grep_count", 0)) > 0),
    }

    # Investigation ratios
    ratios = [s.get("investigation_ratio", 0) for s in summaries]
    avg_ratio = round(sum(ratios) / len(ratios), 2) if ratios else 0

    # Longest session
    longest = max(summaries, key=lambda s: s.get("duration_minutes") or 0)

    result = {
        "session_count": len(summaries),
        "total_duration_minutes": round(total_duration, 1),
        "total_turns": total_turns,
        "total_user_messages": total_user_msgs,
        "total_assistant_messages": total_assistant_msgs,
        "avg_investigation_ratio": avg_ratio,
        "tool_ranking": tool_ranking,
        "flag_counts": flag_counts,
        "longest_session": {
            "session_id": longest.get("session_id"),
            "duration_minutes": longest.get("duration_minutes"),
            "turns": longest.get("total_turns"),
        },
        "sessions_over_2MB": sum(1 for s in summaries if s.get("size_bytes", 0) > 2_000_000),
        "sessions_under_investigation": sum(1 for s in summaries if s.get("investigation_ratio", 999) < 1.0),
    }
    print(json.dumps(result, indent=2))

aggregate(sys.argv[1])
```

---

## Running the Scripts

The SKILL.md protocol runs these via Bash. The inline pattern (no temp files for scripts):

```bash
# List sessions
python3 -c '<script_1_content>' "$SESSIONS_DIR" "$SCOPE"

# Extract one session (run in batch of 5-10)
python3 -c '<script_2_content>' "$SESSION_FILE" > "$SUMMARIES_DIR/$SESSION_ID.json"

# Aggregate
python3 -c '<script_3_content>' "$SUMMARIES_DIR"
```

### Constants

```
SESSIONS_DIR = ~/.claude/projects/-Users-disquiet-Desktop-mirror/
MIN_FILE_SIZE = 2048  # bytes — skip trivial sessions
SUMMARIES_DIR = /tmp/retro-summaries-$(date +%s)
```
