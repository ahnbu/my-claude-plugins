---
name: session-transcript
description: Generate an analysis-focused transcript from Claude Code JSONL logs. Triggers: "session transcript", "세션 transcript", "대화 흐름 추출", "planContent", "tool_result 정책".
---

# Session Transcript

특정 Claude Code 세션 ID의 분석용 transcript를 생성한다.

## Workflow

1. `sessionId`를 받는다.
2. `scripts/session_transcript.js`를 실행한다.
3. `planContent`는 별도 섹션으로 항상 보존한다.
4. `tool_result`는 `--tool-results` 정책으로 축약한다.

## Command

```bash
node skills/session-transcript/scripts/session_transcript.js <sessionId> --format markdown
```
