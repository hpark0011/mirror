# <Agent Name> — Session Logs

Append-only. One entry per task, newest at bottom. Format and rules live in the agent spec → **How to Operate** (step 5: Log & Patch) and **Evidence Rule**. Do not duplicate them here.

---

<!--
## YYYY-MM-DD — <task title>

**Task**:          <ticket id / PR link / one-line description>
**Reused**:        <what from knowledge.md / which prior log entry shaped this session>  OR  "nothing — baseline session"
**Correctness**:   pass | fail — <cited artifact: command + exit code + line, or file:line, or screenshot path, or commit hash>
**Regression**:    pass | fail — <surface checked + cited artifact>
**Efficiency**:    <N used / M estimated> iterations (baseline: session YYYY-MM-DD, M' iterations); <biggest cost>
**Bottleneck**:    <the single biggest friction this session>
**Recurring?**:    no  |  yes — prior session YYYY-MM-DD; <why the prior patch failed to land>
**Counterfactual**: "If the patch below had existed at session start, this would have cost <N> iterations instead of <M>, because <specific mechanism>."
**Patch**:
  - File:   `.claude/agents/<name>.md` | `.claude/agent-memory/<name>/knowledge.md`
  - Section/line: <where in the file>
  - Change: <one sentence: what was added, corrected, or removed>
-->
