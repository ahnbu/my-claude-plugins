---
name: history-insight
description: This skill should be used when user wants to access, capture, or reference Claude Code session history. Trigger when user says "capture session", "save session history", or references past/current conversation as a source - whether for saving, extracting, summarizing, or reviewing. This includes any mention of "what we discussed", "today's work", "session history", or when user treats the conversation itself as source material (e.g., "from our conversation").
version: 1.1.0
user-invocable: true
---

# History Insight

Claude Code 세션 히스토리를 분석하고 인사이트를 추출합니다.

---

## Data Location

세션 데이터는 세션DB를 통해 조회한다:
```bash
node ~/.claude/my-claude-plugins/shared/query-sessions.js recent [N]
node ~/.claude/my-claude-plugins/shared/query-sessions.js by-project <name>
node ~/.claude/my-claude-plugins/shared/query-sessions.js doc <sessionId> --no-sync
```

Claude/Codex/Gemini 3개 AI 공통 세션DB. 스키마 참조: `SESSION-DB.md`

---

## Execution Algorithm

### Step 1: Ask Scope [MANDATORY]

**스코프 결정:**

1. **명시된 경우** (AskUserQuestion 생략 가능):
   - "현재 프로젝트만" / "이 프로젝트" → `current_project`
   - "모든 세션" / "전체" → `all_sessions`

2. **명시되지 않은 경우** - AskUserQuestion 호출:
   ```
   question: "세션 검색 범위를 선택하세요"
   options:
     - "현재 프로젝트만" → ~/.claude/projects/<encoded-cwd>/*.jsonl
     - "모든 Claude Code 세션" → ~/.claude/projects/**/*.jsonl
   ```

---

### Step 2: Find Session Files

```bash
# 현재 프로젝트
node ~/.claude/my-claude-plugins/shared/query-sessions.js by-project <project-name> --limit 50

# 전체 세션
node ~/.claude/my-claude-plugins/shared/query-sessions.js recent 50
```

**필터링**: `--scope <claude|codex|gemini>` 옵션으로 AI 소스 필터. 날짜 필터는 DB의 `timestamp`/`last_timestamp` 필드 활용 (`stat` 불필요).

---

### Step 3: Process Sessions

#### Decision Tree

```
Session files found?
├─ No → Error: "No sessions found"
└─ Yes → How many files?
    ├─ 1-3 files → Direct Read + parse
    └─ 4+ files → Batch Extract Pipeline
```

#### 1-3 Sessions

```bash
node ~/.claude/my-claude-plugins/shared/query-sessions.js doc <sessionId> --no-sync
```

직접 `doc` 출력으로 대화 내용 추출.

#### 4+ Sessions: Batch Extract Pipeline

1. 캐시 디렉토리 생성 (`/tmp/cc-cache/<analysis-name>/`)
2. 세션 목록 저장 (`sessions.txt`)
3. 각 세션 `doc --no-sync` 결과를 파일로 리다이렉트 (`session_<id>.md`)
4. 정리 및 필터링 (`clean_messages.txt`)
5. Task(opus)로 종합 분석

#### 파일이 너무 클 때: 병렬 배치 분석

`clean_messages.txt`가 너무 커서 Read 실패 시:

1. **파일 분할**:
   ```bash
   split -l 2000 clean_messages.txt /tmp/cc-cache/<name>/batch_
   ```

2. **병렬 Task(opus) 호출**:
   ```
   Task(subagent_type="general-purpose", model="opus", run_in_background=true)
   prompt: "batch_XX 파일을 읽고 주제/패턴 요약해줘"
   ```

3. **결과 병합**: Task(opus)로 종합

---

### Step 4: Report Results

분석 결과를 출력하고, `${SKILL_DIR}/history-insights-report/` 폴더에 자동 저장한다.

**파일명**: `{요약}_YYYYMMDD.md` (한국어 2~4단어 요약)

```markdown
## Session Capture Complete

- **Sessions:** N files processed
- **Messages:** X total, Y after filter

### Extracted Insights
[분석 결과]
```

저장 후 경로를 사용자에게 출력한다.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| No session files found | "No session files found for this project." |
| Session too large | `doc` 출력 분할 후 배치 분석 |
| jq not installed | "Error: jq is required. Install with: brew install jq" |
| Task failed | "Warning: Could not process [file]. Skipping." |
| 0 relevant sessions | "No sessions matched your criteria." |

---

## Security Notes

- 출력에 전체 경로 노출 금지 (`~` prefix 사용)

---

## Related Resources

- **`SESSION-DB.md`** - 세션DB 스키마 및 쿼리 가이드
