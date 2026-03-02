# wrap 스킬 CHANGELOG 이중 작성 문제 — 분석 및 개선안 v2

**작성일**: 2026-03-02
**대상 스킬**: `my-session-wrap` → `/wrap`
**상태**: §1~§9 완료 / 잔여: 콘텐츠 레벨 면제 명시(§8-2 #2)
**v1 대비**: 세션 전체 논의·방법론·평가 피드백 반영, 최종 후보 옵션 E 추가

---

## §1 문제 정의

### 1-1 현상

`/wrap` 실행 시 다음 시퀀스가 발생:

```
① git status → 미커밋 작업물 발견
② 커밋 시도 → 글로벌 pre-commit hook 차단
   ✗ CHANGELOG.md가 업데이트되지 않았습니다.
③ CHANGELOG 작성
④ 커밋 #1: 작업물 + CHANGELOG
⑤ Handoff 문서 생성
⑥ 커밋 시도 → 글로벌 pre-commit hook 재차단
⑦ CHANGELOG 재작성  ← 불필요한 반복
⑧ 커밋 #2: handoff + CHANGELOG
```

미커밋 작업물이 N개 관심사면 **N+1번의 CHANGELOG 작성**이 발생.

### 1-2 원인: 규칙 충돌 구조

| 규칙 | 출처 | 지시 |
|---|---|---|
| 단일 커밋으로 wrap | SKILL.md Step 3-2 | `git add -A` → 1회 커밋 |
| 한 커밋 = 한 관심사 | 글로벌 CLAUDE.md | 맥락 다른 문서는 커밋 분리 |
| 커밋 전 CHANGELOG 필수 | 글로벌 CLAUDE.md + pre-commit hook | 매 커밋마다 CHANGELOG 포함 |

AI는 SKILL.md의 "단일 커밋" 지시보다 **글로벌 규칙을 우선** 적용 → 관심사별 분리 커밋 → handoff 별도 커밋 → CHANGELOG 재요구.

> **핵심**: SKILL.md 미준수가 아니라, 글로벌 규칙과의 충돌로 인한 구조적 이탈.

### 1-3 현재 워크플로우 비교

| 단계 | SKILL.md 의도 | AI 실제 동작 (관찰) |
|:---:|---|---|
| ① | git status | git status |
| ② | **Handoff 먼저 작성** | 미커밋 파일 발견 → 커밋 시도 |
| ③ | CHANGELOG 업데이트 | hook 차단 → CL 작성 |
| ④ | `git add -A` → 단일 커밋 | 커밋: 작업물 + CL |
| ⑤ | 재개 안내 | **Handoff 작성** |
| ⑥ | — | 커밋 시도 → **hook 재차단** |
| ⑦ | — | CL 재작성 (불필요 반복) |
| ⑧ | — | 커밋: handoff + CL |

AI가 "dirty state를 먼저 정리하자"는 본능으로 커밋을 선행 → SKILL.md의 "handoff 먼저" 순서와 역전.

### 1-4 글로벌 hook 확인

- 경로: `C:/Users/ahnbu/.config/git/hooks/pre-commit`
- 적용 범위: 글로벌 (`git config --global core.hooksPath`)
- 로직:
  - CHANGELOG.md가 staged → 통과
  - CHANGELOG.md 없음 → 템플릿 자동 생성 후 통과
  - CHANGELOG.md 있지만 staged 안 됨 → **차단**

---

## §2 검토 방법론

이 섹션은 향후 유사 문제 진단 시 재사용할 수 있는 접근법을 기록한다.

### 2-1 워크플로우 시뮬레이션

**목적**: 옵션별 처리 순서를 케이스별로 구체화하여 숨겨진 문제를 발견.

**방법**:
1. 케이스를 구분한다 (단일 관심사 / 복수 관심사)
2. 각 케이스에서 옵션별 처리 순서를 표로 나열
3. 같은 단계에서 결과가 다른 지점을 식별 → 핵심 차이 파악

**이번 세션의 발견**:
- 단일/복수 관심사 케이스를 구분하니 옵션 3(단일 커밋)의 "관심사 혼합" 문제가 명확히 드러남
- "순서를 바꾸면 해결되지 않나?" 질문 → 시뮬레이션으로 "handoff는 구조적으로 항상 마지막" 확인

### 2-2 AI 자의적 판단 진단

**목적**: 규칙이나 메커니즘이 없으면 AI가 어디서 자의적으로 판단하는지 찾아낸다.

**방법**:
1. 워크플로우 각 단계를 나열
2. 각 단계에서 "AI가 판단해야 하는 것이 있는가?" 확인
3. 판단이 필요하면 → 글로벌 규칙과 충돌 여부 확인 → 심각도 평가
4. 충돌이 있으면 → SKILL.md 명시로 해소 가능한지 / 메커니즘이 필요한지 판단

**심각도 기준**:
- High: 글로벌 규칙과 충돌 + AI가 반대 방향으로 행동할 동기 있음
- Medium: 충돌은 없지만 AI가 실수할 가능성 있음
- Low: 발생 가능하지만 영향이 작음

**이번 세션의 발견**:
- "handoff 커밋에 CL 포함 여부"가 High 리스크 → hook 메커니즘으로 해소
- "이전 handoff 혼입", "다른 파일 혼입" → SKILL.md 명시로 해소
- "AI 자발적 CL 작성" → 글로벌 규칙까지 수정해야 완전 해소

### 2-3 메커니즘 vs 규칙 구분

**원칙**: AI가 판단하지 않아도 되는 구조(메커니즘)가 AI가 올바르게 판단해야 하는 구조(규칙)보다 안정적이다.

| 구분 | 예시 | 안정성 |
|---|---|---|
| 메커니즘 | hook이 handoff/ 단독 커밋을 자동 통과 | ✅ AI 판단 불필요 |
| 규칙 | "handoff 커밋은 CL 불필요"라고 SKILL.md에 명시 | ⚠️ AI가 글로벌 규칙과 충돌 시 이탈 가능 |
| 규칙+규칙 | 글로벌과 SKILL.md 양쪽에 명시 | AI 판단 여지 줄어듦, 완전 제거는 아님 |

**이번 세션의 발견**: hook 메커니즘 도입을 검토했지만, handoff 단독 커밋이라는 전제가 AI 판단에 의존 → 메커니즘이 보장하는 범위의 한계

### 2-4 비교표 진단

**목적**: 여러 옵션을 동일 기준으로 대조하여 트레이드오프를 명시화.

**유용한 기준 항목**:
- 핵심 문제 해소 여부
- 수정 파일 수 / 변경 복잡도
- AI 자의적 판단 여지
- 글로벌 규칙 충돌 여부
- handoff 안전성 (committed/uncommitted)
- 비용 대비 효과

**이번 세션의 발견**: "옵션 C(최종안)"가 3파일 수정이라는 점이 비교표에서 명확히 드러나 "복잡해졌다"는 판단으로 이어짐 → 원점 재검토

### 2-5 커밋 레벨 vs 콘텐츠 레벨 면제 구분

**발견**: 규칙 면제에는 두 가지 레벨이 있으며, 혼동하면 의도와 다른 결과가 나온다.

| 레벨 | 표현 | 의미 | 리스크 |
|---|---|---|---|
| 커밋 레벨 | "handoff 커밋은 CL 불필요" | 그 커밋에 CL을 안 넣어도 됨 | AI가 다른 커밋의 CL에 handoff를 미리 기록할 수 있음 |
| 콘텐츠 레벨 | "handoff는 CL 기록 대상이 아니다" | handoff 자체가 CL에 등장하면 안 됨 | 더 강한 제약, 의도 명확 |

**교훈**: 면제 규칙 작성 시 커밋 레벨인지 콘텐츠 레벨인지 명시하라.

---

## §3 검토 옵션 요약

| 옵션 | 설명 | 수정 범위 |
|---|---|---|
| A. 현재 유지 | 변경 없음 | 없음 |
| B. Handoff 커밋 안 함 | SKILL.md에서 handoff 커밋 단계 제거 | SKILL.md 1개 |
| C. CL 범위 축소 | SKILL.md + 글로벌 hook + 글로벌 CLAUDE.md | 3개 파일 |
| D. 단일 wrap 커밋 | 모든 파일을 1개 커밋에 포함 | SKILL.md 1개 |
| E. B + gitignore | handoff 커밋 안 함 + handoff/ gitignore 추가 | SKILL.md + gitignore |

---

## §4 옵션별 비교표

### 핵심 문제 해소

| 항목 | A. 현재 | B. 커밋 안 함 | C. 3파일 수정 | E. B+gitignore |
|---|---|---|---|---|
| CL 이중 작성 제거 | ❌ | ✅ | ✅ | ✅ |
| hook 차단 재시도 제거 | ❌ | ✅ | ✅ | ✅ |
| wrap 한 번에 끝남 | ❌ | ✅ | ✅ | ✅ |

### 수정 범위 및 안정성

| 항목 | A. 현재 | B. 커밋 안 함 | C. 3파일 수정 | E. B+gitignore |
|---|---|---|---|---|
| 변경 파일 수 | ✅ 0 | ✅ 1 | ❌ 3 | ✅ 2 |
| AI 자의적 판단 여지 | ❌ 많음 | ✅ 없음 (단계 자체 없음) | ⚠️ 혼입 리스크 등 잔존 | ✅ 없음 (gitignore가 차단) |
| 글로벌 규칙 충돌 | ❌ 있음 | ✅ 없음 | ⚠️ 해소했으나 3곳 동기 필요 | ✅ 없음 |
| 유지보수 부담 | ✅ 없음 | ✅ 없음 | ❌ 3곳 동기 유지 | ✅ 없음 |

### 트레이드오프

| 항목 | A. 현재 | B. 커밋 안 함 | C. 3파일 수정 | E. B+gitignore |
|---|---|---|---|---|
| handoff committed | ✅ | ⚠️ uncommitted | ✅ | ❌ 추적 불가 |
| 다른 머신 이어가기 | ✅ 가능 | ⚠️ 수동 커밋 필요 | ✅ 가능 | ❌ 불가 |
| CL 노이즈 | ❌ handoff 기록 | ✅ 없음 | ✅ 없음 | ✅ 없음 |
| 구현 비용 | ✅ 제로 | ✅ 최소 | ❌ 높음 | ✅ 낮음 |
| 문제 해결 확실성 | ░░░░░░ | ████░░ | ████░░ | ██████ |

---

## §5 심층 분석

### 5-1 AI 실제 행동 패턴

SKILL.md는 "handoff 먼저 작성"을 지시하지만 AI는 "dirty state 정리 먼저" 본능으로 커밋을 선행한다. 이는 글로벌 학습 패턴에서 비롯되며 SKILL.md로 억제하기 어렵다.

**교훈**: AI가 자연스럽게 하는 순서를 SKILL.md가 강제로 역전시키면 준수율이 낮아진다. SKILL.md를 AI의 실제 행동 패턴에 맞게 재구성하는 것이 더 효과적이다.

### 5-2 단계별 AI 판단 리스크 진단

| 단계 | 판단 내용 | 심각도 | 해소 방법 |
|---|---|---|---|
| ① git status | 없음 | — | — |
| ② 커밋 시도 | 이전 handoff 혼입 | Medium | SKILL.md "handoff/ 제외" 명시 |
| ③ CL 작성 | 기존과 동일 | — | — |
| ④ 작업물 커밋 | 없음 | — | — |
| ⑤ Handoff 작성 | 경로 이탈 가능 | Low | 기존 SKILL.md 경로 규칙 충분 |
| ⑥ Handoff 처리 | 다른 파일 혼입 | High | E안: gitignore로 원천 차단 |
| ⑥ Handoff 처리 | AI 자발적 CL 작성 | Medium | E안: gitignore로 원천 차단 |

### 5-3 옵션 E가 High 리스크를 원천 차단하는 이유

gitignore에 `handoff/`를 추가하면:
- `git status`에서 handoff가 보이지 않음
- AI가 handoff를 stage할 수 없음
- hook이 실행되지 않음 (커밋 시도 자체 없음)
- AI가 "CL에 handoff를 기록해야 하나?" 고민 불필요

SKILL.md에서 "handoff 커밋 단계"를 제거하면 AI가 수행할 행동 자체가 없어진다.

### 5-4 평가 피드백 반영사항 (외부 검토 결과)

v1 문서에 대한 평가에서 다음 오류가 지적되었으며 v2에 반영함:

| v1 오류 | v2 수정 |
|---|---|
| "pre-commit hook이 CHANGELOG 차단" → 이 레포의 hook은 version-sync만 검증 | 글로벌 hook임을 명시, 적용 범위 구분 |
| "--no-verify를 기본 해법으로 제안" | 옵션 E 채택으로 --no-verify 필요성 자체 제거 |
| "SKILL이 글로벌 규칙보다 우선" 단정 | "충돌 시 일관성이 흔들릴 수 있음"으로 완화 |
| "순서 변경으로 해결 불가능" 단정 | "현 규칙 집합에서는 해결이 어렵다"로 완화 |
| 커밋 레벨 면제만 고려 | 콘텐츠 레벨 면제 구분 추가 (§2-5) |

---

## §6 의사결정

**채택안**: 옵션 E — Handoff 커밋 안 함 + `handoff/` gitignore 추가

**근거**:
- 수정 범위 최소 (SKILL.md 1곳 + .gitignore)
- AI 자의적 판단 여지 제로 — gitignore가 git 레벨에서 handoff를 차단
- 글로벌 규칙 충돌 없음
- 유지보수 부담 없음 (3파일 동기 불필요)

**잔존 리스크와 수용 판단**:
- handoff가 git 추적에서 완전히 제외됨 → **수용**. 개인용 단일 머신 환경이므로 다른 머신 이어가기 불필요. `/continue`는 로컬 파일을 읽으므로 동작에 영향 없음.

**미래 참고사항**:
- 다른 머신에서 이어가기가 필요해지면: 옵션 C (CL 범위 축소, 3파일 수정)로 전환 검토. 이 경우 `handoff/`를 .gitignore에서 제거하고 §5 심층 분석의 AI 리스크 진단을 재검토할 것.

---

## §7 구현 명세

**수정 파일 3개**:

| 파일 | 변경 내용 |
|---|---|
| `my-session-wrap/skills/my-session-wrap/SKILL.md` | Step 3-2 재구성: `git add -A` 단일 커밋 → 관심사별 분리 커밋. handoff 커밋 단계 제거 + 주석 추가 |
| `~/.claude/CLAUDE.md` (글로벌) | 33행 `.gitignore` 초기화 목록에 `handoff/` 추가 |
| 기존 프로젝트 `.gitignore` | 전체 36개 git 프로젝트에 `handoff/` 추가 완료 — 상세 내역은 아래 표 참조 |

**`.gitignore` 처리 대상 프로젝트 (총 36개)**:

| 구분 | 프로젝트 | 처리 | handoff/폴더 실존 |
|---|---|---|---|
| C: — 기존 | `my-claude-plugins` | 기존 완료 | ✅ |
| C: — 신규 | `global-rule-improve` | 추가 완료 | ✅ |
| C: — 신규 | `linkedin-mcp` | 추가 완료 | — |
| C: — 신규 | `.claude/scripts` | 생성 완료 | — |
| C: — 신규 | `.claude/skills` | 추가 완료 | — |
| C: — 신규 | `opencode` | 추가 완료 | — |
| C: — 신규 | `SuperClaude_Framework` (C:) | 추가 완료 | — |
| D: — 기존 | `ai-study 통합` | 기존 완료 | ✅ |
| D: — 신규 | `20 SNS` | 생성 완료 | ✅ |
| D: — 신규 | `구글드라이브 동기화...` | 추가 완료 | ✅ |
| D: — 신규 | `옵시디언-ai적용검토` | 추가 완료 | ✅ |
| D: — 신규 | `dotfiles` | 추가 완료 | ✅ |
| D: — 신규 | `dotfiles/backup/global-rule-improve` | 추가 완료 | ✅ |
| D: — 신규 | `bookmark_manager` | 추가 완료 | — |
| D: — 신규 | `color_prompt` | 추가 완료 | — |
| D: — 신규 | `image_canvas` | 추가 완료 | — |
| D: — 신규 | `link-cleaner` | 추가 완료 | — |
| D: — 신규 | `make_slide` | 추가 완료 | — |
| D: — 신규 | `my_bookstation` | 추가 완료 | — |
| D: — 신규 | `notebooklm_logo_cleaner` | 추가 완료 | — |
| D: — 신규 | `pdf2pptx_aistudio` | 추가 완료 | — |
| D: — 신규 | `plan_landingpage` | 추가 완료 | — |
| D: — 신규 | `plan_writing` | 추가 완료 | — |
| D: — 신규 | `qwen-tts` | 추가 완료 | — |
| D: — 신규 | `scrap_sns` | 추가 완료 | — |
| D: — 신규 | `sns_writing` (메인) | 추가 완료 | — |
| D: — 신규 | `SuperClaude` (임시저장) | 추가 완료 | — |
| D: — 신규 | `SuperClaude_Framework` (임시저장) | 추가 완료 | — |
| D: — 신규 | `image_creator` (임시저장) | 추가 완료 | — |
| D: — 신규 | `sns_writing` (임시저장) | 추가 완료 | — |
| D: — temp | `ai-study/.temp/제미나이` | 추가 완료 | ✅ |
| D: — temp | `ai-study/.temp/코덱스` | 추가 완료 | ✅ |
| D: — temp | `ai-study/.temp/클로드코드` | 생성 완료 | ✅ |
| D: — backup | `dotfiles/backup/.claude/my-claude-plugins` | 추가 완료 | ✅ |
| D: — backup | `dotfiles/backup/.claude/scripts` | 생성 완료 | — |
| D: — backup | `dotfiles/backup/.claude/skills` | 추가 완료 | — |

> **탐색 방법**: `find /c/ /d/ -maxdepth 8 -name ".git"` 전수 조회 후 수동 제외(scoop, AppData, marketplaces/cache 등 시스템 경로).
> **검증**: 전체 36개 `grep -q "^handoff/" .gitignore` 통과 확인.

**결과 워크플로우**:

```
/wrap 실행
① git status → 미커밋 작업물 확인 (handoff/는 gitignore로 미표시)
② 커밋 시도 → hook 차단 → CL 작성
③ 커밋: 작업물 + CL (관심사별 분리)
   복수 관심사인 경우 ②③ 반복
④ Handoff 작성 → 파일 저장 (커밋 없음)
⑤ 재개 안내 출력 → 완료
```

**CL 작성 횟수**: N회 (작업물 관심사 수만큼, handoff 추가 없음)

**검증**:
1. `git status`에서 handoff/ 파일이 보이지 않는지 확인
2. `/wrap` 실행 후 handoff 커밋이 발생하지 않는지 확인
3. CL 작성이 작업물 커밋에만 발생하는지 확인

---

## §9 실제 실행 결과 검증 (2026-03-02)

**검증 세션**: `7c9058d5-4b0f-4634-9a49-0ac97ace2bb0`
**검증 커밋**: `3848df4` — `chore(gitignore): handoff/ git 추적 제외`
**검증 방법**: 이번 세션에서 `/wrap`을 실제 실행하고, 실행 흐름·커밋 내용·git 상태를 직접 관측

---

### 9-1 §7 구현 명세 — 사전 조건 체크

| # | 파일 | 문서의 요구 | 실제 상태 | 결과 |
|---|---|---|---|---|
| 1 | `my-session-wrap/SKILL.md` Step 3-2 | handoff 커밋 단계 제거, 관심사별 분리 커밋으로 재구성 | 이미 반영됨: *"handoff 파일은 커밋하지 않는다. `handoff/`는 `.gitignore`에 등록된 세션 메타데이터"* 명시 | ✅ 완료 |
| 2 | `~/.claude/CLAUDE.md` (글로벌) 33행 | `.gitignore` 초기화 목록에 `handoff/` 추가 | 이미 반영됨: `handoff/` 포함 확인 | ✅ 완료 |
| 3 | `global-rule-improve/.gitignore` | `handoff/` 추가 | 이번 세션에서 커밋 완료 | ✅ 완료 |

**구현 명세 3/3 완료.**

---

### 9-2 §7 결과 워크플로우 — 실행 흐름 비교

| 단계 | 문서 의도 (§7) | 이번 세션 실제 동작 | 일치 | 비고 |
|:---:|---|---|:---:|---|
| ① | `git status` → `handoff/` 미표시 | `git status --short` → ` M .gitignore` 만 표시, handoff/ 없음 | ✅ | gitignore 적용 확인 |
| ② | 커밋 시도 → hook 차단 → CL 작성 | SKILL.md Step 3-1 순서로 **CL 먼저 작성 → 커밋** → hook **미차단** | ⚠️ | 문서는 hook 차단 후 CL 작성을 가정. 실제는 CL 선작성으로 hook 차단 없이 통과. 결과는 동일, 경로가 더 효율적 |
| ③ | 커밋: 작업물 + CL (관심사별 분리) | `git add .gitignore CHANGELOG.md` → 단일 커밋 | ✅ | 단일 관심사라 분리 없음 |
| ④ | Handoff 작성 → 파일 저장 **(커밋 없음)** | handoff 파일 Write로 저장, `git add` 없음 | ✅ | 핵심 개선 사항 |
| ⑤ | 재개 안내 출력 → 완료 | 재개 안내 출력 완료 | ✅ | |

---

### 9-3 §7 검증 항목 — 명시된 3개 체크포인트

| # | 검증 항목 | 결과 | 근거 |
|---|---|:---:|---|
| 1 | `git status`에서 `handoff/` 파일이 보이지 않는지 | ✅ | `git status --short` 출력에 handoff/ 미포함 |
| 2 | `/wrap` 실행 후 handoff 커밋이 발생하지 않는지 | ✅ | 커밋은 `.gitignore` + `CHANGELOG.md` 2개 파일만 포함 (`git show --stat HEAD` 확인) |
| 3 | CL 작성이 작업물 커밋에만 발생하는지 | ✅ | CL 1회 작성, handoff용 추가 작성 없음 |

---

### 9-4 §1-1 핵심 현상 해소 여부

| 구 현상 | 해소 여부 | 이번 세션 관측 |
|---|:---:|---|
| CL 이중 작성 (N+1회) | ✅ | CL 1회만 작성 |
| hook 차단 → 재시도 루프 | ✅ | hook 차단 0회 (CL 선작성으로 원천 방지) |
| wrap 한 번에 끝남 | ✅ | 커밋 1회 → handoff 저장 → 완료 |

---

### 9-5 §8-2 남은 과제 상태

| # | 과제 | 상태 | 비고 |
|---|---|:---:|---|
| 1 | 실제 `/wrap` 실행 검증 | ✅ 이번 세션 | 3개 체크포인트 모두 통과 |
| 2 | 글로벌 CLAUDE.md Changelog 규칙에 "handoff는 CL 기록 대상이 아니다" 명시 (콘텐츠 레벨 면제) | ⚠️ 미완 | 현재 gitignore가 커밋을 막더라도, AI가 CL 본문에 handoff를 언급할 여지 잔존 |

---

### 9-6 부가 발견 — handoff 작성 시점과 실제 완료 시점의 차이

이번 `/wrap`에서 생성된 handoff의 §4에 SKILL.md·글로벌 CLAUDE.md 수정을 "다음 세션 과제"로 기재했으나, **검증 시점(git log 조회)에서 이미 완료된 것으로 확인**됨.

| 항목 | handoff 기재 | 검증 시점 상태 | 판단 |
|---|---|---|:---:|
| SKILL.md Step 3-2 수정 | 다음 세션 과제 | 이미 완료 | handoff 작성 이후 적용된 것으로, 작성 시점 기준으로는 정확 |
| 글로벌 CLAUDE.md gitignore 목록 | 다음 세션 과제 | 이미 완료 (33행 확인) | 동일 |

**결론**: handoff 자체의 오기가 아님. 작성 시점과 검증 시점 간 상태 차이로 인한 외관상 불일치.

---

### 9-7 종합

| 카테고리 | 결과 |
|---|---|
| 구현 명세 완료율 | 3/3 ✅ |
| 워크플로우 흐름 일치 | 4/5 ⚠️ (②번 경로 차이 — 더 효율적) |
| 핵심 현상 해소 | 3/3 ✅ |
| 남은 과제 | 콘텐츠 레벨 면제 1건 ⚠️ |
| handoff 품질 | 작성 시점 기준 정확 (검증 시점 차이로 인한 외관상 불일치) |

**핵심 결론**: 문서가 의도한 "CL 이중 작성 제거" 목표는 달성. 단, 콘텐츠 레벨 면제 명시(§8-2 #2)가 미완으로 남아 있고, handoff에 오기가 포함됨.

---

## §8 추후 과제

### 8-1 고도화 관점 — 핵심목적 달성 현황

| 핵심목적 | 현재 수단 | 달성 여부 | 핵심 gap |
|---|---|---|---|
| wrap이 한 번에 끝남 | gitignore + SKILL.md 커밋 단계 제거 | ⚠️ 미검증 | 실제 `/wrap` 실행으로 동작 확인 필요 |
| AI 자의적 판단 최소화 | gitignore (메커니즘) | ⚠️ 부분 | CL 작성 시 handoff 콘텐츠 제외 여부는 암묵적 — SKILL.md 또는 글로벌 CLAUDE.md에 명시 필요 |
| 규칙 간 충돌 없음 | SKILL.md를 글로벌 규칙과 동일 방향으로 재구성 | ⚠️ 부분 | 글로벌 CLAUDE.md의 CL 규칙에 handoff 면제 미명시 (현재 암묵적 처리) |
| handoff 접근 가능성 | 로컬 파일 읽기 (`/continue`) | ✅ 단일 머신 | 다른 머신 이어가기 불가 — 필요 시 옵션 C로 전환 |
| 프로젝트 이력 깔끔 | gitignore로 handoff 추적 제외 | ✅ 해소됨 | — |

### 8-2 단기 과제 (검증 및 명시화)

1. **실제 `/wrap` 실행 검증**: git 레포가 있는 프로젝트에서 미커밋 작업물이 있는 상태로 `/wrap`을 실행하여 handoff 커밋 미발생 + CL 단일 작성을 확인
2. **CL 콘텐츠 레벨 면제 명시**: 글로벌 CLAUDE.md의 Changelog 규칙에 "handoff 문서는 CL 기록 대상이 아니다" 추가 (현재 gitignore가 커밋을 막더라도, AI가 CL 내용에 handoff를 언급할 여지가 있음)

### 8-3 장기 과제 (조건부 재검토)

- **다른 머신 이어가기 필요해질 때**: handoff를 git 추적 복원 → 옵션 C(CL 범위 축소, 3파일 수정) 전환. §5 AI 리스크 진단 재검토 필수.
- **복수 프로젝트 동시 사용 패턴 변화 시**: `/continue`의 프로젝트 간 handoff 탐색 로직 점검 필요.
