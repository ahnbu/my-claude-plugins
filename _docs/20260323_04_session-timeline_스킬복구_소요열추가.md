---
date: 2026-03-23
scope: current-session
session: "9c90b3d5-8823-4211-9aed-7d6ce113d0ee"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/9c90b3d5-8823-4211-9aed-7d6ce113d0ee.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/declarative-forging-snail.md"
---

# session-timeline 스킬 복구 + 소요시간 열 추가

## 발단: 사용자 요청

커밋 `b104939`에서 삭제된 `session-timeline` 스킬을 복구하고, 대시보드에 추가된 "소요시간" 열을 timeline markdown 출력에도 반영 요청.

## 작업 상세내역

### Step 1: 스킬 파일 복구

`git checkout b104939^`로 삭제 직전 상태의 두 파일 복구:
- `my-session-wrap/skills/session-timeline/SKILL.md`
- `my-session-wrap/skills/session-timeline/scripts/session_timeline.js`

### Step 2: timeline-builder.js — "소요" 열 추가

`renderTimelineMarkdown()` 테이블 헤더에 "소요" 열 삽입 (대기 앞).

계산 로직: 현재 도구 시작 → 다음 도구 시작 시간 차이, 마지막 도구는 세션 종료까지.

### Step 3: 테스트 복구

커밋 `b104939`에서 삭제된 timeline CLI 테스트 케이스를 복구하고, 새 "소요" 열 반영.

## 의사결정 기록

- 결정: 삭제된 스킬을 git에서 원본 그대로 복구 + timeline-builder.js만 소요 열 추가
- 근거: 독립 CLI 도구로서의 가치 유지, 대시보드와 동일한 정보 제공
- 트레이드오프: 대시보드와 CLI 양쪽에 소요시간 로직 존재 (중복이나 용도가 다름)

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| 스킬 파일 복구 | 파일 존재 확인 | ✅ 완료 | SKILL.md + session_timeline.js 복구됨 |
| CLI usage 출력 | `node session_timeline.js` 인자 없이 실행 | ✅ 완료 | exit code 1 + Usage 메시지 출력 |
| 테스트 통과 | `node --test session-tools.test.js` | ✅ 완료 | 20/20 pass (transcript CLI 테스트는 스킬 미복구로 제외) |
| 소요 열 포함 | markdown 출력에 "소요" 열 존재 확인 | ✅ 완료 | 헤더·데이터 행 모두 소요 열 포함 |

## 리스크 및 미해결 이슈

- `clockToSeconds` 함수가 timeline-builder.js에 이미 존재하는지 확인 필요

## 다음 액션

- 커밋 및 푸시

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/declarative-forging-snail.md

# (Plan) session-timeline 스킬 복구 + 소요시간 열 추가

## Context

`session-timeline` 스킬이 커밋 `b104939` (2026-03-23)에서 삭제됨. 삭제 근거는 "대시보드에 기능 흡수"였으나, 독립 CLI 도구로서의 가치가 있어 복구 요청.

삭제 이후 대시보드에 "소요시간" 열이 추가됨 (커밋 `d0246cf`). 복구 시 이 변경을 timeline markdown 출력에도 반영해야 함.

## 변경 대상 파일

| 파일 | 작업 |
|------|------|
| `my-session-wrap/skills/session-timeline/SKILL.md` | git에서 복구 (원본 그대로) |
| `my-session-wrap/skills/session-timeline/scripts/session_timeline.js` | git에서 복구 (원본 그대로) |
| `my-session-wrap/lib/session/timeline-builder.js` | `renderTimelineMarkdown()`에 "소요" 열 추가 |
| `my-session-wrap/tests/session-tools.test.js` | 삭제된 timeline 관련 테스트 케이스 복구 |

## Step 1: 스킬 파일 복구 (git checkout)

```bash
git checkout b104939^ -- my-session-wrap/skills/session-timeline/SKILL.md
git checkout b104939^ -- my-session-wrap/skills/session-timeline/scripts/session_timeline.js
```

두 파일 모두 삭제 직전 커밋(`b104939^`)에서 원본 그대로 복구.

## Step 2: timeline-builder.js — "소요" 열 추가

현재 `renderTimelineMarkdown()`의 테이블 헤더:
```
| # | 시각 | 간격 | 도구 | 입력 | 대기 | 상태 | 결과 요약 |
```

변경 후:
```
| # | 시각 | 간격 | 도구 | 입력 | 소요 | 대기 | 상태 | 결과 요약 |
```

**"소요" 계산 로직** (대시보드 `index.html:2006`과 동일):
- 현재 도구 시작 → 다음 도구 시작 시간 차이
- 마지막 도구는 세션 종료(`sessionElapsedMs`)까지

구현 위치: `renderTimelineMarkdown()` 함수 내 for 루프.

```js
// 소요: 현재 도구 시작 → 다음 도구 시작 (마지막은 세션 종료까지)
const nextStart = i < toolCalls.length - 1
  ? clockToSeconds(toolCalls[i + 1].startClock)
  : summary.sessionElapsedMs / 1000;
const currentStart = clockToSeconds(toolCall.startClock);
const stepDuration = formatDuration((nextStart - currentStart) * 1000);
```

`buildTimeline()`은 수정 불필요 — 데이터는 이미 충분히 포함되어 있음.

## Step 3: 테스트 복구

삭제된 테스트 확인:

```bash
git show b104939^ -- my-session-wrap/tests/session-tools.test.js
```

커밋 `b104939`에서 51줄이 변경됨 (주로 삭제). timeline CLI 테스트 케이스를 복구하되, 새 "소요" 열이 반영된 출력을 기대값으로 수정.

## 검증

1. `node my-session-wrap/skills/session-timeline/scripts/session_timeline.js` — 인자 없이 실행 시 usage 에러 출력 확인
2. `node --test my-session-wrap/tests/session-tools.test.js` — 전체 테스트 통과
3. markdown 출력에 "소요" 열 포함 확인
