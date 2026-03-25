---
date: 2026-03-25
scope: wrap 스킬 handoff 형식 YAML 전환 설계
session: "cc5abe14-5d63-48ba-8ff0-13ba3909377a"
session_path: "C:/Users/ahnbu/.claude/projects/D--CloudSync-90-----/cc5abe14-5d63-48ba-8ff0-13ba3909377a.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/virtual-cuddling-star.md"
---

# wrap 스킬 handoff YAML 전환 설계

## 발단: 사용자 요청

어제(2026-03-24) 20시 이후 작성된 handoff 파일 리스팅 및 작업 완료 여부 확인 요청.
→ 2건 확인 중 `wrap 스킬 handoff 형식 원인분석` handoff(21:17)가 SKILL.md 수정 미착수 상태.
→ 해당 handoff에서 설계된 수정 방향(BQ 인라인 추가)을 재검토.

추가로 다음 이슈 제기:
- BQ vs YAML 비교표가 사실에 근거하지 않고 BQ로 치우침
- obsidian-skills 플러그인의 영향이 원인 분석에서 누락됨
- next-handoff.mjs가 template.md를 복제하여 파일을 생성하면 어떤가?

## 작업 상세내역

### 1. 어제 20시 이후 handoff 점검

세션DB(`query-sessions.js search "wrap"`) + 파일시스템 `stat` KST 시각 교차검증으로 전체 6건 중 20시 이후 정확히 **2건** 확인.

| # | 생성시각 | Handoff | 완료 상태 |
|---|---------|---------|-----------|
| 1 | 21:17 | 숫자표기규칙 개선 계획수립 | 별도 세션에서 진행 |
| 2 | 21:17 | wrap 스킬 handoff 형식 원인분석 | 분석 완료, SKILL.md 수정 미착수 |

### 2. YAML 혼입 원인 재분석

기존 분석(Layer 1/2)에 **obsidian-skills 플러그인** 요인 추가.

`obsidian-markdown` 스킬 (`C:\Users\ahnbu\.claude\plugins\cache\obsidian-skills\obsidian\1.0.1\skills\obsidian-markdown\SKILL.md`) 확인:
- 노트 작성 워크플로우 **1단계**: "Add frontmatter with properties (title, tags, aliases)"
- `PROPERTIES.md`에서 YAML frontmatter 상세 문법 제공
- hooks.json 없음 → 자동 트리거 아님, but 스킬 목록에 항상 노출

**YAML 발생 패턴 (ai-study handoff 시계열):**

| 기간 | BQ 형식 | YAML frontmatter | 기타(불릿 등) |
|------|---------|-----------------|-------------|
| 3/1~3/3 | 7건 | 0건 | 3건 |
| 3/20~3/23 | 3건 | 7건 | 1건 |

**원인 요인 분석:**

| 요인 | 영향도 | 근거 |
|------|--------|------|
| `obsidian-markdown` 스킬 (obsidian-skills 플러그인) | ██████ | 노트 작성 1단계로 "Add frontmatter with properties" 명시. 3월 중반 설치 시점과 YAML 급증 시점 일치 가능성 |
| Vault CLAUDE.md 프론트매터 규칙 | ████░░ | "필수: title, created, tags" — 3/1~3/3에도 동일 규칙이나 BQ가 다수 → 단독 원인 아님 |
| SKILL.md 미읽기 (Layer 1) | ██████ | wrap SKILL.md 미읽기 시 AI가 다른 규칙(옵시디언, 일반 지식) 우선 적용 |
| template.md 미읽기 (Layer 2) | ████░░ | SKILL.md 읽어도 "참조" 문구만으로는 Read 강제 불가 |

**핵심**: 복합 원인. obsidian-markdown 스킬 설치 이후 AI가 "md 파일 = frontmatter 필수"로 인식하는 경향 강화.

### 3. BQ vs YAML 비교분석

**맥락**: scrap-sns(20260313)에서 YAML 도입 후 하이브리드 채택한 선례 존재.

| 항목 | BQ 헤더 (`>` blockquote) | YAML Frontmatter (`---`) |
|------|-------------------------|--------------------------|
| Obsidian 가독성 | 본문 인용문으로 표시 | ✅ Properties 패널에서 구조화 렌더링, 설정으로 펼침/접힘 조절 가능 |
| Typora 가독성 | ✅ 인용문으로 자연스럽게 보임 | 코드블록으로 렌더링, 링크 클릭 불가 |
| Dataview 쿼리 | ❌ 불가 (비정형 텍스트) | ✅ 즉시 쿼리 가능 (session_id, date, status 등) |
| AI 에이전트 파싱 | 정규식 파싱 필요 | ✅ 구조화 데이터, 토큰 효율적 탐색 가능 |
| AI 형식 준수 용이성 | ██░░░░ AI가 자주 누락·변형 | ██████ AI가 자연스럽게 생성, obsidian-markdown 스킬과도 일관 |
| Claude Code 스킬 생태계 일관성 | 별도 형식 | ✅ 스킬 frontmatter와 동일 패턴 |
| 기존 template.md 일관성 | ✅ 현재 template.md가 BQ | 변경 필요 |
| 링크 클릭 (Obsidian) | ✅ 본문 내 URL 클릭 가능 | ✅ Properties에서 URL 클릭 가능 |
| 링크 클릭 (Typora) | ✅ 클릭 가능 | ❌ 불가 |

<span style="color:#888">*정렬 기준: 주 사용 환경(Obsidian) 가독성 → 데이터 활용성(Dataview, AI 파싱) → AI 준수 용이성*</span>

## 의사결정 기록

- **결정**: YAML frontmatter 채택 (사용자 선택)
- **근거**: Obsidian 가독성, Dataview 쿼리 활용(이미 사용 중), AI 에이전트 친화성(토큰 효율), Claude Code 스킬 생태계 일관성
- **트레이드오프**: Typora에서 코드블록 렌더링 / 기존 template.md 변경 필요

- **추가 결정**: `next-handoff.mjs`가 template.md를 복제하여 파일을 미리 생성 → AI는 Edit으로 플레이스홀더만 채움
- **근거**: 형식이 스크립트 레벨에서 강제되어 Layer 1/2 문제 + obsidian-markdown 스킬 영향 모두 해소. "Write로 새로 작성" → "Read → Edit으로 채우기"로 패러다임 전환.

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| template.md YAML 전환 | 파일 내용 확인, `---`로 시작하는지 | ✅ 완료 | 1행 `---`, YAML frontmatter 정상 시작 |
| next-handoff.mjs 파일 생성 기능 | `node next-handoff.mjs "" "테스트"` 실행, 파일 존재 확인 | ✅ 완료 | `handoff_20260325_04_검증테스트3.md` 생성 확인 |
| 플레이스홀더 치환 | 생성된 파일에 `__TITLE__`, `__DATE__`, `__NN__` 대신 실제 값이 들어있는지 | ✅ 완료 | title·date·세션 순번 모두 치환 정상 |
| SKILL.md Step 2-2, 2-3 수정 | 파일 내용 확인 | ✅ 완료 | Read→Edit 워크플로우, BQ 헤더 금지 명시 |
| /wrap 실행 시 YAML 형식 생성 | `/wrap` 호출 후 handoff 첫 줄 `---` 확인 | ⏳ 미실행 | 다음 `/wrap` 실행 시 검증 |
| BQ 헤더 미생성 | 생성된 handoff에 `> 날짜:` 패턴 없는지 확인 | ✅ 완료 | 테스트 파일에 BQ 패턴 없음 확인 |

> 검증 실행일: 2026-03-25 (세션 df6f94d8)

## 리스크 및 미해결 이슈

- template.md 변경 시 기존 BQ 형식 handoff와 혼재 상태 (과거 파일은 그대로, Dataview 쿼리 시 YAML 있는 파일만 조회됨)
- next-handoff.mjs에서 template.md 경로 탐색 실패 시 fallback 동작 필요 (경로만 출력으로 graceful degradation)
- SKILL.md Step 2-3 수정 후에도 Layer 1(SKILL.md 자체 미읽기) 문제는 해소되지 않음 — 스크립트 레벨 강제로 보완

## 다음 액션

1. ~~template.md 헤더 → YAML frontmatter 전환~~ ✅ 완료 (2026-03-25)
2. ~~next-handoff.mjs → template.md 복제 + 플레이스홀더 치환 후 파일 생성~~ ✅ 완료
3. ~~SKILL.md Step 2-2, 2-3 → 스크립트가 파일 생성까지 담당한다는 지시로 업데이트~~ ✅ 완료
4. `/wrap` 실행하여 전체 검증 ⏳

---

## 기존 handoff 일괄 YAML 전환

### 배경

신규 handoff는 `next-handoff.mjs`가 YAML frontmatter 템플릿으로 생성하지만, 기존 BQ 형식 파일은 Dataview 쿼리 불가 상태 유지. 최근 7일 파일을 대상으로 일괄 전환 진행.

### 스크립트

`my-session-wrap/scripts/migrate-handoff-to-yaml.mjs`

| 옵션 | 동작 |
|------|------|
| (없음) | dry-run — 변환 내용 preview만 출력, 파일 미수정 |
| `--apply` | 실제 변환 실행 |
| `--days N` | 탐색 기간 변경 (기본 7일) |

- BQ 포맷만 변환 대상. bullet/table/unknown은 경고 출력 후 미변환.
- YAML frontmatter(`---`)로 시작하는 파일 자동 skip.

### 실행 결과 (2026-03-25, 세션 df6f94d8)

탐색 범위: `~/.claude`, `D:/CloudSync`, `D:/vibe-coding`, 최근 7일

| 포맷 | 건수 | 처리 |
|------|------|------|
| YAML | 53건 | skip |
| BQ | 18건 | ✅ 변환 완료 |
| Bullet | 1건 | ⚠️ 수동 |
| Table | 3건 | ⚠️ 수동 |
| Unknown | 5건 | ⚠️ 수동 |

**비정형 9건 수동 전환 결과 (2026-03-25, 세션 df6f94d8)**:

| 유형 | 파일 (경로 축약) | 처리 | 추출 필드 |
|------|------|------|------|
| bullet | `ai-study/.../bypass_2차_이중설치_발견_native_재설치_대기.md` | ✅ YAML 변환 | session_id, date, status |
| table | `my-claude-plugins/_handoff/isMeta스킬본문제외.md` | ✅ YAML 변환 | date, session_id |
| table | `my-claude-plugins/_handoff/검색잘림-수정.md` | ✅ YAML 변환 | 전 필드 완비 |
| table | `my-claude-plugins/_handoff/터미널창-숨김.md` | ✅ YAML 변환 | session_id, session_path |
| unknown | `my-claude-plugins/_handoff/테스트-검증.md` | 🗑️ 삭제 | 구 template 래퍼 잔재 |
| unknown | `skills/_handoff/ai-outputs경로-업데이트.md` | ✅ YAML 변환 | session_id, date, status |
| unknown | `skills/_handoff/scrap-sns-full-정리.md` | ✅ YAML 변환 (최소) | title, date만 |
| unknown | `ai-info/_handoff/AI-핵심채널-정리.md` | ✅ YAML 변환 (최소) | title, date만 |
| unknown | `ai-study/_handoff/nlm-인증자동갱신-진단.md` | ✅ YAML 변환 | session_id, date |

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/virtual-cuddling-star.md

# (Plan) wrap 스킬 handoff 형식 분석

## 조회 결과: 어제 20시 이후 handoff 2건

조회 방법: 세션DB (`query-sessions.js`) + 파일시스템 `stat` KST 시각 교차검증

| # | 생성시각 | Handoff | 경로 | 완료 상태 |
|---|---------|---------|------|-----------|
| 1 | 21:17 | 숫자표기규칙 개선 계획수립 | `global-rule-improve/_handoff/` | 별도 세션에서 진행 |
| 2 | 21:17 | wrap 스킬 handoff 형식 원인분석 | `my-claude-plugins/_handoff/` | 분석 완료, SKILL.md 수정+검증 미착수 |

---

## 크로스체크: YAML 혼입 원인 분석

### YAML 발생 패턴 (ai-study handoff 시계열)

| 기간 | BQ 형식 | YAML frontmatter | 기타(불릿 등) |
|------|---------|-----------------|-------------|
| 3/1~3/3 | 7건 | 0건 | 3건 |
| 3/20~3/23 | 3건 | 7건 | 1건 |

→ 3월 중반 이후 YAML 비율 급증. 동일 프로젝트에서 시기에 따라 형식 변화.

### 원인 요인 분석

| 요인 | 영향도 | 근거 |
|------|--------|------|
| `obsidian-markdown` 스킬 (obsidian-skills 플러그인) | ██████ | 노트 작성 1단계로 "Add frontmatter with properties" 명시. 스킬 목록에 항상 노출되어 AI가 md 생성 시 참조 가능. 3월 중반 설치 시점과 YAML 급증 시점이 일치할 가능성 |
| Vault CLAUDE.md 프론트매터 규칙 | ████░░ | "필수: title, created, tags" 규칙이 handoff에도 적용될 수 있음. 단, 3/1~3/3에도 동일 규칙 존재했으나 BQ가 다수 → 단독 원인은 아님 |
| SKILL.md 미읽기 (Layer 1) | ██████ | wrap SKILL.md를 읽지 않으면 AI가 다른 규칙(옵시디언, 일반 지식)을 우선 적용 |
| template.md 미읽기 (Layer 2) | ████░░ | SKILL.md 읽어도 "참조" 문구만으로는 template.md Read 실행을 강제하지 못함 |

### 핵심 결론

**복합 원인**: obsidian-skills 플러그인의 frontmatter 지시 + Vault CLAUDE.md 규칙 + wrap SKILL.md 미읽기가 복합 작용. 특히 `obsidian-markdown` 스킬이 설치된 이후 AI가 "md 파일 = frontmatter 필수"로 인식하는 경향 강화.

---

## BQ 헤더 vs YAML Frontmatter 비교분석

### 맥락
- scrap-sns(20260313): YAML 도입 → Obsidian Properties 패널에서 구조화 렌더링, 하이브리드(YAML + source card) 채택
- handoff 문서: 세션 메타를 기록하는 비정형 문서 → 별도 판단 필요

### 비교표

| 항목 | BQ 헤더 (`>` blockquote) | YAML Frontmatter (`---`) |
|------|-------------------------|--------------------------|
| Obsidian 가독성 | 본문 인용문으로 표시 | ✅ Properties 패널에서 구조화 렌더링, 설정으로 펼침/접힘 조절 가능 |
| Typora 가독성 | ✅ 인용문으로 자연스럽게 보임 | 코드블록으로 렌더링, 링크 클릭 불가 |
| Dataview 쿼리 | ❌ 불가 (비정형 텍스트) | ✅ 즉시 쿼리 가능 (session_id, date, status 등) |
| AI 에이전트 파싱 | 정규식 파싱 필요 | ✅ 구조화 데이터, 토큰 효율적 탐색 가능 |
| AI 형식 준수 용이성 | ██░░░░ AI가 자주 누락·변형 | ██████ AI가 자연스럽게 생성, obsidian-markdown 스킬과도 일관 |
| Claude Code 스킬 생태계 일관성 | 별도 형식 | ✅ 스킬 frontmatter와 동일 패턴 |
| 기존 template.md 일관성 | ✅ 현재 template.md가 BQ | 변경 필요 |
| 링크 클릭 (Obsidian) | ✅ 본문 내 URL 클릭 가능 | ✅ Properties에서 URL 클릭 가능 |
| 링크 클릭 (Typora) | ✅ 클릭 가능 | ❌ 불가 |

<span style="color:#888">*정렬 기준: 주 사용 환경(Obsidian) 가독성 → 데이터 활용성(Dataview, AI 파싱) → AI 준수 용이성*</span>

## 실행 계획: YAML frontmatter 전환 + 스크립트 복제 방식

### Context
사용자 결정: handoff 메타 헤더를 BQ → **YAML frontmatter**로 전환.
근거: Obsidian 가독성, Dataview 쿼리, AI 에이전트 파싱, 토큰 효율, 스킬 생태계 일관성.
추가 결정: `next-handoff.mjs`가 template.md를 복사해서 파일을 미리 생성 → AI는 Edit으로 플레이스홀더를 채움.
이유: 형식이 스크립트 레벨에서 강제되어 Layer 1/2 문제, obsidian-markdown 스킬 영향 모두 해소.

### 수정 파일 3개

#### 1. template.md — YAML frontmatter 전환
`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\references\template.md`

현재 BQ 헤더(6~14행)를 YAML frontmatter로 교체. 본문 구조(§1~§6)는 유지.
스크립트가 자동 채울 필드에는 `__PLACEHOLDER__` 패턴 사용.

- `__TITLE__`: 스크립트가 summary 인자로 채움
- `__DATE__`: 스크립트가 실행 시점 날짜로 채움
- `__NN__`: 스크립트가 순번으로 채움
- 나머지 빈 필드(`session_id`, `session_path` 등): AI가 Edit으로 채움

#### 2. next-handoff.mjs — 템플릿 복제 기능 추가
`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\scripts\next-handoff.mjs`

현재: 경로만 stdout 출력 (파일 미생성)
변경: 경로 생성 + template.md를 복사하여 파일 생성 + 플레이스홀더 치환

- `readFileSync`, `writeFileSync` import 추가
- template.md 없으면 stderr 경고 후 기존 동작(경로만 출력)으로 fallback

#### 3. SKILL.md Step 2-2, 2-3 수정
`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\SKILL.md`

**Step 2-2**: 스크립트가 파일까지 생성한다는 설명 추가
**Step 2-3**: "Write로 작성" → "Read → Edit으로 채우기" 지시로 변경

### 검증
1. `node next-handoff.mjs "" "테스트"` 실행 → 파일 생성 확인, YAML frontmatter + 본문 구조 확인
2. 이 세션에서 `/wrap` 호출 → AI가 Edit으로 플레이스홀더를 채우는지 확인
3. 생성된 handoff 첫 줄이 `---` (YAML)인지, BQ(`>`)가 없는지 확인
4. Obsidian에서 Properties 패널 정상 렌더링 확인
