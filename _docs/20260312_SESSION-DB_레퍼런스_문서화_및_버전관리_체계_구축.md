# SESSION-DB.md 작성 및 개발 문서 버전 관리 체계 구축

> 작성일: 2026-03-12
> 범위: current-session
> 세션: 9c5ad830-2557-4030-ab27-ecd5a0779f71
> 세션 경로: C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/9c5ad830-2557-4030-ab27-ecd5a0779f71.jsonl
> 원본 plan: C:/Users/ahnbu/.claude/plans/delightful-napping-bumblebee.md

---

## 발단: 사용자 요청

세션DB 관련 문서가 이슈 대응 보고서 6건+로 산재되어 있고, 스키마가 초기 설계 이후 최소 3번 변경되어 원안과 실제 DB가 불일치 상태. 새 작업(예: Gemini 소스 추가) 시 매번 코드를 역추적해야 하며, 모순된 정보로 시행착오 발생.

→ 실제 DB와 코드 기준의 single source of truth 레퍼런스 문서(`SESSION-DB.md`) 작성.

이후 추가 논의:
- 작성일자·변경 이력 표 추가
- 개발 문서 버전 관리 3가지 방법 학습
- git blame/log 자동화 및 pre-commit 훅 구현

---

## 작업 상세내역

### 1. SESSION-DB.md 최초 작성

코드 직독 (이슈 문서 참조 X):
- `shared/session-db.js` — `_init()` 스키마, `sync()`, `syncSingleSession()`, `_upsertSession/Messages/Events()`
- `shared/session-parser.js` — `processSession()`, `processCodexSession()`, `parsePlan()`, `normalizeEntries()`, `normalizeCodexEntries()`
- `shared/query-sessions.js` — CLI 명령어·옵션·DB 경로 해결 순서
- `my-session-dashboard/build.js` — 빌드 엔트리
- `my-session-wrap/hooks/sync-session-stop.js` — Stop 훅
- `my-session-wrap/lib/session/session-loader.js` — DB 우선 경로 조회

산출물: `SESSION-DB.md` (프로젝트 루트) — 스키마·데이터 흐름·파일 맵·CLI API·확장 가이드 포함

---

### 2. 개발 문서 버전 관리 3가지 방법 비교

#### 비교 분석표

| 방식 | 사용처 | 장점 | 단점 | 내부 문서 적합성 |
|------|--------|------|------|--------------|
| **문서 상단 메타 + 변경 이력 표** | Confluence, 사내 위키, ADR | 문서 열면 바로 보임. 누가 왜 바꿨는지 추적 가능 | 변경마다 수동 기록 필요 | ✅ 적합 |
| **git blame/log에 위임** | 오픈소스 README, CONTRIBUTING | 별도 관리 불필요 | "왜" 바꿨는지 커밋 메시지 품질에 의존 | ⚠️ 부분 적합 |
| **시맨틱 버전 + CHANGELOG 분리** | 라이브러리, API 문서, npm 패키지 | 외부 소비자에게 명확. breaking change 숫자로 식별 | 내부 문서에는 과도한 관리 부담 | ❌ 과도 |

#### 각 방법 상세 설명 (학습 메모)

**① 문서 상단 메타 + 변경 이력 표**
- 책의 판권 페이지 + 개정 이력 개념
- 사람이 직접 기록. 문서 열면 바로 "이게 언제 기준인지" 보임
- `기준 커밋` 필드로 코드와 문서의 일치 여부를 즉시 판단 가능
- 채택 이유: SESSION-DB.md는 팀 공유 기술 명세 성격

**② git blame/log**
- `git blame <file>`: 파일 **각 줄**이 마지막으로 누구에 의해, 언제, 어떤 커밋에서 바뀌었는지 표시
- `git log <file>`: 파일 전체의 커밋 단위 이력
- git log = 커밋 단위 이력 / git blame = 줄 단위 이력
- GitHub GUI에서 `Blame` 버튼으로 시각적 확인 가능
- 한계: `core.hooksPath`로 로컬 hooksPath가 설정된 레포에서는 글로벌 훅이 적용되지 않음 (이번에 발견된 사실)

**③ 시맨틱 버전 + CHANGELOG 분리**
- `v1.0.0 → v1.1.0`: 하위 호환 기능 추가
- `v1.x → v2.0.0`: breaking change
- 내부 문서에는 버전 번호 관리 자체가 과부담

#### 채택: 문서 상단 메타 + 변경 이력 표 (카테고리 분류 포함)

```markdown
| 항목 | 값 |
|------|-----|
| 작성일 | 2026-03-12 |
| 최종 수정일 | 2026-03-12 |
| 기준 커밋 | `898637f` |

## 8. 변경 이력
카테고리: `스키마` / `파일 맵` / `동기화` / `CLI` / `설명`

| 날짜 | 카테고리 | 변경 내용 | 관련 커밋 |
|------|---------|---------|----------|
| 2026-03-12 | — | 최초 작성 | `898637f` |
```

---

### 3. 프로젝트 규칙(CLAUDE.md) 추가

**추가된 규칙** (`세션 DB 경로 원칙` 섹션):
```
- 스키마·파일 맵·CLI 변경 시 `SESSION-DB.md` 변경 이력 표 갱신 필수. (스키마 레퍼런스: `SESSION-DB.md`)
```

판단 기준:

| 후보 규칙 | 포함 여부 | 이유 |
|----------|---------|------|
| 스키마 변경 시 SESSION-DB.md 갱신 필수 | ✅ 포함 | 이 문서를 만든 핵심 이유가 "문서-DB 불일치" 방지. 규칙 없으면 재발 |
| 마이그레이션 패턴 준수 | ❌ 제외 | SESSION-DB.md 확장 가이드에 이미 기술됨. CLAUDE.md 중복 불필요 |
| session_id 명명 규칙 | ❌ 제외 | 동일 — SESSION-DB.md 참조로 충분 |
| 변경 이력 표 기록 | ✅ 포함 (규칙 문구에 포함) | 갱신 필수 규칙의 "어떻게"도 명시 필요 |

---

### 4. git blame/log 자동화 — pre-commit 훅 구현

#### 훅 인프라 현황 발견 (조사 과정)

| 항목 | 실제 상태 | 비고 |
|------|---------|------|
| `.git/hooks/pre-commit` | ❌ 없음 | 처음 확인 시 오답 제공 |
| `git-hooks/pre-commit.bak` | 존재 (비활성) | 버전 동기화 래퍼, .bak으로 꺼둠 |
| `git config core.hooksPath` | `git-hooks` | 이 레포는 git-hooks/ 폴더가 훅 경로 |
| 글로벌 훅 (`~/.config/git/hooks/pre-commit`) | ✅ 존재·활성 | CHANGELOG.md 강제 로직 보유 |
| 글로벌 훅의 이 레포 적용 여부 | ❌ 미적용 | `core.hooksPath` 로컬 설정이 글로벌을 override |

**핵심 발견**: `core.hooksPath = git-hooks`가 로컬에 설정되어 있어 글로벌 pre-commit 훅이 이 레포에는 적용되지 않았음. CHANGELOG 강제도 실제로는 작동하지 않던 상태.

#### wrap SKILL.md 경고 문구 확인

> "CHANGELOG를 한꺼번에 여러 줄 추가한 뒤 커밋을 분리하면 **pre-commit hook에 차단된다**."

→ 글로벌 훅을 가리키는 문구였으나, 이 레포에서는 실제 적용되지 않던 상태였음. 이번 구현으로 해소.

#### 구현 내용

**신규 파일: `git-hooks/check-session-db-doc.js`**

동작:
1. staged 파일 목록에서 `shared/session-db.js`, `shared/session-parser.js`, `shared/query-sessions.js` 변경 여부 확인
2. 위 파일이 staged에 있는데 `SESSION-DB.md`가 없으면 커밋 차단 + 조치 안내 출력
3. 해당 파일 변경 없으면 검사 생략

**복원 파일: `git-hooks/pre-commit`**

3단계 순서 검증:
```
1. CHANGELOG.md 갱신 강제 (글로벌 훅 동일 로직)
   - staged에 CHANGELOG.md 없으면 차단
   - CHANGELOG.md 파일 자체가 없으면 템플릿으로 자동 생성
   - 서브폴더 CHANGELOG.md 차단

2. SESSION-DB.md 변경 이력 강제
   → check-session-db-doc.js 호출

3. marketplace.json ↔ plugin.json 버전 동기화
   → check-version-sync.js.bak 호출
```

**부수 수정**: `.claude-plugin/marketplace.json` trailing comma 제거 (JSON 파싱 오류 원인)

---

## 의사결정 기록

### 문서 버전 관리 방식 선택

- **결정**: 문서 상단 메타 + 변경 이력 표 (카테고리 열 포함)
- **근거**: SESSION-DB.md는 내부 기술 명세 성격. git log만으로는 "이 문서가 현재 DB와 맞는지" 판단 불가. 기준 커밋 명시가 핵심.
- **트레이드오프**: 변경마다 수동 기록 필요 ↔ 이력 가시성·문서-코드 일치 여부 즉시 확인 가능

### pre-commit 훅 구현 위치

- **결정**: `git-hooks/pre-commit` 복원 + `check-session-db-doc.js` 추가
- **근거**: 이 레포는 `core.hooksPath = git-hooks`로 설정되어 있어 글로벌 훅이 미적용. 로컬에 직접 구현 필요.
- **트레이드오프**: 글로벌 훅과 로직 중복 ↔ 이 레포에서의 실제 강제 적용

### CLAUDE.md 규칙 범위

- **결정**: 한 줄 트리거 규칙만 추가. 세부 내용은 SESSION-DB.md 참조.
- **근거**: CLAUDE.md는 간결하게 유지가 원칙. 상세 가이드는 SESSION-DB.md에 있으므로 중복 불필요.

---

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| SESSION-DB.md 스키마 정확성 | 코드에서 직접 추출 (session-db.js `_init()` 읽기) | ✅ 완료 | 실제 DB `.schema`와 대조 |
| 파일 맵 경로 실존 | `shared/text-utils.js` Glob 확인 | ✅ 완료 | 7개 파일 모두 존재 확인 |
| CLI 명령어 일치 | `query-sessions.js` 코드와 대조 | ✅ 완료 | 5개 명령어 일치 |
| check-session-db-doc.js 단독 실행 | `node git-hooks/check-session-db-doc.js` | ✅ 통과 | staged 없을 때 정상 스킵 |
| pre-commit 커밋 적용 테스트 | 실제 커밋 (`468e8ac`) | ✅ 통과 | 3단계 검증 모두 통과 |
| marketplace.json JSON 유효성 | `node -e JSON.parse(...)` | ✅ 수정 완료 | trailing comma 제거 |

---

## 리스크 및 미해결 이슈

- **SESSION-DB.md 최종 수정일 미갱신**: 현재 `최종 수정일: 2026-03-12`로 고정. 실제 변경 시 사람이 수동으로 갱신해야 하며, 훅이 이를 강제하지 않음. (자동화 가능하나 현재 미구현)
- **post-commit 자동 기록 미구현**: 커밋 후 SESSION-DB.md 변경 이력 표에 날짜·해시를 자동 삽입하는 방식 검토했으나 미채택. 현재는 수동 기록.
- **glob 훅의 이 레포 미적용 상태**: `core.hooksPath`가 로컬에 설정된 한 글로벌 훅은 이 레포에 미적용 상태 유지. 다른 레포에서 작업 시 SESSION-DB.md 갱신 강제 없음 (해당 레포 전용 훅이므로 정상).

---

## 다음 액션

- SESSION-DB.md의 `최종 수정일`·`기준 커밋` 필드 갱신 습관화 (변경 이력 추가 시 함께)
- post-commit 훅으로 변경 이력 자동 삽입 검토 (필요 시)

---

## 참고: Plan 원문

> 원본: C:/Users/ahnbu/.claude/plans/delightful-napping-bumblebee.md

# 세션DB 레퍼런스 문서 작성 계획

## Context

세션DB 관련 문서가 이슈 대응 보고서 6건+로 산재되어 있고, 스키마가 초기 설계 이후 최소 3번 변경되어 원안과 실제 DB가 불일치 상태. 새 작업(예: Gemini 소스 추가) 시 매번 코드를 역추적해야 하며, 모순된 정보로 시행착오 발생. **실제 DB와 코드 기준의 single source of truth 레퍼런스 문서**를 작성한다.

## 산출물

- **파일**: `SESSION-DB.md` (프로젝트 루트)
- **성격**: 레퍼런스 문서 (이슈 이력이 아닌 현재 상태 기준)

## 문서 구조

### 1. 개요
- 목적: JSONL/Plan/Codex 소스를 SQLite로 통합하여 세션 메타데이터·메시지·이벤트를 단일 DB로 관리
- 기술 스택: `node:sqlite` 내장 모듈, WAL 모드

### 2. 스키마 레퍼런스
4개 테이블의 컬럼별 타입·기본값·용도 정리 (실제 DB `sqlite3 .schema` 기준):
- **sessions**: 세션 메타데이터 (23개 컬럼)
- **messages**: 대화 내용 (7개 컬럼, PK: session_id+seq)
- **events**: 타임라인 이벤트 (8개 컬럼, PK: session_id+seq+agent_id)
- **plan_contents**: 플랜 원문 (2개 컬럼)
- 인덱스 3개

### 3. 데이터 흐름
```
JSONL/Plan/Codex 소스 파일
        │
        ▼
  session-parser.js (파싱)
        │
        ▼
  session-db.js (sync/upsert)
        │
        ▼
    sessions.db
        │
        ├── build.js → HTML 대시보드
        ├── query-sessions.js → CLI 쿼리
        ├── session-loader.js → file_path 룩업
        └── serve.js → 로컬 서버
```

### 4. 파일 맵
| 파일 | 역할 | R/W |
|------|------|-----|
| `shared/session-db.js` | SessionDB 클래스 (핵심) | R+W |
| `shared/session-parser.js` | JSONL/Plan/Codex 파싱 | R |
| `shared/text-utils.js` | 텍스트 유틸리티 | - |
| `shared/query-sessions.js` | CLI 쿼리 도구 | R |
| `my-session-dashboard/build.js` | 빌드 엔트리포인트 | R+W |
| `my-session-wrap/hooks/sync-session-stop.js` | Stop 훅 즉시 upsert | W |
| `my-session-wrap/lib/session/session-loader.js` | DB 우선 경로 조회 | R |

### 5. 동기화 메커니즘
- **증분 sync**: 파일 `mtime` vs DB 캐시 비교, 변경분만 재파싱
- **Stop 훅**: `syncSingleSession(force)` 즉시 upsert
- **마이그레이션 패턴**: ALTER TABLE + mtime=0 강제 재동기화

### 6. CLI 쿼리 API
`node shared/query-sessions.js <command> [args] [options]`
- 명령어: search, get, recent, by-tool, by-project
- 옵션: --scope, --limit
- DB 경로 해결 순서 (marketplace → 소스 레포)

### 7. 확장 가이드 (새 소스 타입 추가 체크리스트)
새 타입(예: Gemini) 추가 시 수정 필요 파일·단계:
1. `session-parser.js`: 파싱 함수 추가
2. `session-db.js`: sync()에 새 소스 디렉토리 등록, type enum 확장
3. `sessions` 테이블: 전용 컬럼 필요 시 마이그레이션
4. `build.js`: 빌드 대상에 포함
5. `query-sessions.js`: --scope 옵션에 추가
6. 대시보드 HTML: 필터·표시 추가

## 작성 방법

1. **실제 코드 기준**: 탐색에서 확인한 스키마·데이터 흐름을 그대로 문서화 (이슈 문서 참조 X)
2. **코드 파일 읽기**: session-db.js, session-parser.js, query-sessions.js의 핵심 로직 확인 후 정확한 동작 기술
3. **간결하게**: 각 섹션은 테이블·리스트 중심. 서술 최소화

## 검증

- 문서의 스키마가 실제 DB `.schema` 출력과 일치하는지 대조
- 파일 맵의 경로가 실제 존재하는지 확인
- CLI 명령어가 `query-sessions.js` 코드와 일치하는지 확인
