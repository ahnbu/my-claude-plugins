---
date: 2026-03-24
scope: current-session
session: "b991d4af-5030-4c29-8f99-80c84ee85694"
session_path: "C:/Users/ahnbu/.claude/projects/D--CloudSync-90-------handoff/b991d4af-5030-4c29-8f99-80c84ee85694.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/modular-churning-sutherland.md"
---

# wrap 스킬 handoff 형식 불일치 원인 분석

## 발단: 사용자 요청

이전 세션(b084c12e)에서 시작된 분석. `ai-study/_handoff/`에 쌓인 handoff 파일들이 모두 다른 형식으로 작성되어 있다는 문제 제기. 올바른 형식(BQ 헤더)과 잘못된 형식(YAML frontmatter, 불릿 리스트 등)이 혼재.

## 작업 상세내역

### 1단계: 이전 세션 컨텍스트 복원

세션 ID `b084c12e`로 JSONL을 직접 파싱하여 컨텍스트 재수립.
이전 세션의 마지막 작업: `/wrap` 호출 직전 "Prompt is too long"으로 미완료. 남긴 할일: template.md를 읽었다는 JSONL 증거가 다음 세션에서 나와야 한다.

### 2단계: 90_자료수집 세션 3건 검증

올바른 BQ 형식이 나온 세션 3건의 JSONL을 파싱하여 template.md Read 여부 확인.

| handoff 파일 | 런타임 | template.md Read | SKILL.md Read | 출력 형식 |
|---|---|---|---|---|
| `_20260323_01` (a847d7d4) | Claude | ✅ **2회** | ✅ | BQ ✅ |
| `_20260323_02` (6a1ada54) | Claude | ❌ 0회 | ✅ | BQ ✅ |
| `_20260324_01` (Codex) | Codex | ❌ 0회 | 미확인 | BQ ✅ |

<span style="color:#888">*정렬 기준: template.md 읽은 것이 가장 확실한 근거이므로 최상단*</span>

**중간 결론:** `_02`와 Codex 세션은 template.md를 읽지 않았는데도 BQ 형식이 나왔음. "template.md를 읽지 않아서 YAML이 생긴다"는 가설이 이 3건만으로는 성립하지 않음.

### 3단계: ai-study 세션 8건 전수 조사

문제가 된 세션들의 JSONL을 파싱하여 Read 호출 여부 전수 확인.

| 파일 | SKILL.md Read | template.md Read | 출력 형식 |
|---|---|---|---|
| `_20260321_01` | ❌ | ❌ | YAML ❌ |
| `_20260321_02` | ❌ | ❌ | YAML ❌ |
| `_20260322_01` | ❌ | ❌ | YAML ❌ |
| `_20260322_02` | ❌ | ❌ | YAML ❌ |
| `_20260322_03` | ❌ | ❌ | YAML ❌ |
| `_20260323_01` | ❌ | ❌ | YAML ❌ |
| `_20260323_02` | ❌ | ❌ | # Handoff + 불릿 ❌ |
| **`_20260323_03`** | **✅** | ❌ | **YAML ❌** |

<span style="color:#888">*정렬 기준: `_20260323_03`이 결정적 증거이므로 강조. SKILL.md를 읽었음에도 YAML 발생.*</span>

**결정적 증거:** `_20260323_03` 세션은 SKILL.md를 Read했음에도 YAML frontmatter가 나왔다. SKILL.md의 `"참조"` 문구만으로는 AI가 template.md를 Read하지 않는다는 것이 직접 증명됨.

### 4단계: wrap 커맨드 경로 분석

`commands/wrap.md` 내용:
```
Read and follow the skill definition at:
C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\SKILL.md
```

`/wrap` 슬래시 커맨드 → 커맨드 텍스트 주입 방식. AI는 이 텍스트를 받아 Read 도구로 SKILL.md를 읽어야 한다. 일부 세션은 이마저 생략함 (Layer 1 문제).

### 5단계: 수정안 1차 시도 및 롤백

초안: SKILL.md Step 2-3에 "Read 도구로 template.md를 반드시 읽어라" + bash 탐색 명령 추가. 사용자 요청으로 즉시 롤백.

### 6단계: 올바른 형식 세션과 잘못된 형식 세션의 차이 규명

90_자료수집 세션이 template.md를 읽지 않고도 BQ 형식이 나온 이유:
- `a847d7d4`: template.md 2회 Read → 확실한 원인
- `6a1ada54`: SKILL.md 읽음, template.md 미읽음 → 이전 handoff가 같은 프로젝트 컨텍스트에 있거나, 컨텍스트 내 다른 BQ 형식 힌트 존재로 추정 (재현 불확실)

## 의사결정 기록

### 검토한 옵션

| 접근법 | 설명 | 신뢰도 |
|---|---|---|
| ① template.md Read 강제 | SKILL.md에 "Read 도구로 template.md를 읽어라" 명시 | ⚠️ Read 자체를 생략할 수 있음 |
| ② **SKILL.md에 형식 인라인** | BQ 헤더 구조를 SKILL.md 본문에 직접 포함 | ✅ SKILL.md만 읽어도 형식 보장 |
| ③ ①+② 복합 | Read 강제 + 인라인 포함 | ✅ 가장 강력하나 중복 |

<span style="color:#888">*정렬 기준: 실제 누락 패턴(Read 생략)에 대응하는 방어 깊이 순*</span>

- **결정**: ② SKILL.md Step 2-3에 BQ 헤더 형식 인라인 포함 + YAML frontmatter 금지 명시
- **근거**: template.md Read를 강제해도 AI가 Read 자체를 생략할 수 있음 (`_20260323_02`처럼). SKILL.md에 직접 형식을 기재하면 SKILL.md 읽기만으로 형식이 보장됨
- **트레이드오프**: SKILL.md가 약간 길어지나, template.md와 SKILL.md 간 형식이 이중 관리될 수 있음. template.md는 본문 구조 상세 참조용으로 존속하므로 역할 분리 명확

### 변경하지 않는 것

- `references/template.md` — 원본 유지 (본문 구조 상세 참조용)
- `commands/wrap.md` — 이미 "Read and follow" 지시가 있음
- Layer 1 문제 (SKILL.md 자체를 안 읽는 경우) — 커맨드 시스템 한계, 스킬 파일 수정으로 해결 불가

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|---|---|---|---|
| SKILL.md Step 2-3 수정 반영 | Read로 파일 확인 | ⏳ 미실행 | 수정 미완료 |
| 다음 세션 `/wrap` 호출 | handoff 첫 8줄 확인 | ⏳ 미실행 | |
| BQ 형식 출력 확인 | `---` 없음, `# Handoff —` 있음 | ⏳ 미실행 | |
| JSONL에 Read 기록 여부 | python3로 파싱 | ⏳ 미실행 | 없어도 형식 맞으면 성공 |

## 리스크 및 미해결 이슈

- **Layer 1 미해결**: SKILL.md 자체를 읽지 않는 세션(커맨드 텍스트 무시 케이스)은 이번 수정으로도 해결 불가. 빈도 낮음으로 판단하여 보류.
- **형식 이중 관리**: SKILL.md 인라인 헤더와 template.md 헤더가 별도 관리됨. template.md 변경 시 SKILL.md도 동기화 필요.
- **재현 불확실**: 90_자료수집 세션이 BQ로 나온 이유 중 `6a1ada54` 케이스가 컨텍스트 기반 추론으로 추정되어 재현 조건 불명확.

## 다음 액션

- **즉시**: SKILL.md Step 2-3 수정 실행 (plan 대로)
- **검증**: 다음 `/wrap` 호출 후 생성된 handoff 형식 확인
- **나중**: Layer 1 문제(SKILL.md 자체 미읽기) 발생 빈도 모니터링

---

> Plan 원문 — 원본: C:/Users/ahnbu/.claude/plans/modular-churning-sutherland.md

# (Plan) Plan: wrap 스킬 handoff 형식 일관성 보장

## Context

### 문제
`/wrap` 호출 시 생성되는 handoff 문서의 형식이 세션마다 제각각.
올바른 형식(BQ 헤더)과 잘못된 형식(YAML frontmatter, 불릿 리스트 등)이 혼재.

### 근거 데이터

**ai-study 세션 8건 — 전부 잘못된 형식:**

| 세션 | SKILL.md Read | template.md Read | 결과 |
|---|---|---|---|
| `_20260321_01` | ❌ | ❌ | YAML ❌ |
| `_20260323_02` | ❌ | ❌ | # Handoff + 불릿 ❌ |
| `_20260323_03` | ✅ | ❌ | YAML ❌ |
| (나머지 5건) | ? | ❌ | YAML ❌ |

**90_자료수집 세션 3건 — 전부 올바른 형식:**

| 세션 | SKILL.md Read | template.md Read | 결과 |
|---|---|---|---|
| `a847d7d4` | ✅ | ✅ (2회) | BQ ✅ |
| `6a1ada54` | ✅ | ❌ | BQ ✅ |
| Codex | ? | ❌ | BQ ✅ |

### 확정된 원인 (2단계)

1. **Layer 1**: SKILL.md조차 안 읽는 경우 → AI가 완전 자체 판단 → YAML/불릿 등 난립
2. **Layer 2**: SKILL.md 읽었지만 template.md 안 읽는 경우 → "참조"라는 약한 지시로는 Read 실행 안 됨 → YAML 발생 (`_20260323_03`이 직접 증거)

### 왜 90_자료수집은 올바른 형식이었나?

- `a847d7d4`: template.md를 2회 Read → 확실히 올바른 형식
- `6a1ada54`: SKILL.md만 읽음, template.md 미읽음이지만 BQ 형식 → 같은 프로젝트에서 이전 handoff를 참고했거나, 컨텍스트 내 다른 힌트로 추론한 것으로 추정 (재현 불확실)

---

## 수정 방안

### 대상 파일

`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\SKILL.md`

### 변경 내용: Step 2-3 개선

**핵심 전략: SKILL.md 자체에 형식 규칙을 인라인으로 포함**

template.md를 Read하도록 강제하는 것만으로는 불충분 (Read 자체를 생략할 수 있음).
SKILL.md 내에 핵심 형식 규칙을 직접 인라인하면, SKILL.md만 읽어도 올바른 형식이 보장된다.

**변경할 부분 (Step 2-3):**

현재:
```
### 2-3. handoff 파일 작성

템플릿은 `references/template.md` 참조. 메인 에이전트가 세션 컨텍스트에서 직접 작성한다.
```

변경 후:
```
### 2-3. handoff 파일 작성

아래 헤더 형식을 **반드시** 따른다. YAML frontmatter(`---` 블록) 사용 금지.

    # Handoff — [작업명] (세션 NN)
    > 날짜: YYYY-MM-DD
    > 세션 ID: <session-id>
    > 세션 경로: [절대 경로 — ~ 단축형 금지]
    > 토큰: 입력 <N>K / 출력 <N>K    ← DB 조회 성공 시만
    > 도구 호출: <도구명(횟수), ...>   ← DB 조회 성공 시만
    > 상태: 진행중 | 세션완료 | 전체완료

본문 구조는 `references/template.md` 참조. 메인 에이전트가 세션 컨텍스트에서 직접 작성한다.
```

### 변경하지 않는 것

- `references/template.md` — 원본 유지 (상세 참조용으로 존속)
- `commands/wrap.md` — 변경 불필요 (SKILL.md Read 지시가 이미 있음)
- Layer 1 문제 (SKILL.md 자체를 안 읽는 경우) — 커맨드 시스템의 한계로, 스킬 파일 수정으로 해결 불가

---

## 검증 계획

1. 수정 후 이 세션에서 `/wrap` 실행
2. 이 세션의 JSONL에서 template.md Read 여부 확인 (있어도 좋고, 없어도 형식만 맞으면 성공)
3. 생성된 handoff 파일 첫 8줄이 BQ 형식인지 확인
4. YAML frontmatter(`---`)가 없는지 확인
