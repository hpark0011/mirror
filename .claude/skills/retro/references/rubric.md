# Scoring Rubric

7 dimensions covering session discipline, problem-solving flow, fix quality, and execution efficiency. Each session is scored 1-5 per dimension.

## Weights

| Weight | Multiplier | Dimensions |
|--------|------------|------------|
| High | x3 | Session Discipline, Problem-Solving Flow |
| Medium | x2 | Clean Fix Quality, Debugging Efficiency, Communication Quality |
| Low | x1 | Context Management, Tool Efficiency |

**Max weighted score:** (2 x 15) + (3 x 10) + (2 x 5) = 70 → normalized to 5.0

---

## Dimension 1: Session Discipline (x3)

Does the session have a single focused outcome? Does it avoid scope creep?

| Score | Criteria |
|-------|----------|
| 5 | Single clear goal stated early, all work drives toward it, clean commit at end |
| 4 | Goal is clear, minor tangent but returns quickly |
| 3 | Goal exists but shifts once during session; some unrelated work |
| 2 | Multiple unrelated topics; no clear deliverable; session balloons |
| 1 | No discernible focus; thrashing between tasks; no commit |

**Signals from extraction:**
- `user_message_count > 50` → likely ballooned (flag)
- `duration_minutes > 120` → long session (flag)
- `branch_count > 1` → possible scope shift (flag)
- First 5 user messages should converge on a single topic

---

## Dimension 2: Problem-Solving Flow (x3)

Does the session follow: describe → investigate → hypothesize → align → implement → verify?

| Score | Criteria |
|-------|----------|
| 5 | Full flow followed; hypothesis stated before code; developer consulted; verified at end |
| 4 | Flow mostly followed; one minor skip (e.g., verification was implicit) |
| 3 | Investigation happened but hypothesis was not stated explicitly before code changes |
| 2 | Jumped to implementation early; developer not consulted on approach |
| 1 | No investigation; immediate code changes; no verification |

**Signals from extraction:**
- `investigation_ratio < 1.0` → skipped investigation (Read+Grep+Glob < Edit+Write)
- `first_edit_turn < 3` → started editing very early
- Absence of hypothesis/approach language in early assistant messages

---

## Dimension 3: Clean Fix Quality (x2)

Are solutions root-cause fixes, not bandaids?

| Score | Criteria |
|-------|----------|
| 5 | Root cause identified and addressed; minimal change; no workarounds |
| 4 | Good fix with minor cleanup; no bandaids |
| 3 | Fix works but includes unnecessary defensive code or over-engineering |
| 2 | Contains a workaround (setTimeout, retry, flag) acknowledged as temporary |
| 1 | Bandaid fix; multiple reverts; or fix doesn't address root cause |

**Signals from extraction:**
- `setTimeout_count > 0` → bandaid flag
- `revert_keyword_count > 0` → solution instability
- `try_catch_swallow_count > 0` → error suppression

---

## Dimension 4: Debugging Efficiency (x2)

Is progress steady, or are there spirals and repeated failed attempts?

| Score | Criteria |
|-------|----------|
| 5 | Linear progress; each step narrows the problem; no backtracking |
| 4 | One minor detour but self-corrected quickly |
| 3 | One revert or wrong hypothesis, but recovered with a new approach |
| 2 | Multiple wrong turns; repeated similar attempts; slow convergence |
| 1 | Spinning in circles; same approach tried 3+ times; no convergence |

**Signals from extraction:**
- `revert_keyword_count >= 2` → debugging spiral
- `consecutive_same_tool_runs > 5` → possible loop (e.g., repeated Edit attempts)
- `frustration_keyword_count > 0` → session friction

---

## Dimension 5: Communication Quality (x2)

Are hypotheses stated? Is the developer consulted before changes?

| Score | Criteria |
|-------|----------|
| 5 | Hypotheses clearly stated; developer asked for input at decision points; approach aligned before coding |
| 4 | Good communication; one decision made without explicit check-in |
| 3 | Some hypotheses stated but not consistently; developer sometimes consulted |
| 2 | Minimal communication; large changes made without discussion |
| 1 | No hypotheses; no developer consultation; changes presented as fait accompli |

**Signals from extraction:**
- Ratio of user messages to assistant messages (very low = Claude monologuing)
- Presence of question marks in assistant messages before edit phases
- `first_edit_turn` vs `first_user_confirmation` — editing before approval

---

## Dimension 6: Context Management (x1)

Is the session kept to a manageable size? Are sub-agents used appropriately?

| Score | Criteria |
|-------|----------|
| 5 | Session size appropriate; sub-agents used for parallelizable research; context not wasted |
| 4 | Slightly long but productive throughout |
| 3 | Session could have been split into 2; some context wasted on tangents |
| 2 | Very long session; context clearly degrading; repeated reads of same files |
| 1 | Massive session with visible context loss; duplicated work; no commits to checkpoint |

**Signals from extraction:**
- `file_size_bytes > 2_000_000` → very large session
- `total_turns > 80` → likely needs splitting
- `task_tool_count` vs `total_tool_count` — sub-agent usage ratio

---

## Dimension 7: Tool Efficiency (x1)

Is the right tool used for the right job? Is parallelism leveraged?

| Score | Criteria |
|-------|----------|
| 5 | Correct tool every time; parallel calls where possible; no redundant reads |
| 4 | Good tool usage; minor inefficiency (e.g., sequential when parallel was possible) |
| 3 | Some tool misuse (Bash for file reads, re-reading same file) |
| 2 | Frequent wrong tool choice; no parallelism; redundant operations |
| 1 | Severe inefficiency; excessive tool calls; Bash used for everything |

**Signals from extraction:**
- `bash_cat_count > 0` → using Bash instead of Read
- `bash_grep_count > 0` → using Bash instead of Grep
- `consecutive_same_tool_runs` on Read for same file → redundant reads
- Low parallel call ratio

---

## Investigation Ratio

Key heuristic applied across all sessions:

```
investigation_ratio = (Read + Grep + Glob) / (Edit + Write)
```

| Ratio | Interpretation |
|-------|---------------|
| > 3.0 | Heavy research session (may be appropriate) |
| 1.5–3.0 | Healthy investigation-to-action balance |
| 1.0–1.5 | Borderline — depends on task type |
| < 1.0 | Skipped investigation — code-first approach |
| < 0.5 | Almost no investigation — high risk of bandaids |

---

## Overall Score Calculation

```
raw = sum(dimension_score * weight for each dimension)
max = sum(5 * weight for each dimension)  # = 70
normalized = (raw / max) * 5.0
```

| Overall | Label |
|---------|-------|
| 4.5–5.0 | Excellent |
| 3.5–4.4 | Good |
| 2.5–3.4 | Needs Improvement |
| 1.5–2.4 | Poor |
| 1.0–1.4 | Critical |
