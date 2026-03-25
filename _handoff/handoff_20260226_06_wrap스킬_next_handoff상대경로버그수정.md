---
title: /wrap 스킬 next-handoff.sh 상대경로 버그 수정
created:
tags:
session_id: 80b79c70-8cb6-4192-93f1-a211cad947bc
session_path:
plan:
---

# /wrap 스킬 next-handoff.sh 상대경로 버그 수정 (세션 06)

---

## 1. 현재 상태

### 작업 목표
`/wrap` 스킬이 타 프로젝트에서 호출될 때 `scripts/next-handoff.sh` 미발견으로 실패하는 버그 수정.

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| 버그 원인 분석 | ✅ 완료 | - |
| SKILL.md 인라인 bash로 교체 | ✅ 완료 | `my-session-wrap/skills/my-session-wrap/SKILL.md` |
| CHANGELOG.md 업데이트 | ✅ 완료 | `CHANGELOG.md` |
| git commit + push | ✅ 완료 | `1c485ae` |
| marketplace pull → cache 재복사 | ✅ 완료 | cache/my-session-wrap/2.2.0/ |
| installed_plugins.json gitCommitSha 업데이트 | ✅ 완료 | `1c485aee...` |
| diff 검증 | ✅ 완료 | 차이 없음 |

### 핵심 의사결정 로그
- [결정 1] `scripts/next-handoff.sh` 외부 스크립트 호출 대신 SKILL.md 내 인라인 bash로 교체. 이유: 스킬이 로드되는 현재 작업 디렉토리가 플러그인 설치 경로가 아니므로 상대 경로 참조 불가.
- [결정 2] `next-handoff.sh` 스크립트 파일 자체는 삭제하지 않음. 이유: 요청 범위 초과, 다른 용도로 활용될 수 있음.

### 다음 세션 시작점
- 버그 수정 완료. 특별히 이어갈 작업 없음.

---

## 2. 변경 내역 (이번 세션)

- `my-session-wrap/skills/my-session-wrap/SKILL.md` — Step 2-2의 `bash "scripts/next-handoff.sh"` 호출을 인라인 bash heredoc으로 교체
- `CHANGELOG.md` — fix 항목 1건 추가

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- 사용자가 관련 문서(`플러그인 에러대처_20260226.md`, `CLAUDE.md`)를 체크하도록 유도하여 처음에 누락한 올바른 업데이트 순서를 복구함.
- diff 검증으로 캐시 동기화 완전성 확인.

### 문제·병목
- AI가 처음에 CLAUDE.md의 워크어라운드 절차를 준수하지 않고 dev repo → cache 직접 복사를 먼저 수행함. 사용자 개입으로 수정.

### 레슨 (재사용 가능한 교훈)
- [플러그인 업데이트 시]에는 반드시 CLAUDE.md 워크어라운드 A 순서(push → marketplace pull → cache 복사 → installed_plugins.json 업데이트)를 따를 것. [규칙 후보]
- [스킬에서 외부 스크립트 참조 시]에는 상대 경로를 사용하면 타 프로젝트에서 호출 시 반드시 실패함. 인라인 bash 또는 절대 경로 사용할 것.

### 개선 액션
- 적용 범위: 전역 지침 반영 후보 (`[규칙 후보]` 태그 확인)

---

## 4. 다음 세션 작업

- **나중**: `next-handoff.sh` 스크립트 파일 정리 여부 검토 (현재는 미삭제)

---

## 5. 발견 & 교훈

- **발견**: SKILL.md의 bash 명령은 현재 세션의 작업 디렉토리(cwd) 기준으로 실행됨. 플러그인 설치 경로가 아님.
- **실수 → 교훈**: 플러그인 변경 시 CLAUDE.md 워크어라운드를 먼저 확인하지 않고 임의 순서로 진행 → 사용자 개입 필요. 변경 전 CLAUDE.md 배포 섹션을 항상 먼저 읽을 것.
