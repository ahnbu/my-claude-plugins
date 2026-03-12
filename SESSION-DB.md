# SESSION-DB.md — 세션 DB 레퍼런스

> 실제 코드(`session-db.js`, `session-parser.js`, `query-sessions.js`) 기준 단일 진실 공급원.
> 이슈 이력 문서가 아닌 **현재 상태** 기준.

| 항목 | 값 |
|------|-----|
| 작성일 | 2026-03-12 |
| 최종 수정일 | 2026-03-12 |
| 기준 커밋 | `898637f` |

---

## 1. 개요

Claude/Plan/Codex/**Gemini** 소스를 SQLite로 통합하여 세션 메타데이터·메시지·이벤트를 단일 DB로 관리.

| 항목 | 값 |
|------|-----|
| 기술 | `node:sqlite` 내장 모듈 (Node.js 22.5+) |
| 저널 모드 | WAL |
| DB 경로 (정본) | `output/session-dashboard/sessions.db` (`__dirname` 상대경로 기준) |

---

## 2. 스키마 레퍼런스

### sessions

세션 메타데이터. Claude/Plan/Codex/Gemini 공용 + 타입별 전용 컬럼.

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `session_id` | TEXT PK | — | Claude: UUID / Plan: `plan:<slug>` / Codex: `codex:<UUID>` / Gemini: `gemini:<UUID>` |
| `type` | TEXT NOT NULL | `'session'` | `'session'` \| `'plan'` \| `'codex'` \| `'gemini'` |
| `title` | TEXT | NULL | `YYYYMMDD_HHMM_<키워드>` 형식 자동 생성 |
| `keywords` | TEXT | NULL | JSON 배열 (최대 3개) |
| `timestamp` | TEXT NOT NULL | — | 세션 시작 ISO 8601 |
| `last_timestamp` | TEXT | NULL | 마지막 엔트리 타임스탬프 |
| `project` | TEXT | NULL | 작업 디렉토리 경로 (정규화) |
| `git_branch` | TEXT | NULL | git 브랜치명 |
| `models` | TEXT | NULL | JSON 배열 (사용 모델명) |
| `user_entry_count` | INTEGER | 0 | 전체 user 타입 엔트리 수 (tool_result 포함) |
| `user_text_message_count` | INTEGER | 0 | 실제 사용자 텍스트 입력 수 (isMeta 제외) |
| `tool_result_count` | INTEGER | 0 | tool_result 블록 총 수 |
| `tool_use_count` | INTEGER | 0 | tool_use 블록 총 수 |
| `total_input_tokens` | INTEGER | 0 | 입력 토큰 합 (cache_creation/cache_read 포함) |
| `total_output_tokens` | INTEGER | 0 | 출력 토큰 합 |
| `tool_names` | TEXT | NULL | JSON 객체 `{ 도구명: 호출횟수 }` |
| `first_message` | TEXT | NULL | 첫 사용자 메시지 (최대 200자) |
| `file_path` | TEXT | NULL | 소스 JSONL/MD 절대 경로 |
| `mtime` | REAL | NULL | 소스 파일 `mtimeMs` (증분 sync 비교용) |
| `slug` | TEXT | NULL | **plan 전용** — 파일명 기반 slug |
| `is_completed` | INTEGER | 0 | **plan 전용** — 완료 여부 (0/1) |
| `char_count` | INTEGER | 0 | **plan 전용** — 플랜 원문 문자 수 |
| `linked_session_id` | TEXT | NULL | **plan 전용** — 연결된 Claude 세션 ID |
| `plan_slug` | TEXT | NULL | **session 전용** — JSONL에서 읽힌 플랜 참조 slug |
| `originator` | TEXT | NULL | **codex 전용** — 호출 출처 (기본 `codex_cli_rs`) |

### messages

세션 대화 내용. 연속 assistant 청크는 병합되어 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `session_id` | TEXT NOT NULL | sessions.session_id 참조 |
| `seq` | INTEGER NOT NULL | 메시지 순번 (0부터) |
| `role` | TEXT NOT NULL | `'user'` \| `'assistant'` |
| `subtype` | TEXT | `user_input` \| `tool_result` \| `meta` (user 한정) |
| `text` | TEXT | 메시지 텍스트 (시스템 태그 제거 후) |
| `timestamp` | TEXT | ISO 8601 |
| `tools` | TEXT | JSON 배열 `[{ name, input }]` |

**PK**: `(session_id, seq)`

### events

타임라인/트랜스크립트용 정규화 이벤트. on-demand 로드 (`syncSingleSession`).

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `session_id` | TEXT NOT NULL | sessions.session_id 참조 |
| `seq` | INTEGER NOT NULL | 에이전트 내 순번 |
| `agent_id` | TEXT NOT NULL | 메인: `''` / 서브에이전트: `agent-<id>` |
| `kind` | TEXT NOT NULL | 이벤트 유형 (하단 참조) |
| `source` | TEXT | `'main'` \| `'subagent'` |
| `timestamp` | TEXT | ISO 8601 |
| `timestamp_ms` | INTEGER | UNIX 밀리초 (정렬용) |
| `data` | TEXT | 나머지 필드 JSON 직렬화 |

**PK**: `(session_id, agent_id, seq)`

**kind 값**:

| kind | 발생 조건 |
|------|---------|
| `user_text` | 사용자 텍스트 입력 |
| `tool_result` | 도구 결과 반환 |
| `assistant_text` | assistant 텍스트 응답 |
| `assistant_thinking` | 확장 사고 블록 |
| `tool_use` | 도구 호출 |
| `progress` | 훅/서브에이전트 진행 이벤트 |
| `turn_duration` | 턴 소요시간 (`system` 타입 엔트리) |
| `plan_content` | 플랜 원문 삽입 이벤트 |

### plan_contents

플랜 원문 저장.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `session_id` | TEXT PK | `plan:<slug>` 형식 |
| `content` | TEXT NOT NULL | 플랜 MD 원문 전체 |

### 인덱스

```sql
CREATE INDEX idx_sessions_timestamp  ON sessions(timestamp);
CREATE INDEX idx_events_session      ON events(session_id);
CREATE INDEX idx_sessions_plan_slug  ON sessions(plan_slug);
CREATE INDEX idx_sessions_file_path  ON sessions(file_path);
```

---

## 3. 데이터 흐름

```
소스 파일
  ├── ~/.claude/projects/<proj>/<UUID>.jsonl          (Claude 세션)
  ├── ~/.claude/plans/<slug>.md                       (Plan)
  ├── ~/.codex/sessions/<year>/<mon>/<day>/*.jsonl    (Codex)
  └── ~/.gemini/tmp/<proj-alias>/chats/session-*.json (Gemini)
           │
           ▼
  session-parser.js (파싱)
    processSession()         → Claude metadata + messages
    processCodexSession()    → Codex metadata + messages
    processGeminiSession()   → Gemini metadata + messages
    parsePlan()              → Plan metadata + content
    normalizeEntries()       → Claude events
    normalizeCodexEntries()  → Codex events
    normalizeGeminiEntries() → Gemini events
           │
           ▼
  session-db.js :: SessionDB
    sync()               → 증분 upsert (전체)
    syncSingleSession()  → 단건 force upsert (Stop 훅)
           │
           ▼
    sessions.db
           │
     ┌─────┴──────────────────────┐
     │                            │
  build.js                 query-sessions.js
  → HTML 대시보드            → CLI 쿼리
                         session-loader.js
                         → file_path 조회 + events 로드
```

---

## 4. 파일 맵

| 파일 | 역할 | R/W |
|------|------|-----|
| `shared/session-db.js` | `SessionDB` 클래스 — 초기화·sync·upsert·조회 | R+W |
| `shared/session-parser.js` | JSONL/Plan/Codex/Gemini 파싱 + 이벤트 정규화 | R |
| `shared/text-utils.js` | 텍스트 유틸 (getTextContent, findToolUses 등) | — |
| `shared/query-sessions.js` | CLI 쿼리 도구 | R |
| `my-session-dashboard/build.js` | 빌드 엔트리 — sync → getAllMeta → HTML 생성 | R+W |
| `my-session-wrap/hooks/sync-session-stop.js` | Stop 훅 — `syncSingleSession(force)` 즉시 실행 | W |
| `my-session-wrap/lib/session/session-loader.js` | DB 우선 events 로드 (JSONL 폴백) | R |

---

## 5. 동기화 메커니즘

### 증분 sync (`SessionDB.sync()`)

1. DB에서 전체 `session_id → mtime` 맵 로드
2. 소스 파일 순회 → 파일 `mtimeMs` vs DB `mtime` 비교
3. 변경된 파일만 파싱 → `_upsertSession` + `_upsertMessages`
4. 전체 트랜잭션 (`BEGIN / COMMIT / ROLLBACK`)

### Stop 훅 즉시 upsert (`sync-session-stop.js`)

- 세션 종료 시 `syncSingleSession(sessionId, { force: true })` 호출
- `events` 테이블에 이미 데이터가 있어도 force 옵션으로 재동기화

### 서브에이전트 처리

- 메인 JSONL 경로에서 `<session_id>/subagents/agent-*.jsonl` 탐색
- 각 파일을 `normalizeEntries()` → `_upsertEvents(agentId)` 로 저장
- `events.agent_id = ''` (메인) / `events.agent_id = 'agent-<id>'` (서브에이전트)

### 마이그레이션 패턴

기존 DB에 컬럼 추가 시:
```js
ALTER TABLE sessions ADD COLUMN <new_col> <type> DEFAULT <val>;
UPDATE sessions SET mtime = 0;  // 강제 재동기화
```

기존 컬럼 리네임 (`message_count → user_entry_count`) 시:
```js
ALTER TABLE sessions RENAME COLUMN message_count TO user_entry_count;
```

---

## 6. CLI 쿼리 API

```
node shared/query-sessions.js <command> [args] [options]
```

### 명령어

| 명령어 | 인자 | 설명 |
|--------|------|------|
| `search` | `<keyword>` | title, keywords, tool_names, first_message LIKE 검색 |
| `get` | `<session_id>` | 단건 메타데이터 조회 |
| `recent` | `[N]` | 최근 N개 세션 (기본 10) |
| `by-tool` | `<tool>` | 특정 도구 사용 세션 (tool_names LIKE) |
| `by-project` | `<name>` | 특정 프로젝트 세션 (project LIKE) |

### 옵션

| 옵션 | 값 | 설명 |
|------|-----|------|
| `--scope` | `claude` \| `codex` \| `plan` \| `gemini` | 타입 필터 (기본: all) |
| `--limit` | N | 결과 수 제한 (기본 10) |

**출력**: JSON → stdout / 에러·사용법 → stderr

### DB 경로 해결 순서

```js
// 1. marketplace 설치 경로 (정본)
../../plugins/marketplaces/my-claude-plugins/output/session-dashboard/sessions.db

// 2. 소스 레포 경로 (폴백)
../output/session-dashboard/sessions.db
```

### 예시

```bash
node shared/query-sessions.js search "doc-save" --scope claude --limit 5
node shared/query-sessions.js recent 10 --scope codex
node shared/query-sessions.js recent 5 --scope gemini
node shared/query-sessions.js get abc123de-e367-...
node shared/query-sessions.js by-tool "session-find"
node shared/query-sessions.js by-project "my-claude-plugins"
```

---

## 7. 확장 가이드 (새 소스 타입 추가)

**Gemini 통합 완료 (2026-03-12)**. 다음 새 소스 타입 추가 시 참고:

| 순서 | 파일 | 작업 내용 |
|------|------|---------|
| 1 | `shared/session-parser.js` | `process<Type>Session()`, `normalize<Type>Entries()` 추가 |
| 2 | `shared/session-db.js` | `constructor`, `sync()`, `_sync<Type>Dir()`, `syncSingleSession()` 수정 |
| 3 | `sessions` 테이블 | 전용 컬럼 필요 시 `_init()` 에 ALTER TABLE + mtime=0 마이그레이션 추가 |
| 4 | `my-session-dashboard/build.js` | `totalNew` 합산 + 로그 메시지에 타입 포함 |
| 5 | `shared/query-sessions.js` | `buildScopeFilter()`에 `--scope <type>` 추가 |
| 6 | `my-session-dashboard/index.html` | 필터·표시 추가 |

### session_id 명명 규칙

- Claude: 파일명 UUID (`<UUID>`)
- Plan: `plan:<slug>` (slug = MD 파일명 베이스)
- Codex: `codex:<UUID>` (파일명 끝 UUID 추출)
- Gemini: `gemini:<UUID>` (JSON 내 `sessionId` 필드)
- **신규 타입**: `<type>:<id>` 패턴 유지 권장

### Gemini 특이사항

- 소스: `~/.gemini/tmp/<project-alias>/chats/session-*.json` (단일 JSON 파일, JSONL 아님)
- 프로젝트 경로: 프로젝트 디렉토리의 `.project_root` 파일에서 읽음
- 동일 sessionId 다중 파일: 같은 UUID를 가진 파일이 여러 개 존재 가능 (자동 저장). 파일명 사전순 정렬 후 처리 → `INSERT OR REPLACE`로 최신 파일이 승리. 이전 파일은 매 sync마다 재파싱(harmless).
- 캐시 키: `file_path` 기준 (`idx_sessions_file_path` 인덱스 활용)
- git_branch: 빈 문자열 (Gemini 세션에 git 정보 미포함)
- 토큰: `input = tokens.input + tokens.cached + tokens.tool`, `output = tokens.output + tokens.thoughts`

---

## 8. 변경 이력

스키마·파일 맵·CLI 변경 시 이 표를 갱신하라. 카테고리: `스키마` / `파일 맵` / `동기화` / `CLI` / `설명`

| 날짜 | 카테고리 | 변경 내용 | 관련 커밋 |
|------|---------|---------|----------|
| 2026-03-12 | 동기화 | `_syncGeminiDir()` — 자동 호출 세션 필터 확장: (claude) 태그도 감지 대상에 추가 (`(codex\|claude)` 정규식 통합) | — |
| 2026-03-12 | 동기화 | `_syncGeminiDir()` — Codex 자동 호출 세션 제외 필터 추가: (codex) 태그 감지 + 60초 미만 지속시간 스킵 | — |
| 2026-03-12 | 스키마·파일 맵·CLI·동기화 | Gemini 세션 통합 (파서·DB·쿼리·빌드), `idx_sessions_file_path` 추가 | — |
| 2026-03-12 | — | 최초 작성 | `898637f` |
