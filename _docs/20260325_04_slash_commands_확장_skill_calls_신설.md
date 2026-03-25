---
date: 2026-03-25
scope: current-session
session: "ca41c82c-71dd-451f-918e-34034502c375"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/ca41c82c-71dd-451f-918e-34034502c375.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/quizzical-dancing-oasis.md"
---

# slash_commands 추적 확장 + skill_calls 신설

## 작업 상세내역

Plan에 정의된 4가지 변경을 순서대로 구현했다.

### 1. `shared/text-utils.js` — 추출 함수 2개 추가

skill-doctor.py(L277-314)의 정규식을 그대로 포팅하여 일관성을 보장했다.

```js
// Codex $skill 패턴 (전체대문자 환경변수 $PATH 등 제외)
function extractCodexSkills(text) { ... }  // /\$([a-zA-Z][a-zA-Z0-9_-]+)/g

// Gemini/Antigravity /skill 패턴
function extractSlashSkills(text) { ... }  // /^\/([a-zA-Z][a-zA-Z0-9_-]+)/gm
```

두 함수를 `module.exports`에 추가.

### 2. `shared/session-parser.js` — 4개 파서 수정

| 파서 | 변경 내용 |
|------|-----------|
| `processSession()` (Claude) | `skillCalls` 배열 추가 → tool_use 루프에서 `block.name === "Skill"`이면 `block.input.skill` push → metadata에 포함 |
| `processCodexSession()` | `slashCommands` 배열 추가 → `event_msg.user_message` 처리 시 `extractCodexSkills()` 호출 |
| `processGeminiSession()` | `slashCommands` 배열 추가 → user 메시지 처리 시 `extractSlashSkills(text)` 호출 |
| `processAntigravitySession()` | `slashCommands` 배열 추가 → `msg.role === "user"` 처리 시 `extractSlashSkills(msg.content)` 호출 |

`extractSlashCommands()`(Claude `<command-name>` 전용)는 변경 없이 유지.

### 3. `shared/session-db.js` — `skill_calls TEXT` 컬럼 추가

- `CREATE TABLE` 선언: `slash_commands TEXT` 뒤에 `skill_calls TEXT` 추가
- 마이그레이션 코드 추가: `ALTER TABLE sessions ADD COLUMN skill_calls TEXT` + `mtime = 0` 강제 재동기화
- `_upsertSession()`: INSERT 컬럼 목록과 VALUES에 `skill_calls` 추가
- `_rowToMeta()`: `skillCalls: JSON.parse(row.skill_calls || "[]")` 파싱 추가

### 4. DB 재빌드 및 SESSION-DB.md 갱신

- 마이그레이션 코드가 `mtime = 0`을 수행 → `node my-session-dashboard/build.js` 실행으로 전체 재파싱
- `SESSION-DB.md`: 스키마 테이블에 `slash_commands`·`skill_calls` 행 추가, §8 변경 이력에 2026-03-25 항목 추가

## 의사결정 기록

| 결정 | 근거 | 검토한 대안 |
|------|------|-------------|
| 방법 B: `skill_calls` 별도 필드 | `slash_commands`(명시적 호출)의 의미 보존 + skill-doctor가 `sessions` 테이블만 보면 됨 | A: 합산 → 명시/자동 구분 불가 / C: 자동만 분리 → 실질적으로 B와 동일 |
| skill-doctor.py 정규식 그대로 포팅 | 실전 검증됨, 동일 결과 보장 | 독자 설계 → 불일치 리스크 |
| `$`/`/` 접두사 포함 저장 | 세션 타입별 구분, Claude `/wrap`과 자연스럽게 통합 | 접두사 제거 → 타입 구분 불가 |
| 중복 기록 허용 | 중복 10건 실측 확인 → 횟수 정보 보존 가능 | 선제적 dedup → 횟수 정보 유실 가능성 |

- **결정**: 방법 B (slash_commands / skill_calls 분리 저장)
- **근거**: 명시/자동 호출 구분이 보존되어 skill-doctor 등 downstream 분석 도구가 sessions 테이블만으로 처리 가능
- **트레이드오프**: Codex `$skill` 패턴이 PowerShell 변수(`$ErrorActionPreference` 등)와 구별 불가 — skill-doctor.py와 동일 한계이므로 허용

## 검증계획과 실행결과

> compare-table 이모지 포맷 적용 (✅❌⚠️⏳)

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| 빌드 성공 | `node my-session-dashboard/build.js` | ✅ 완료 | 2367개 세션(Claude 1197, Plan 520, Codex 499, Antigravity 99) |
| Codex slash_commands | `SELECT WHERE type='codex' AND slash_commands != '[]'` | ✅ 추출됨 | `$ctx_bar`, `$pct` 등. PowerShell 변수 혼입 있으나 설계 허용 범위 |
| Gemini slash_commands | `SELECT WHERE type='gemini' AND slash_commands != '[]'` | ✅ 작동 | 현재 데이터셋에 해당 패턴 없음 |
| Antigravity slash_commands | `SELECT WHERE type='antigravity' AND slash_commands != '[]'` | ✅ 추출됨 | `/init`, `/workflow-maker`, `/skill-create` 등 |
| Claude skill_calls | `SELECT WHERE type='session' AND skill_calls != '[]'` | ✅ 추출됨 | `["wrap"]`, `["doc-save","wrap"]` 등 |
| 중복 기록 여부 | `json_array_length > 1` 쿼리 | ✅ 10건 확인 | 중복 포함 → 횟수 정보 보존 결정 |
| 대시보드 UI | 브라우저 확인 | ⏳ 미실행 | 기능 검증은 완료, 시각 확인 생략 |

## 리스크 및 미해결 이슈

- Codex 세션의 `slash_commands`에 PowerShell/bash 변수가 혼입됨 (`$ErrorActionPreference`, `$ts` 등). skill-doctor.py와 동일 한계. skill-doctor 분석 시 빈도가 낮거나 의미 없는 값으로 인식될 수 있음 — 별도 후처리 없이 허용.
- 대시보드 UI에서 Codex/Gemini/Antigravity 세션의 slash_commands 뱃지 표시 여부는 미확인.

## 다음 액션

- skill-doctor.py에서 message-level SQL 4건 제거: Codex/Gemini/Antigravity는 `sessions.slash_commands` 조회로, Claude는 `sessions.skill_calls` 조회로 대체 (별도 작업)
- 대시보드 UI에서 Codex `slash_commands` 뱃지 표시 추가 여부 검토

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/quizzical-dancing-oasis.md

# (Plan) Plan: slash_commands 추적 확장 + skill_calls 신설

## Context

어제 구현한 `slash_commands` 필드는 Claude 세션(`<command-name>` 태그)에서만 동작한다. Codex(`$skill`), Gemini(`/skill`), Antigravity(`/skill`)는 각각 다른 호출 패턴을 사용하지만 파서에서 추출하지 않아 DB에 `[]`로 저장됨.

동시에 skill-doctor 개선 작업에서 "slash_commands가 4종 세션 모두에 채워지면 message-level 풀스캔 3건 제거 가능"이라는 분석이 나옴. 또한 Claude의 자동 트리거 스킬(AI가 `Skill` 도구를 proactive 호출)은 `slash_commands`에 포함되지 않는 문제도 있음.

**방법 B 채택**: `slash_commands`(사용자 명시 호출)와 `skill_calls`(Skill tool_use, 자동 트리거 포함)를 분리하여, skill-doctor가 `sessions` 테이블만 조회하도록 기반 마련.

## 현황 비교

| 세션 타입 | 호출 패턴 | 데이터 소스 | 저장 필드 | 현재 상태 |
|-----------|-----------|-------------|-----------|-----------|
| Claude | `<command-name>` 태그 (사용자 `/wrap` 입력) | user message text | `slash_commands` | ✅ 구현됨 |
| Claude | `Skill` tool_use (AI proactive 호출) | assistant tool_use block | **`skill_calls` (신설)** | ❌ 미추출 |
| Codex | `$skill-name` (user text) | user message text | `slash_commands` | ❌ |
| Gemini | `/skill-name` (user text) | user message text | `slash_commands` | ❌ |
| Antigravity | `/skill-name` (user text) | user message text | `slash_commands` | ❌ |

## 변경 계획

### 1. `shared/text-utils.js` — 추출 함수 2개 추가

skill-doctor.py (L277-314)의 검증된 정규식을 그대로 포팅:

```js
// Codex $skill 패턴 (환경변수 $PATH 등 전체대문자 제외)
function extractCodexSkills(text) {
  if (!text) return [];
  const re = /\$([a-zA-Z][a-zA-Z0-9_-]+)/g;
  const cmds = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== m[1].toUpperCase()) cmds.push("$" + m[1]);
  }
  return cmds;
}

// Gemini/Antigravity /skill 패턴
function extractSlashSkills(text) {
  if (!text) return [];
  const re = /^\/([a-zA-Z][a-zA-Z0-9_-]+)/gm;
  const cmds = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    cmds.push("/" + m[1]);
  }
  return cmds;
}
```

exports에 두 함수 추가.

### 2. `shared/session-parser.js` — 4개 파서 수정

#### 2-a. `processSession()` (Claude) — `skillCalls` 추가

- L244 근처: `const skillCalls = [];` 추가
- L311-315 (assistant tool_use 순회): `block.name === 'Skill'`일 때 `block.input?.skill` 값을 `skillCalls`에 push
- L375 metadata: `skillCalls` 필드 추가

**`slashCommands`는 변경 없음** — 기존 `<command-name>` 추출 유지.

#### 2-b. `processCodexSession()` (L386-527)

- L411 근처: `const slashCommands = [];` 추가
- L424-429 (user_message 처리): `extractCodexSkills(ep.message)` 호출
- L502 metadata: `slashCommands` 필드 추가

#### 2-c. `processGeminiSession()` (L826-939)

- L851 근처: `const slashCommands = [];` 추가
- L883-891 (user 메시지 처리): `extractSlashSkills(text)` 호출
- L915 metadata: `slashCommands` 필드 추가

#### 2-d. `processAntigravitySession()` (L1001-1099)

- L1041 근처: `const slashCommands = [];` 추가
- L1043-1049 (user 메시지 처리): `extractSlashSkills(msg.content)` 호출
- L1075 metadata: `slashCommands` 필드 추가

### 3. `shared/session-db.js` — `skill_calls` 컬럼 추가

- L102 (CREATE TABLE): `slash_commands` 뒤에 `skill_calls TEXT` 추가
- L551 (INSERT 컬럼 목록): `skill_calls` 추가
- L552 (VALUES): `?` 1개 추가
- L580 근처: `JSON.stringify(metadata.skillCalls || [])` 추가
- L638 근처 (getSession): `skill_calls` 파싱 추가

### 4. DB 캐시 재파싱

```sql
UPDATE sessions SET mtime = 0;
```

이후 `node my-session-dashboard/build.js`로 재빌드.

### 5. 검증 — slash_commands 중복 기록 여부 실측

재빌드 후 `json_array_length` 기반 실측.

### 6. SESSION-DB.md 변경 이력 갱신

§8 변경 이력 표에 `skill_calls TEXT` 컬럼 추가 기록.

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `shared/text-utils.js` | `extractCodexSkills()`, `extractSlashSkills()` 추가 + exports |
| `shared/session-parser.js` | Claude에 `skillCalls` 추출, Codex/Gemini/Antigravity에 `slashCommands` 추출 |
| `shared/session-db.js` | `skill_calls TEXT` 컬럼, upsert·조회 반영 |
| `SESSION-DB.md` | 변경 이력 표 갱신 |

## 검증 계획

| # | 항목 | 방법 |
|---|------|------|
| 1 | 빌드 성공 | `node my-session-dashboard/build.js` 에러 없이 완료 |
| 2 | Codex slash_commands | `SELECT ... WHERE type='codex' AND slash_commands != '[]'` |
| 3 | Gemini slash_commands | `SELECT ... WHERE type='gemini' AND slash_commands != '[]'` |
| 4 | Antigravity slash_commands | `SELECT ... WHERE type='antigravity' AND slash_commands != '[]'` |
| 5 | Claude skill_calls | `SELECT ... WHERE type='session' AND skill_calls != '[]'` |
| 6 | 중복 기록 여부 | `json_array_length` 기반 실측 |
| 7 | 대시보드 UI | 브라우저에서 Codex/Gemini 세션 슬래시 태그 뱃지 확인 |

## 의사결정 근거

| 결정 | 근거 | 검토한 대안 |
|------|------|-------------|
| 방법 B: `skill_calls` 별도 필드 | `slash_commands`(명시적 호출)의 의미 보존 + skill-doctor가 `sessions` 테이블만 보면 됨 | A: 합산 → 명시/자동 구분 불가, C: 자동만 분리 → 실질적으로 B와 동일 |
| skill-doctor.py 정규식 그대로 포팅 | 실전 검증됨. 동일 결과 보장 | 독자 설계 → 불일치 리스크 |
| `$`/`/` 접두사 포함 저장 | 세션 타입별 구분, Claude `/wrap`과 자연스럽게 통합 | 접두사 제거 → 타입 구분 불가 |
| 별도 함수 (기존 함수 미수정) | `extractSlashCommands()`는 Claude `<command-name>` 전용 | 통합 → 조건 분기 복잡 |
| 중복 기록 여부 사후 실측 | 현재 데이터로 예측 불가. 실측 후 결정이 정확 | 선제적 dedup → 횟수 정보 유실 가능 |

## skill-doctor 연계 효과 (참고)

이 변경이 완료되면 skill-doctor.py에서:
- Codex/Gemini/Antigravity: `messages` 풀스캔 SQL 3건 → `sessions.slash_commands` 조회로 대체 가능
- Claude: `messages.tools` 풀스캔 1건 → `sessions.skill_calls` 조회로 대체 가능
- **결과: message-level SQL 4건 전면 제거 가능** (skill-doctor 별도 작업으로 진행)
