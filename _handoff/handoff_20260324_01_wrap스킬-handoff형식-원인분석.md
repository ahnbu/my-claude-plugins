---
title: wrap 스킬 handoff 형식 불일치 원인 분석
date: 2026-03-24
session_id: b991d4af-5030-4c29-8f99-80c84ee85694
session_path: "C:/Users/ahnbu/.claude/projects/D--CloudSync-90-------handoff/b991d4af-5030-4c29-8f99-80c84ee85694.jsonl"
tokens_in: 6000K
tokens_out: 24K
tools: "Bash(14), Read(6), Glob(4), Skill(3), Write(2), Edit(2), ToolSearch(2), Agent(1), ExitPlanMode(1)"
status: 세션완료
---

# wrap 스킬 handoff 형식 불일치 원인 분석 (세션 01)

---

## 1. 현재 상태

### 작업 목표
`/wrap` 호출 시 handoff 형식이 세션마다 제각각인 원인을 규명하고, SKILL.md 수정으로 일관성 보장

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| 이전 세션 컨텍스트 복원 | ✅ 완료 | - |
| 90_자료수집 세션 3건 Read 검증 | ✅ 완료 | - |
| ai-study 세션 8건 전수 조사 | ✅ 완료 | - |
| Codex 세션 JSONL 검증 (session-find) | ✅ 완료 | - |
| 원인 확정 및 수정 방안 계획 수립 | ✅ 완료 | `plans/modular-churning-sutherland.md` |
| 분석 결과 문서화 (doc-save) | ✅ 완료 | `_docs/20260324_13_wrap스킬-handoff형식-불일치-원인분석.md` |
| SKILL.md Step 2-3 수정 실행 | ⬜ 미착수 | - |
| 수정 후 `/wrap` 호출 검증 | ⬜ 미착수 | - |

### 핵심 의사결정 로그
- [결정 1] template.md Read 강제 대신 SKILL.md 본문에 BQ 헤더 형식 인라인 포함 채택. 이유: Read 호출 자체를 생략할 수 있음 (`_20260323_03` 직접 증거 — SKILL.md 읽었지만 template.md 미읽음 → YAML 발생). SKILL.md에 형식을 직접 기재하면 SKILL.md만 읽어도 형식 보장됨
- [결정 2] Layer 1 문제(SKILL.md 자체를 안 읽는 경우) 보류. 이유: 커맨드 시스템 한계로 스킬 파일 수정으로 해결 불가, 빈도 낮음

### 다음 세션 시작점
- `C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\my-session-wrap\SKILL.md` Step 2-3 수정
- 변경 내용: `"템플릿은 references/template.md 참조."` 앞에 BQ 헤더 형식 인라인 추가 + YAML frontmatter 금지 명시
- 수정 후 `/wrap` 호출하여 생성된 handoff 첫 줄이 `# Handoff —`로 시작하는지 검증

---

## 2. 변경 내역 (이번 세션)

- `C:/Users/ahnbu/.claude/my-claude-plugins/_docs/20260324_13_wrap스킬-handoff형식-불일치-원인분석.md` — 신규 생성 (분석 결과 문서, 전체 데이터 표 포함)
- `C:/Users/ahnbu/.claude/plans/modular-churning-sutherland.md` — 신규 생성 (SKILL.md 수정 계획)
- `SKILL.md` (wrap) — 수정 후 롤백 (최종 변경 없음)

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- JSONL 직접 파싱으로 "Read 도구 호출 흔적"을 추출하는 방식이 효과적 — 가설을 데이터로 증명
- session-find 스킬로 Codex JSONL 경로를 빠르게 탐색
- 11건 handoff + 세션 JSONL 대조로 원인을 확정적으로 규명

### 문제·병목
- 수정 1차 시도를 사용자 요청으로 롤백 → 원인 분석과 수정 실행을 같은 세션에서 하지 않도록 충분히 분석 먼저

### 레슨 (재사용 가능한 교훈)
- "JSONL에서 특정 tool_use Read 호출이 있는지 파싱"하는 패턴은 스킬 동작 검증에 범용적으로 재사용 가능
- "참조" 문구만으로는 AI가 Read 실행을 강제받지 않음 — 형식 명세는 AI가 반드시 읽는 파일(SKILL.md)에 직접 인라인해야 함 [규칙 후보]

### 개선 액션
- SKILL.md Step 2-3에 BQ 헤더 형식 인라인 포함 (다음 세션에서 실행)
- 적용 범위: 전역 지침 반영 (my-session-wrap 플러그인)

---

## 4. 다음 세션 작업

- **즉시**: SKILL.md Step 2-3 수정 실행 (plan 파일 참조: `plans/modular-churning-sutherland.md`)
- **즉시**: 수정 후 `/wrap` 호출 → 형식 검증 (BQ 헤더, YAML frontmatter 없음)
- **나중**: Layer 1 문제(SKILL.md 자체 미읽기) 발생 빈도 모니터링

---

## 5. 발견 & 교훈

- **발견**: SKILL.md를 읽었어도 "참조"라는 문구만으로는 AI가 template.md를 Read하지 않음 — `_20260323_03` 세션이 직접 증거 (SKILL.md Read 1회, template.md Read 0회 → YAML 생성)
- **발견**: Read 도구 호출은 JSONL에 `tool_use` 레코드로 정확히 남음 — "읽었어도 기록에 안 남을 수 있다"는 우려는 사실이 아님
- **발견**: 90_자료수집 세션이 BQ 형식으로 나온 이유 중 `6a1ada54` 케이스(SKILL.md만 읽고 BQ 형식)는 컨텍스트 내 다른 BQ 힌트 추론으로 추정 — 재현 불확실, 모델 운에 의존
- **실수 → 교훈**: 수정 방향을 충분히 검토하기 전에 SKILL.md를 수정했다가 롤백. 원인 분석 → 계획 수립 → 승인 → 실행 순서를 지켜야 함
