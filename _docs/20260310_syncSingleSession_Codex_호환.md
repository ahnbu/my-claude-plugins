# syncSingleSession Codex 완전 호환 (Option C)

> 저장일: 2026-03-10 | 원본: `C:/Users/ahnbu/.claude/plans/functional-beaming-gray.md`
> 세션 경로: `C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/3e171fb4-1b17-4de0-b3e1-04f8fbdfe5b2.jsonl`

## 개요

`syncSingleSession()`이 Codex 세션 이벤트를 events 테이블에 제대로 적재하지 못하는 문제를 수정한다.

## 진단 결과

| 계층 | Claude | Codex | 비고 |
|------|--------|-------|------|
| 메타데이터 sync (`sync()`) | ✅ | ✅ | `processCodexSession()` 사용 |
| messages 테이블 | ✅ | ✅ | 동일 |
| events 테이블 (`syncSingleSession()`) | ✅ | ❌ | `normalizeEntries()`가 Claude 포맷만 처리 |

### 문제 3가지

1. **`normalizeEntries()`**: Codex type(`session_meta`/`event_msg`/`response_item`) 전부 무시 → 빈 배열
2. **`_findSessionFile()`**: `~/.claude/projects/`에서 `codex:UUID.jsonl` 탐색 → 파일 없음 에러
3. **호출처**: `sync-session-stop.js`, `session-loader.js` 모두 영향

## 구현 대상 파일

- `C:/Users/ahnbu/.claude/my-claude-plugins/shared/session-parser.js`
- `C:/Users/ahnbu/.claude/my-claude-plugins/shared/session-db.js`

## 구현 단계

### Step 1: normalizeCodexEntries() 추가 — session-parser.js

Codex JSONL 포맷을 events 배열로 변환하는 함수 추가.

| Codex entry | kind |
|---|---|
| `event_msg` / `payload.type === "user_message"` | `user_text` |
| `response_item` / `payload.type === "message"` (role=assistant) | `assistant_text` |
| `response_item` / `payload.type === "function_call"` | `tool_use` |
| `response_item` / `payload.type === "custom_tool_call"` | `tool_use` |

### Step 2: session-db.js 수정

1. `normalizeCodexEntries` import 추가
2. `_findCodexSessionFile(rawId, codexDir)` — DFS로 파일명에 UUID 포함된 `.jsonl` 탐색
3. `syncSingleSession()` Codex 분기: `codex:` prefix 감지 → Codex 파일 탐색 → `normalizeCodexEntries()` 호출

## 대안 비교

| 옵션 | 작업 | 효과 |
|------|------|------|
| A. 안 함 | 없음 | Codex 사용 빈도 낮으면 무해 |
| B. normalizeCodexEntries만 추가 | 중간 | events 파싱은 되지만 파일 탐색 실패 가능 |
| **C. B + _findCodexSessionFile (채택)** | **중간+** | **syncSingleSession 완전 호환** |

## 의사결정 근거

- Codex 사용 빈도가 낮더라도 `sync-session-stop.js`가 모든 Stop 이벤트에서 트리거되므로 무음 실패보다 정상 동작이 낫다
- `processCodexSession()`이 이미 파싱 로직을 구현했으므로 normalizeCodexEntries 추가 비용이 낮다
- 서브에이전트는 Codex에 없으므로 해당 처리는 스킵해도 무방

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| normalizeCodexEntries export 확인 | module.exports에 포함 여부 grep | ✅ 완료 | `session-parser.js:781` |
| syncSingleSession Codex 분기 확인 | `codex:` prefix 분기 코드 grep | ✅ 완료 | `session-db.js:450` |
| _findCodexSessionFile 함수 존재 | 함수 정의 grep | ✅ 완료 | `session-db.js:526` |
| import 업데이트 | session-db.js의 require 라인 확인 | ✅ 완료 | `session-db.js:13` |
