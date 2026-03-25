---
title: dashboard 출력경로 + handoff 파일명 변경
created:
tags:
session_id: (획득 실패)
session_path:
plan:
---

# dashboard 출력경로 + handoff 파일명 변경

---

## 1. 현재 상태

### 작업 목표
1. my-session-dashboard HTML 출력 경로를 `~/.claude/session-dashboard/` → 레포 최상위 `output/`으로 이동
2. handoff 파일명을 `handoff_NN_YYYYMMDD.md` → `handoff_YYYYMMDD_한줄요약.md`로 변경

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| dashboard 출력 경로 변경 | ✅ 완료 | `my-session-dashboard/build.js` |
| dashboard SKILL.md 업데이트 | ✅ 완료 | `my-session-dashboard/skills/session-dashboard/SKILL.md` |
| .gitignore에 output/ 추가 | ✅ 완료 | `.gitignore` |
| handoff 파일명 형식 변경 | ✅ 완료 | `my-session-wrap/.../next-handoff.sh` |
| SKILL.md/README.md 참조 업데이트 | ✅ 완료 | `SKILL.md`, `README.md` |

### 핵심 의사결정 로그
- [출력 경로] 플러그인 내부 `dist/` 대신 레포 최상위 `output/` 채택 → plugin update 충돌 방지
- [파일명 형식] `YYYYMMDD_HHMM` vs `YYYYMMDD_한줄요약` → AI가 자동 추출하는 한줄요약 채택, HHMM은 폴백
- [용어] "slug" → "요약"으로 변경 (사용자 가독성)

---

## 2. 변경 내역 (이번 세션)

### 커밋 완료
- `bac2b1b` feat(my-session-dashboard): 빌드 출력 경로를 레포 최상위 output/으로 변경

### 미커밋 변경
- **`my-session-wrap/.../next-handoff.sh`**: 순번 로직 제거, `SUMMARY` 인자 + HHMM 폴백
- **`my-session-wrap/.../SKILL.md`**: 파일명 형식 및 요약 인자 안내 업데이트
- **`README.md`**: `handoff_NN_YYYYMMDD` → `handoff_YYYYMMDD_한줄요약` 참조 변경

### 미커밋 (다른 작업)
- **`my-session-dashboard/build.js`**: Plan 파싱 기능 추가 (이 세션 작업 아님)
- **`my-session-dashboard/index.html`**: Plan 표시 UI (이 세션 작업 아님)

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- Plan Mode로 사전 검토 → 사용자 피드백 반영이 자연스러웠음

### 레슨
- "slug" 같은 개발 용어를 사용자 대면 문서에 쓰지 말 것 → 한국어 대체어 우선

---

## 4. 다음 세션 작업

- **즉시**: 미커밋 변경사항 (handoff 파일명 관련) 커밋
- **나중**: 기존 `~/.claude/session-dashboard/` 폴더 수동 삭제
- **나중**: 기존 handoff 파일들(`handoff_NN_YYYYMMDD` 형식) 새 형식으로 일괄 리네임 고려
