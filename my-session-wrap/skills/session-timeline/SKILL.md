---
name: session-timeline
description: Generate a per-session execution timeline from Claude Code JSONL logs. Triggers: "session timeline", "세션 타임라인", "소요시간 정리", "tool wait", "turn_duration".
---

# Session Timeline

특정 Claude Code 세션 ID의 시간축을 복원한다.

## Workflow

1. `sessionId`를 받는다.
2. `scripts/session_timeline.js`를 실행해 timeline을 생성한다.
3. 기본은 markdown, 분석 파이프라인 연결 시 `--format json`을 사용한다.
4. 대형 `tool_result`는 원문 대신 persisted output 경로와 요약만 유지한다.

## Command

```bash
node skills/session-timeline/scripts/session_timeline.js <sessionId> --format markdown
```
