---
title: continue스킬 BC통합 handoff스캔추가
created: 2026-03-27 16:59
tags: my-session-wrap, continue, handoff, refactor
session_id: bc7554f4-93be-40a4-b61d-b4e5a1eb8cc8
session_path: C:/Users/ahnbu/.claude/projects/D--vibe-coding-threads-dm-auto/bc7554f4-93be-40a4-b61d-b4e5a1eb8cc8.jsonl
plan: C:/Users/ahnbu/.claude/plans/iterative-soaring-hummingbird.md
---

# continue 스킬 B/C 통합 — handoff 스캔 추가

## 발단: 사용자 요청

continue 스킬의 경로 B(context-warning)와 경로 C(handoff)가 분리되어 2단계 UX를 강제함.
사용자가 B를 거치고 "건너뛰기"해야 C로 넘어가는 구조 → 단일 스크립트 호출로 두 소스를 함께 조회하여 통번호 목록으로 제시하도록 통합.

추가 요청:
- handoff 섹션에 3일 TTL 추가 (72시간 초과 파일 필터링)
- 섹션 레이블에 유효기간 표시: `[context limit] (최근6시간 이내)` / `[handoff only] (최근3일)`

## 작업 상세내역

### 변경 파일 2개

| 파일 | 변경 내용 |
|------|-----------|
| `…/continue/scripts/find-context-warning.mjs` | `--handoff-dir` 인자 추가, `scanHandoffs()` 함수 추가, 출력 스키마 변경, 3일 TTL 추가 |
| `…/continue/SKILL.md` | 경로 B/C 통합 → 단일 `경로 B: 통합 복원`, 섹션 레이블 유효기간 표기 추가 |

### find-context-warning.mjs 주요 변경

**1. `--handoff-dir` 인자 파싱 추가**
```js
const handoffArgIdx = process.argv.indexOf("--handoff-dir");
const handoffDir = handoffArgIdx !== -1 ? process.argv[handoffArgIdx + 1] : null;
```

**2. `scanHandoffs()` 함수** — 외부 의존성 없이 regex frontmatter 파싱
- CRLF 정규화(`\r\n` → `\n`) 처리: Windows 환경 handoff 파일이 CRLF로 저장됨
- `created` 필드 기준 3일 TTL 필터 적용
- 파일명 역순 정렬(최신순)

**3. 통합 로직**
- context-warning session_id Set 구성
- handoff 분류: 동일 session_id → `context_limit` 항목에 `handoff_path` 부착 / 나머지 → `handoff_only`
- `.pending` 파일에 양 섹션 session_id 통합 포함

**4. 출력 스키마**
```json
{
  "found": true,
  "count": 5,
  "sections": {
    "context_limit": [{ "session_id": "...", "cp": 89, "display": "...", "handoff_path": "..." }],
    "handoff_only":  [{ "session_id": "...", "title": "...", "created": "...", "file_path": "..." }]
  }
}
```
- `count` = 양 섹션 합계
- `found: false` = 양쪽 모두 비어있을 때만

**5. TTL 상수**
```js
const TTL_WARNING_MS = 6 * 60 * 60 * 1000;    // context-warning: 6시간
const TTL_PENDING_MS = 10 * 60 * 1000;         // .pending: 10분
const TTL_HANDOFF_MS = 3 * 24 * 60 * 60 * 1000; // handoff: 3일
```

### SKILL.md 변경

- 경로 B/C 두 섹션 → 단일 `경로 B: 통합 복원`
- handoff 디렉토리 결정 로직 추가 (`git rev-parse` → CWD `_handoff` 폴백)
- 섹션 레이블: `[context limit] (최근6시간 이내)` / `[handoff only] (최근3일)`
- `context_limit` / `handoff_only` 선택 시 분기 로직 명세
- A-2 폴백 참조: `경로 C` → `경로 B`로 수정

### 버그 수정: CRLF frontmatter 파싱 실패

초기 구현에서 handoff_only가 비어야 할 상황에서 0건 반환.
원인: Windows에서 저장된 .md 파일이 CRLF 줄바꿈 → `/^---\n([\s\S]*?)\n---/` 미매칭
수정: `content.replace(/\r\n/g, "\n")` 후 파싱

## 의사결정 기록

| 항목 | 결정 | 근거 |
|------|------|------|
| handoff TTL 기준 | `created` 프론트매터 필드 | 파일 mtime은 이동/복사 시 변경되므로 불안정 |
| frontmatter 파싱 | 자체 regex (`gray-matter` 미사용) | 외부 의존성 추가 없이 구현 가능, 스크립트 독립성 유지 |
| context-warning 0건 시 동작 | handoff 스캔까지 수행 후 종합 판단 | `warningDir` 미존재여도 handoff가 있으면 `found: true` 반환해야 함 |
| `.pending` 파일 위치 | `warningDir` 존재 시에만 생성 | `warningDir` 미존재 시 쓰기 실패 방지 |

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| 스크립트 단위 테스트 — 통합 출력 | `node find-context-warning.mjs --session-id test --handoff-dir D:/vibe-coding/threads-dm-auto/_handoff` | ✅ count:5, context_limit:4, handoff_only:1 | |
| handoff_path 부착 확인 | session_id 매칭 항목에 handoff_path 필드 존재 | ✅ c063a945에 handoff_path 정상 부착 | |
| CRLF 수정 후 재검증 | 동일 스크립트 재실행 | ✅ NO FRONTMATTER → 정상 파싱 | |
| E2E `/continue` 실행 | 다음 세션에서 `/continue` → 통합 목록 표시 확인 | ✅ 통합 목록 5개 정상 출력 | 사용자가 실제 세션에서 확인 |
| handoff 3일 TTL | created 3일 초과 파일 필터링 | ⏳ 미실행 | 오늘 파일만 있어 경계 테스트 불가 |

## 리스크 및 미해결 이슈

- **3일 TTL 경계 테스트 미실행**: `created` 필드가 없는 handoff 파일은 필터링 제외(전체 표시). 오래된 파일에 `created` 없으면 의도치 않게 노출될 수 있음.
- **E2E hook resolved 마킹**: `handoff_only` 항목을 경로 A로 복원 시 PostToolUse hook resolved 마킹이 정상 동작하는지 다음 세션에서 검증 필요.

## 다음 액션

- 3일 TTL 경계 테스트 (임의로 오래된 `created` 값 넣어 확인)
- `handoff_only` 경로 A 복원 후 hook resolved 마킹 동작 E2E 검증

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/iterative-soaring-hummingbird.md

# (Plan) continue 스킬 — B/C 통합 구현 계획

## Context

continue 스킬의 경로 B(context-warning)와 경로 C(handoff)가 분리되어 2단계 UX를 강제함.
사용자가 B를 거치고 "건너뛰기"해야 C로 넘어가는 구조.
→ 단일 스크립트 호출로 두 소스를 함께 조회하고, 통번호 목록으로 제시한다.

## 변경 파일

| 파일 | 변경 유형 |
|------|-----------|
| `~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/find-context-warning.mjs` | 수정 (handoff 스캔 추가) |
| `~/.claude/my-claude-plugins/my-session-wrap/skills/continue/SKILL.md` | 수정 (경로 B/C 통합) |

hook(`resolve-context-warning.js`)은 변경 불필요 — `.pending` 파일 구조 유지.

## Step 1: `find-context-warning.mjs` 확장

### 1-1. 새 인자 `--handoff-dir <경로>`

```js
const handoffArgIdx = process.argv.indexOf("--handoff-dir");
const handoffDir = handoffArgIdx !== -1 ? process.argv[handoffArgIdx + 1] : null;
```

### 1-2. handoff 스캔 함수 추가

```js
function scanHandoffs(dir) {
  // readdirSync → handoff_*.md 필터
  // 각 파일의 frontmatter 파싱 (regex: /^---\n([\s\S]*?)\n---/)
  // session_id, title, created 추출
  // 파일명 역순 정렬 (최신순)
  // 반환: [{ session_id?, title, created, file_path }]
}
```

외부 의존성 없이 regex로 frontmatter 파싱. `gray-matter` 불사용.

### 1-3. 중복 제거 + 통합 출력

```js
// context-warning session_id Set
const cwSessionIds = new Set(entries.map(e => e.session_id));

// handoff 분류
for (const h of handoffs) {
  if (h.session_id && cwSessionIds.has(h.session_id)) {
    // 매칭 → context-warning 항목에 handoff_path 추가
    entries.find(e => e.session_id === h.session_id).handoff_path = h.file_path;
  } else {
    handoffOnly.push(h);
  }
}
```

### 1-4. 출력 JSON 스키마 변경

```json
{
  "found": true,
  "count": 5,
  "sections": {
    "context_limit": [
      { "session_id": "abc", "cp": 89, "ts": "...", "display": "...", "resolved": false, "handoff_path": "..." }
    ],
    "handoff_only": [
      { "session_id": "def", "title": "...", "created": "...", "file_path": "...", "display": "..." }
    ]
  }
}
```

- `count`는 양 섹션 합계
- `found: false`는 양쪽 모두 비어있을 때만
- handoff_only 항목도 `display` 생성: `{title} ({created})`

### 1-5. `.pending` 파일 — 양 섹션의 session_id 통합 포함

```js
const allSessionIds = [
  ...entries.map(e => e.session_id),
  ...handoffOnly.filter(h => h.session_id).map(h => h.session_id)
];
```

### 1-6. context-warning은 0건이지만 handoff가 있는 경우

기존: `warningDir` 미존재 또는 entries 0건이면 `found: false`로 즉시 종료
→ `--handoff-dir` 지정 시 handoff 스캔까지 수행 후 종합 판단으로 변경.

## Step 2: SKILL.md 변경

### 삭제
- 기존 `### 경로 B: context-warning 기반 복원` 전체
- 기존 `### 경로 C: handoff 기반 복원 (기존)` 전체

### 신규 — `### 경로 B: 통합 복원`

```
1. handoff 디렉토리 결정:
   a. `git rev-parse --show-toplevel` → `<root>/_handoff`
   b. 실패 시 CWD의 `_handoff`
   c. 디렉토리 미존재 시 생략
2. 스크립트 호출:
   node ~/.../find-context-warning.mjs --session-id <현재_session_id> [--handoff-dir <path>]
3. found: false → "복원 가능한 세션이 없습니다" 안내 후 종료
4. found: true → 통번호 목록 출력 (AskUserQuestion 사용 금지):

   이전 세션 {count}개:

   [context limit]
   1. {display}         ← handoff_path 있으면 "📎" 표시
      └ {session_id}
   2. {display}
      └ {session_id}

   [handoff only]
   3. {title} ({created})
      └ {session_id 또는 "session_id 없음"}
      └ {file_path}

   0. 건너뛰기

   번호를 입력하세요:

5. context-limit 항목 선택 → 경로 A 실행
   - handoff_path 있으면 완료 후 "관련 handoff: {경로}" 안내
6. handoff-only 항목 선택:
   - session_id 있으면 → 경로 A
   - session_id 없으면 → handoff 파일 직접 Read 후 요약 출력
7. 0 선택 → 종료
```

## 검증

1. **스크립트 단위 테스트**: 현재 프로젝트(`threads-dm-auto`)에 handoff 파일이 1개 있으므로:
   ```bash
   node ~/.../find-context-warning.mjs --session-id test --handoff-dir D:/vibe-coding/threads-dm-auto/_handoff
   ```
   - context-warning + handoff 통합 출력 확인
   - 중복(동일 session_id) 시 context_limit에 handoff_path 추가 확인
   - handoff-only에서 제외 확인

2. **E2E**: 다음 세션에서 `/continue` 실행 → 통합 목록 표시 → 번호 선택 → 경로 A 정상 진입 → hook resolved 마킹
