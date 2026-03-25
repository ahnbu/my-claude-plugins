---
title: docs 파일명 규격 통일 및 글로벌 규칙 반영
created:
tags:
session_id: c5fe4eea-0f10-4f91-aaa4-44dcca016984
session_path:
plan:
---

# docs 파일명 규격 통일 및 글로벌 규칙 반영 (세션 01)

---

## 1. 현재 상태

### 작업 목표
docs 폴더 전체의 파일명을 `YYYYMMDD_이슈명.md` 규격으로 통일하고, 글로벌·프로젝트 CLAUDE.md에 규칙 반영

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| docs/my-session-wrap/ 파일명 정리 | ✅ 완료 | 13개 파일 리네임, handoff/ 서브폴더 분리 |
| docs/공통·my-session-id·my-session-dashboard 정리 | ✅ 완료 | 6개 파일 리네임 (일부 미커밋) |
| study-doc-system → docs/문서시스템연구/ 이동 | ✅ 완료 | 7개 파일, 폴더 한글화 |
| study-session-history-analysis → docs/세션이력분석/ 이동 | ✅ 완료 | 3개 파일, 폴더 한글화 |
| 루트 서브에이전트 파일 → docs/공통/ 이동 | ✅ 완료 | 1개 파일 |
| 프로젝트 CLAUDE.md 문서 파일명 규칙 섹션 추가 | ✅ 완료 | `## 문서 파일 이름 규칙` 신설 |
| 글로벌 CLAUDE.md 비개발 문서 파일명 규칙 수정 | ✅ 완료 | `YYYYMMDD_이슈명.md` 포맷으로 변경 |
| global-rule-improve CHANGELOG 업데이트 | ✅ 완료 | 이미 커밋됨 |

### 핵심 의사결정 로그
- [결정 1] `YYYYMMDD_이슈명` (날짜 앞) 채택. 이유: ai-study 통합 참조 프로젝트와 일치, 날짜 기준 정렬 용이
- [결정 2] study-* 폴더명 한글화. 이유: 플러그인 소스 폴더와 명확히 구분, 일관성
- [결정 3] handoff 파일은 `handoff/` 서브폴더로 분리. 이유: CLAUDE.md 규격 준수

### 다음 세션 시작점
- docs/공통/ 미추적 파일 4개 커밋 필요 (git add + commit)
- 이후 추가 정리 작업 없음

---

## 2. 변경 내역 (이번 세션)

### git 커밋된 변경 (2개 커밋)
- `docs(my-session-wrap)`: 13개 파일 리네임 + handoff/ 서브폴더 생성, CLAUDE.md 문서 파일명 규칙 섹션 추가, CHANGELOG 업데이트
- `docs`: study-doc-system(7개)·study-session-history-analysis(3개) → docs/문서시스템연구·세션이력분석으로 이동, 루트 파일 → docs/공통, my-session-id·my-session-dashboard 파일 리네임

### 미커밋 (docs/공통/ — 미추적)
- `docs/공통/20260224_Hook세팅가이드.md` (구: `docs/Hook세팅가이드_20260224.md`)
- `docs/공통/20260226_플러그인_에러대처.md`
- `docs/공통/20260226_플러그인_중복호출_문제해결.md`
- `docs/공통/20260227_가설기반_실험템플릿_스킬전략.md`
- (대응하는 구 파일 3개 삭제 상태)

### 글로벌 CLAUDE.md (`~/.claude/CLAUDE.md`)
- `비개발 문서 파일명` 규칙: `한글제목_YYYYMMDD` → `YYYYMMDD_이슈명` + 공백·괄호·쉼표 금지 + 불필요 태그 금지
- global-rule-improve CHANGELOG에 변경 이력 추가, 스냅샷 저장

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- 참조 프로젝트(`ai-study 통합`)를 실제로 확인해서 규격 근거를 명확히 함
- git mv로 이력 보존하며 리네임 진행
- 글로벌 규칙까지 일관되게 반영

### 문제·병목
- docs/공통/ 파일들이 git 미추적 상태였음 — 리네임 후에도 untracked로 남아 있어 커밋 누락

### 레슨
- 미추적 파일의 리네임은 git mv가 아니라 mv로 처리되므로, 커밋 시 git add 별도 필요
- [규칙 후보] 폴더 단위로 git 추적 여부를 먼저 확인 후 mv 방식(git mv vs mv) 결정

### 개선 액션
- 향후 파일 정리 시: `git ls-files` 먼저 확인 → 추적 여부에 따라 mv 방식 분기
- 적용 범위: 이 프로젝트 한정

---

## 4. 다음 세션 작업

- **즉시**: docs/공통/ 미커밋 파일 4개 + 삭제된 구파일 3개 커밋
  ```bash
  cd C:/Users/ahnbu/.claude/my-claude-plugins
  git add docs/공통/
  git commit -m "docs(공통): 파일명 규격 통일 — YYYYMMDD_이슈명 포맷 적용"
  ```
- **나중**: 다른 플러그인 docs 폴더(my-cowork 등) 동일 규격 적용 여부 검토
