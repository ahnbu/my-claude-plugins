---
title: EEXIST GitHub 보고 및 플러그인 진단
created:
tags:
session_id: (획득 실패)
session_path:
plan:
---

# EEXIST GitHub 보고 및 플러그인 진단

---

## 1. 현재 상태

### 작업 목표
1. Bash EINVAL workaround를 GitHub #28348에 공유
2. EEXIST 버그를 GitHub #27791에 보고
3. 플러그인 설치 상태 전체 진단
4. 진단문서 정비 및 파일 정리

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| GitHub #28348 코멘트 | ✅ 완료 | [코멘트](https://github.com/anthropics/claude-code/issues/28348#issuecomment-3956510794) |
| GitHub #27791 코멘트 | ✅ 완료 | [코멘트](https://github.com/anthropics/claude-code/issues/27791#issuecomment-3956538753) |
| 플러그인 진단 | ✅ 완료 | 7개 모두 정상, 고아 캐시 6개 삭제 |
| 수동 git pull 테스트 | ✅ 완료 | Update marketplace 대체 수단 확인 |
| 진단문서 handoff 이동 | ✅ 완료 | `handoff/handoff_20260225_EEXIST버그-진단.md` |
| 파일 정리 | ✅ 완료 | plugin-bugfix/ 삭제, temp/ 생성 |

### 핵심 의사결정 로그
- [이슈 전략] 별도 이슈 vs #27791 코멘트 → 코멘트 채택 (동일 근본 원인, 코드 경로만 다름)
- [frontend-design] 공식 마켓 설치 실패 → `example-skills` 플러그인에 이미 포함, 그대로 사용

---

## 2. 변경 내역 (이번 세션)

### 커밋 완료
- `ba82927` docs: Bash EINVAL·EEXIST 버그 진단 handoff 문서 추가
- `dcceca1` docs: EEXIST 진단문서에 플러그인 상태 진단·고아 캐시 정리 내역 추가
- `5f6ad32` docs: 수동 git pull workaround 성공 확인 반영

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- GitHub 이슈 조사를 서브에이전트에 위임하여 중복 이슈 확인 후 적절한 보고 전략 선택

### 레슨
- EEXIST로 플러그인 업데이트 불가 시 수동 `git pull`로 대체 가능

---

## 4. 다음 세션 작업

- **대기**: Marketplace 에러 메시지 ("Failed to install Anthropic marketplace") — Claude Code 측 EEXIST 수정 대기
- **참고**: frontend-design은 `example-skills` 플러그인에 포함되어 사용 가능
