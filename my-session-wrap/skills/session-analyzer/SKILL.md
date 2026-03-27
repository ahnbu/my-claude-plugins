---
name: session-analyzer
description: This skill should be used when the user asks to "analyze session", "세션 분석", "evaluate skill execution", "스킬 실행 검증", "check session logs", "로그 분석", provides a session ID with a skill path, or wants to verify that a skill executed correctly in a past session. Post-hoc analysis of Claude Code sessions to validate skill/agent/hook behavior against SKILL.md specifications.
version: 1.0.0
user-invocable: true
---

# Session Analyzer Skill

Post-hoc analysis tool for validating Claude Code session behavior against SKILL.md specifications.

## Purpose

Analyze completed sessions to verify:
1. **Expected vs Actual Behavior** - Did the skill follow SKILL.md workflow?
2. **Component Invocations** - Were SubAgents, Hooks, and Tools called correctly?
3. **Artifacts** - Were expected files created/deleted?
4. **Bug Detection** - Any unexpected errors or deviations?

---

## Input Requirements

| Parameter | Required | Description |
|-----------|----------|-------------|
| `sessionId` | YES | UUID of the session to analyze |
| `targetSkill` | YES | Path to SKILL.md to validate against |
| `additionalRequirements` | NO | Extra validation criteria |

---

## Phase 1: Locate Session Files

### Step 1.1: Find Session Files

DB에서 세션 메타 조회:
```bash
node ~/.claude/my-claude-plugins/shared/query-sessions.js get <sessionId>
# → file_path 필드로 소스 파일 위치 확인
```

이후 분석에 필요한 파일:
```bash
# Debug log (detailed)
~/.claude/debug/{sessionId}.txt

# Agent transcripts (if subagents were used)
# → file_path 기반으로 같은 디렉토리의 agent-{agentId}.jsonl 탐색
```

### Step 1.2: Verify Files Exist

Check all required files exist before proceeding. If debug log is missing, analysis will be limited.

---

## Phase 2: Parse Target SKILL.md

### Step 2.1: Extract Expected Components

Read the target SKILL.md and identify:

**From YAML Frontmatter:**
- `hooks.PreToolUse` - Expected PreToolUse hooks and matchers
- `hooks.PostToolUse` - Expected PostToolUse hooks
- `hooks.Stop` - Expected Stop hooks
- `hooks.SubagentStop` - Expected SubagentStop hooks
- `allowed-tools` - Tools the skill is allowed to use

**From Markdown Body:**
- SubAgents mentioned (`Task(subagent_type="...")`)
- Skills called (`Skill("...")`)
- Artifacts created (`.dev-flow/drafts/`, `.dev-flow/plans/`, etc.)
- Workflow steps and conditions

### Step 2.2: Build Expected Behavior Checklist

Create checklist from SKILL.md analysis:

```markdown
## Expected Behavior

### SubAgents
- [ ] Explore agent called (parallel, run_in_background)
- [ ] gap-analyzer called before plan generation
- [ ] reviewer called after plan creation

### Hooks
- [ ] PreToolUse[Edit|Write] triggers plan-guard.sh
- [ ] Stop hook validates reviewer approval

### Artifacts
- [ ] Draft file created at .dev-flow/drafts/{name}.md
- [ ] Plan file created at .dev-flow/plans/{name}.md
- [ ] Draft file deleted after OKAY

### Workflow
- [ ] Interview Mode before Plan Generation
- [ ] User explicit request triggers plan generation
- [ ] Reviewer REJECT causes revision loop
```

---

## Phase 3: Analyze Debug Log

The debug log (`~/.claude/debug/{sessionId}.txt`) contains detailed execution traces.

### Step 3.1: Extract SubAgent Calls

Search patterns:
```
SubagentStart with query: {agent-name}
SubagentStop with query: {agent-id}
```

Use script:
```bash
node scripts/extract-subagent-calls.mjs {debug-log-path}
```

### Step 3.2: Extract Hook Events

Search patterns:
```
Getting matching hook commands for {HookEvent} with query: {tool-name}
Matched {N} unique hooks for query "{query}"
Hooks: Processing prompt hook with prompt: {prompt}
Hooks: Prompt hook condition was met/not met
permissionDecision: allow/deny
```

Use script:
```bash
node scripts/extract-hook-events.mjs {debug-log-path}
```

### Step 3.3: Extract Tool Calls

Search patterns:
```
executePreToolHooks called for tool: {tool-name}
File {path} written atomically
```

### Step 3.4: Extract Hook Results

For prompt-based hooks, find the model response:
```
Hooks: Model response: {
  "ok": true/false,
  "reason": "..."
}
```

---

## Phase 4: Verify Artifacts

### Step 4.1: Check File Creation

For each expected artifact:
1. Search debug log for `FileHistory: Tracked file modification for {path}`
2. Search for `File {path} written atomically`
3. Verify current filesystem state

### Step 4.2: Check File Deletion

For files that should be deleted:
1. Search for `rm` commands in Bash calls
2. Verify file no longer exists on filesystem

---

## Phase 5: Compare Expected vs Actual

### Step 5.1: Build Comparison Table

```markdown
| Component | Expected | Actual | Status |
|-----------|----------|--------|--------|
| Explore agent | 2 parallel calls | 2 calls at 09:39:26 | ✅ |
| gap-analyzer | Called before plan | Called at 09:43:08 | ✅ |
| reviewer | Called after plan | 2 calls (REJECT→OKAY) | ✅ |
| PreToolUse hook | Edit\|Write matcher | Triggered for Write | ✅ |
| Stop hook | Validates approval | Returned ok:true | ✅ |
| Draft file | Created then deleted | Created→Deleted | ✅ |
| Plan file | Created | Exists (10KB) | ✅ |
```

### Step 5.2: Identify Deviations

Flag any mismatches:
- Missing component calls
- Wrong order of operations
- Hook failures
- Missing artifacts
- Unexpected errors

---

## Phase 6: Generate Report

### Report Template

```markdown
# Session Analysis Report

## Session Info
- **Session ID**: {sessionId}
- **Target Skill**: {skillPath}
- **Analysis Date**: {date}

---

## 1. Expected Behavior (from SKILL.md)

[Summary of expected workflow]

---

## 2. Skill/SubAgent/Hook Verification

### SubAgents
| SubAgent | Expected | Actual | Time | Result |
|----------|----------|--------|------|--------|
| ... | ... | ... | ... | ✅/❌ |

### Hooks
| Hook | Matcher | Triggered | Result |
|------|---------|-----------|--------|
| ... | ... | ... | ✅/❌ |

---

## 3. Artifacts Verification

| Artifact | Path | Expected State | Actual State |
|----------|------|----------------|--------------|
| ... | ... | ... | ✅/❌ |

---

## 4. Issues/Bugs

| Severity | Description | Location |
|----------|-------------|----------|
| ... | ... | ... |

---

## 5. Overall Result

**Verdict**: ✅ PASS / ❌ FAIL

**Summary**: [1-2 sentence summary]
```

---

## Scripts Reference

| Script | Purpose |
|--------|---------|
| `extract-subagent-calls.mjs` | Parse subagent invocations from debug log |
| `extract-hook-events.mjs` | Parse hook events from debug log |

---

## Usage Example

```
User: "Analyze session 3cc71c9f-d27a-4233-9dbc-c4f07ea6ec5b against .claude/skills/specify/SKILL.md"

1. Find session files
2. Parse SKILL.md → Expected: Explore, gap-analyzer, reviewer, hooks
3. Analyze debug log → Extract actual calls
4. Verify artifacts → Check .dev-flow/
5. Compare → Build verification table
6. Generate report → PASS/FAIL with details
```

---

## Additional Resources

### Reference Files
- **`references/analysis-patterns.md`** - Detailed grep patterns for log analysis
- **`references/common-issues.md`** - Known issues and troubleshooting

### Scripts
- **`scripts/extract-subagent-calls.mjs`** - SubAgent call extractor
- **`scripts/extract-hook-events.mjs`** - Hook event extractor
