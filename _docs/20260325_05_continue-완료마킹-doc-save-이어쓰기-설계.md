---
title: /continue 완료 마킹 + doc-save 이어쓰기 설계
created: 2026-03-25 16:58
tags:
  - my-session-wrap
  - continue
  - doc-save
  - hook
session_id: 82f51b4f-3af5-4008-a7dd-4c87c58c3967
session_path: C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/82f51b4f-3af5-4008-a7dd-4c87c58c3967.jsonl
plan: C:/Users/ahnbu/.claude/plans/glittery-crunching-bengio.md
---

# /continue 완료 마킹 + doc-save 이어쓰기 설계

## 발단: 사용자 요청

`/continue` 실행 시 context-warning 세션 목록에서 번호를 선택해도 완료 표시가 없어 다음 실행 시 동일 세션이 반복 노출된다. 두 가지 개선 요청:

1. **완료 마킹**: 번호 선택 시 해당 세션에 `(완료)` 표시
2. **doc-save 이어쓰기**: 이전 세션에서 doc-save로 생성한 문서가 있으면 경로를 제시하여 이어서 업데이트할 수 있게

## 작업 상세내역

### 완료 마킹 — 보장 방식 탐색

초기에는 SKILL.md 지시로 `--resolve` 플래그를 호출하는 방식을 검토했으나, LLM이 지시를 빼먹을 수 있다는 신뢰성 문제 제기.

**탐색한 방식 비교**:

| 방식 | 보장 여부 | 평소 비용 | 구현 복잡도 |
|------|-----------|-----------|-------------|
| SKILL.md 지시 (`--resolve`) | ❌ LLM 의존 | ✅ 없음 | ✅ 낮음 |
| PreToolUse hook | ❌ 도구 주입 불가 | 발동 전체 | ⚠️ 중간 |
| PostToolUse(Bash) 전체 감시 | ✅ 보장 | ❌ 매 Bash 조회 | ⚠️ 중간 |
| PostToolUse + .pending 플래그 | ✅ 보장 | ✅ existsSync 1회 | ⚠️ 중간 |
| `continue-session.mjs` 통합 | ✅ (스크립트 의존) | ✅ 없음 | ✅ 낮음 |

<span style="color:#888">*정렬 기준: 보장 여부가 최우선. 이후 평소 비용 → 구현 복잡도 순.*</span>

**채택: PostToolUse + `.pending_<session_id>` 플래그**

이유:
- 기존 continue 흐름에서 Claude가 반드시 실행하는 Bash 호출 2개를 감지
  - `find-context-warning.mjs` → 목록 생성 (없으면 목록 자체가 안 나옴)
  - `query-sessions.js get <session_id>` → 세션 복원 (없으면 복원 불가)
- 두 호출 모두 스킵할 동기 없음 → 보장
- `.pending` 파일이 없으면 hook이 즉시 return → 평소 비용 최소

### .pending 파일 설계

**멀티 세션 문제**: `.pending` 파일이 하나면 동시 세션에서 덮어쓰기 충돌 발생.

```
세션 A: /continue → .pending 생성 [id1, id2, id3]
세션 B: /continue → .pending 덮어쓰기 [id4, id5]  ← 세션 A 목록 소실
세션 A: 3번 선택 → hook이 .pending 읽음 → id3 없음 → 마킹 실패
```

**해결**: `.pending_<session_id>`로 세션별 분리

**TTL 설계**:

| 파일 | TTL | 근거 |
|------|-----|------|
| `.pending_<session_id>` | **10분** | 목록 표시 → 번호 선택 사이. 10분 넘으면 이미 다른 작업 중 |
| `context-warning/<id>.json` | **6시간** | 만료 세션 이어갈 의사 |
| `doc-save/<id>.json` | **6시간** | 동일 |

### doc-save 경로 탐지 — 방식 탐색

**탐색한 방식**:

| 방식 | 정확도 | 구현 부담 |
|------|--------|-----------|
| DB skill_calls 조회 | ⚠️ skill_calls 출력 미지원 | ❌ query-sessions.js 수정 필요 |
| PostToolUse hook (Write 감지) | ⚠️ _docs/ 수동 편집 오탐 가능 | 중간 |
| PostToolUse hook + SKILL.md Read 플래그 | ✅ 정확 | ❌ 복잡 (플래그 파일 추가) |
| **doc-save 스킬 마지막 단계 직접 기록** | ✅ 오탐 0% | ✅ 낮음 |

**채택: doc-save SKILL.md 마지막 단계에 `save-doc-record.mjs` 추가**

doc-save 스킬이 이미 5~6개 스크립트를 순차 호출하는 구조라 신뢰성 높음. 스킬이 자기가 만든 파일을 직접 기록하므로 오탐 없음.

실제 doc-save 실행 흐름 (세션 타임라인 확인):
```
Read  doc-save/SKILL.md
Bash  find_linked_plan.js      → plan 감지
Bash  find_save_target.js      → 저장 경로
Read  plans/...md               → plan 읽기
Bash  find_plan_versions.js    → 버전 이력
Glob  projects/**/*.jsonl      → 세션 파일
Bash  extract_session_gaps.js  → 누락 검수
Write _docs/YYYYMMDD_NN_...md  ← 여기서 경로 확보
→ (신규) Bash  save-doc-record.mjs   ← 경로 기록
```

### 완성된 아키텍처

```
┌──────────────────────────────────────────────┐
│  기능 1: 완료 마킹 (hook 보장)               │
│                                              │
│  find-context-warning.mjs                    │
│    → 목록 출력 + .pending_<sid> 생성         │
│                                              │
│  PostToolUse(Bash) hook                      │
│    → .pending_<sid> 존재 시에만 활성         │
│    → query-sessions.js get <uuid> 감지       │
│    → uuid가 .pending 목록에 있으면           │
│      → context-warning JSON resolved=true    │
│      → doc-save/<uuid>.json 경로 확인        │
│      → resolved_doc 기록                     │
│      → .pending_<sid> 삭제                   │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  기능 2: doc-save 경로 기록                  │
│                                              │
│  doc-save SKILL.md 마지막 단계               │
│    → save-doc-record.mjs <doc_path>          │
│    → ~/.claude/scripts/doc-save/             │
│      <session_id>.json 저장                  │
│    → {ts, session_id, doc_path}              │
└──────────────────────────────────────────────┘
```

**사용자 관점 최종 흐름**:
```
평소 (continue 안 쓸 때):
  [Bash] → [hook] → .pending_<sid> 있나? → ❌ → return (0.1ms)

/continue 할 때:
  목록 생성 → .pending_<sid> 생성됨
  ↓
  사용자 "3번" 선택
  ↓
  query-sessions.js get <id> 실행
  ↓
  [hook 자동 감지] → .pending ✅ → uuid 매칭 ✅
    → resolved=true 마킹
    → doc-save 경로 확인 → resolved_doc 기록
    → .pending 삭제
  ↓
  다음번 /continue:
    1. (완료) 현재_스킬_중에서 | 88% → _docs/20260325_02_...md
    2. request_interrupted_tool | 83%
    3. 건너뛰기
```

## 의사결정 기록

- **결정**: PostToolUse(Bash) hook + `.pending_<session_id>` 플래그
- **근거**: Claude가 반드시 실행하는 기존 Bash 호출 2개를 감지하므로 추가 스크립트 기억 불필요. 평소엔 `existsSync` 1회로 종료.
- **트레이드오프**:
  - 얻는 것: 완료 마킹 100% 보장, 평소 비용 최소
  - 잃는 것: PostToolUse hook 신규 등록, `.pending_<sid>` 파일 관리

- **결정**: doc-save 스킬 직접 기록 (`save-doc-record.mjs`)
- **근거**: 오탐 0%, 기존 스크립트 체인에 자연스럽게 추가
- **트레이드오프**:
  - 얻는 것: 정확한 경로, 단순한 구현
  - 잃는 것: doc-save SKILL.md 수정 필요 (글로벌 스킬 파일)

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| find-context-warning.mjs .pending 생성 | 실행 후 `.pending_<sid>` 파일 존재 확인 | ⏳ 미실행 | |
| (완료) 접두어 출력 | resolved=true JSON으로 수정 후 재실행 | ⏳ 미실행 | |
| PostToolUse hook 감지 | .pending 생성 후 `query-sessions.js get <uuid>` 실행 → resolved 마킹 + .pending 삭제 | ⏳ 미실행 | |
| hook 평소 비용 | .pending 없을 때 hook이 즉시 return하는지 시간 측정 | ⏳ 미실행 | |
| 멀티 세션 충돌 없음 | 두 세션에서 동시 /continue 후 각자 마킹 확인 | ⏳ 미실행 | |
| save-doc-record.mjs 기록 | doc-save 실행 후 `~/.claude/scripts/doc-save/<sid>.json` 생성 확인 | ⏳ 미실행 | |
| doc-save 경로 제시 | /continue 후 번호 선택 시 doc-save 경로 출력 확인 | ⏳ 미실행 | |
| TTL 정리 (10분/.pending, 6시간/warning+doc-save) | 각 파일 ts 조작 후 재실행 시 삭제 확인 | ⏳ 미실행 | |

## 구현 완료 내역

세션 `82f51b4f`(~17:15)에서 Task 1~5, 세션 `2319a185`에서 Task 6 완료.

| # | 파일 | 내용 | 완료 세션 |
|---|------|------|-----------|
| 1 | `find-context-warning.mjs` | `--session-id` 인자, `.pending_<sid>` 생성, `(완료)` 접두어, TTL 정리 | 82f51b4f |
| 2 | `resolve-context-warning.js` | PostToolUse hook 신규 작성 | 82f51b4f |
| 3 | `save-doc-record.mjs` | doc-save 경로 기록 스크립트 신규 작성 | 82f51b4f |
| 4 | `hooks.json` + `settings.json` | PostToolUse hook 등록 | 82f51b4f |
| 5 | `continue SKILL.md` | 경로 B — `--session-id` 전달, `(완료)` 표시, doc-save 이어쓰기 안내 | 82f51b4f |
| 6 | `doc-save SKILL.md` | Step 9.7에 `save-doc-record.mjs` 호출 지시 추가 | 2319a185 |

**`save-doc-record.mjs` session_id 획득 방식**: CLI 인자(`<session_id> <doc_path>`)로 수신. 환경변수 불필요. → 기존 리스크 해소.

## 리스크 및 미해결 이슈

- doc-save가 여러 파일을 생성하는 경우(드물지만) 마지막 파일만 기록됨
- PostToolUse hook이 `query-sessions.js get <uuid>` 외 다른 방식으로 세션을 복원하는 경로 추가 시 마킹 누락 가능성

## 다음 액션

- E2E 검증: `/continue` 전체 흐름 (목록 → 번호 선택 → resolved 마킹 → 재실행 시 `(완료)` + doc 경로 표시)

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/glittery-crunching-bengio.md

# (Plan) /continue 완료 마킹 + doc-save 이어쓰기

## Context

`/continue` 실행 시 context-warning 세션 목록에서 번호를 선택해도 해당 세션이 "완료"로 표시되지 않아, 다음 실행 시 동일 세션이 반복 노출된다. 또한 이전 세션에서 doc-save로 생성한 문서가 있을 때, 이어서 업데이트할 수 있도록 경로를 제시해야 한다.

## 설계 원칙

- **완료 마킹은 hook이 보장** — SKILL.md 지시 의존 아님, Claude가 빼먹을 수 없음
- **평소 비용 최소화** — continue 아닌 세션에서는 `existsSync` 1회(~0.1ms)로 종료
- **doc-save 경로는 스킬 스크립트가 기록** — doc-save 실행 시 자동 저장

## 아키텍처 개요

```
┌──────────────────────────────────────────────┐
│  기능 1: 완료 마킹 (hook 보장)               │
│                                              │
│  find-context-warning.mjs                    │
│    → 목록 출력 + .pending 파일 생성          │
│                                              │
│  PostToolUse(Bash) hook                      │
│    → .pending 존재 시에만 활성              │
│    → query-sessions.js get <uuid> 감지       │
│    → uuid가 .pending 목록에 있으면           │
│      → context-warning JSON에 resolved=true  │
│      → doc-save 경로 확인 후 resolved_doc    │
│      → .pending 삭제                         │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  기능 2: doc-save 경로 기록 (스킬 스크립트)  │
│                                              │
│  doc-save SKILL.md 마지막 단계               │
│    → save-doc-record.mjs 호출                │
│    → ~/.claude/scripts/doc-save/             │
│      <session_id>.json 생성                  │
│    → TTL 1일 자동 정리                       │
└──────────────────────────────────────────────┘
```

## 변경 파일

| 파일 | 변경 | 신규/수정 |
|------|------|-----------|
| `my-session-wrap/skills/continue/scripts/find-context-warning.mjs` | .pending 생성 + (완료) 표시 + TTL 정리 | 수정 |
| `my-session-wrap/hooks/hooks.json` | PostToolUse hook 등록 | 수정 |
| `my-session-wrap/hooks/resolve-context-warning.js` | PostToolUse hook 스크립트 | **신규** |
| `my-session-wrap/skills/continue/scripts/save-doc-record.mjs` | doc-save 기록 스크립트 | **신규** |
| `my-session-wrap/skills/continue/SKILL.md` | (완료) 표시 설명 + doc-save 이어쓰기 안내 | 수정 |
| doc-save SKILL.md (`~/.claude/skills/doc-save/SKILL.md`) | 마지막 단계에 save-doc-record.mjs 호출 추가 | 수정 |

## Step 1: find-context-warning.mjs 수정

### 1a. .pending 파일 생성

목록 출력 시 `.pending` 파일을 context-warning 디렉토리에 생성:

```js
// 기존 마지막 부분
entries.sort((a, b) => new Date(b.ts) - new Date(a.ts));
console.log(JSON.stringify({ found: true, count: entries.length, sessions: entries }));

// 추가: 플래그 파일 생성
if (entries.length > 0) {
  writeFileSync(
    join(warningDir, ".pending"),
    JSON.stringify(entries.map(e => e.session_id))
  );
}
```

위치: `~/.claude/scripts/context-warning/.pending`

### 1b. (완료) 표시

`formatDisplay()` 수정:
- `resolved: true` → display 앞에 `(완료)` 접두어
- `resolved_doc` 존재 시 → display 뒤에 `→ {경로}`

### 1c. TTL 정리

스크립트 실행 시 1일 경과한 context-warning JSON + doc-save JSON 삭제:
- `ts` 기준 24시간 초과 → `unlinkSync`
- doc-save: `~/.claude/scripts/doc-save/` 디렉토리도 함께 정리

## Step 2: PostToolUse hook (resolve-context-warning.js)

### 2a. hooks.json 등록

```json
{
  "PostToolUse": [{
    "hooks": [{
      "type": "command",
      "command": "node ~/.claude/my-claude-plugins/my-session-wrap/hooks/resolve-context-warning.js",
      "timeout": 3000
    }]
  }]
}
```

### 2b. hook 스크립트 로직

```
stdin → JSON parse → tool_name === "Bash"?

1. .pending 존재 확인 (existsSync)
   → 없으면 즉시 return (평소 세션 99.9%)

2. command에 "query-sessions.js get" + UUID 패턴 매칭
   → 불일치 시 return

3. UUID가 .pending 목록에 포함?
   → 불포함 시 return

4. context-warning/<uuid>.json 읽기 → resolved=true, resolved_at 추가

5. doc-save 경로 확인:
   ~/.claude/scripts/doc-save/<uuid>.json 존재?
   → 있으면 doc_path 읽어서 resolved_doc에 기록

6. context-warning/<uuid>.json 덮어쓰기

7. .pending에서 해당 uuid 제거
   → 목록 비면 .pending 삭제
```

## Step 3: save-doc-record.mjs (신규)

doc-save 스킬의 마지막 단계에서 호출:

```bash
node save-doc-record.mjs <doc_path>
```

- session_id: 환경변수 `CLAUDE_SESSION_ID` 또는 stdin의 `session_id`에서 획득
- 저장: `~/.claude/scripts/doc-save/<session_id>.json`

```json
{
  "ts": "2026-03-25T05:27:00Z",
  "session_id": "f37a6548-...",
  "doc_path": "C:/Users/ahnbu/.claude/skills/_docs/20260325_02_...md"
}
```

## Step 4: doc-save SKILL.md 수정

마지막 단계에 추가:

```
### 마지막: doc-save 기록
node <continue스크립트경로>/save-doc-record.mjs "<생성한_문서_경로>"
```

## Step 5: continue SKILL.md 수정

경로 B 설명에 추가:
- (완료) 표시가 자동으로 붙는다는 설명
- doc-save 문서가 있는 경우 이어쓰기 안내 문구

```
경로 B 목록 출력 예시:
  1. (완료) 현재_스킬_중에서 | 88% (14:03) → _docs/20260325_02_...md
  2. request_interrupted_tool | 83% (14:27)
  3. 건너뛰기
```

doc-save 문서 발견 시:
```
이전 doc-save 문서: {경로}
이어서 업데이트합니다.
```

## 동작 흐름 (사용자 관점)

```
평소 (continue 안 쓸 때):
  [Bash] → [hook] → .pending 있나? → ❌ → return (0.1ms)

/continue 할 때:
  목록 생성 → .pending 생성됨
  ↓
  사용자 "3번" 선택
  ↓
  query-sessions.js get <id> 실행
  ↓
  [hook 자동 감지] → .pending ✅ → uuid 매칭 ✅
    → resolved=true 마킹
    → doc-save/<id>.json 경로 확인 → resolved_doc 기록
    → .pending 삭제
  ↓
  다음번 /continue:
    1. (완료) 현재_스킬_중에서 | 88% → _docs/20260325_02_...md
    2. request_interrupted_tool | 83%
    3. 건너뛰기
```

## 검증 계획

1. **find-context-warning.mjs 단독**
   - 실행 → .pending 파일 생성 확인
   - resolved JSON으로 수정 → 재실행 → `(완료)` 접두어 출력 확인
2. **PostToolUse hook 단독**
   - .pending 생성 → `query-sessions.js get <uuid>` 실행 → resolved 마킹 + .pending 삭제 확인
   - .pending 없을 때 → hook이 즉시 return하는지 확인
3. **save-doc-record.mjs 단독**
   - 실행 → `~/.claude/scripts/doc-save/<session_id>.json` 생성 확인
4. **E2E: /continue 전체 흐름**
   - context-warning 목록 → 번호 선택 → hook이 resolved 마킹 → 재실행 시 (완료) + doc 경로 표시
5. **TTL 정리**
   - 1일 경과 JSON → find-context-warning.mjs 실행 시 삭제 확인
