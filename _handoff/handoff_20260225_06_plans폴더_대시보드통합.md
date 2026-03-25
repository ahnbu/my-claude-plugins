---
title: my-session-dashboard plans 폴더 통합
created:
tags:
session_id: (획득 실패)
session_path:
plan:
---

# my-session-dashboard plans 폴더 통합

---

## 1. 현재 상태

### 작업 목표
- `~/.claude/plans/` 폴더의 .md 파일을 세션 대시보드에서 검색·조회할 수 있도록 통합

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| Plan Mode 검토 | ✅ 완료 | abstract-chasing-seal.md |
| build.js 데이터 파이프라인 | ✅ 완료 | my-session-dashboard/build.js |
| index.html 뷰어 통합 | ✅ 완료 | my-session-dashboard/index.html |
| 빌드 검증 | ✅ 완료 | 130세션 + 50플랜 정상 처리 |
| 브라우저 렌더링 확인 | ⬜ 미확인 | Chrome MCP 연결 실패 |

### 핵심 의사결정 로그
- [통합 방식] 별도 탭 대신 세션 목록에 혼합 표시 + `type` 필터. 이유: 기존 필터 구조와 자연스럽게 통합, 검색도 통합 가능
- [세션-plan 연결] 이번 구현에서 제외. 이유: plan에 세션 ID 없어 시간대/경로 매칭은 오매칭 위험
- [완료 마커] `# 완료됨` 패턴 → isCompleted 플래그 + 회색 처리. 필터에서 분리 조회 불가 (plan 전체만 필터링)

### 다음 세션 시작점
- 브라우저에서 대시보드를 열어 plan 렌더링 확인 필요 (Chrome MCP 미연결로 미확인)
- 확인 후 문제 없으면 커밋 진행

---

## 2. 변경 내역 (이번 세션)

### `my-session-dashboard/build.js` (+147줄)
- `PLANS_DIR` 상수 추가
- `parsePlan(filePath)`: .md 파일 파싱 → metadata(planId, type, title, slug, isCompleted, keywords, project 등) + content
- `loadPlans(cache, newCache)`: plans 디렉토리 스캔, mtime 기반 증분 캐시 (`"plan:"` 접두사 키)
- `main()`: sessionResults + planResults 병합, 세션에 `type: "session"` 명시, sessionsData에 plan content 추가

### `my-session-dashboard/index.html` (+200줄)
- CSS: `--plan-accent`, `--plan-bg` 변수, `.plan-item`, `.completed`, `.type-badge`, `.filter-separator`, `.plan-content` h2/h3 스타일
- `activeTypeFilter` 상태 변수 추가
- `renderStats()`: 세션/플랜 개수 분리 표시
- `buildFilters()`: 타입 필터(전체/세션/플랜) + 구분선 + 프로젝트 필터
- `getFilteredSessions()`: 타입 필터 조건 + plan content 2000자 검색
- `renderSessionList()`: plan 아이템 전용 렌더링 (초록 border, PLAN/완료 배지, 글자수)
- `selectSession()`: plan 분기 → `showPlanDetail()`
- `showPlanDetail()`: plan 상세 뷰 (제목, slug, mtime, 글자수 + 마크다운 렌더링)
- `renderPlanMarkdown()`: h1/h2/h3, 코드블록, 인라인코드, bold 지원

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- Plan Mode로 구조 설계 후 구현하여 build.js/index.html 변경이 체계적
- 기존 캐시 시스템(`"plan:"` 접두사)을 자연스럽게 확장하여 재빌드 시 50개 플랜 모두 캐시 히트

### 문제·병목
- Chrome MCP 연결 실패로 브라우저 렌더링 직접 확인 불가

### 레슨
- plan 파일에 세션 ID/타임스탬프 등 메타데이터가 없어 연결이 불가능 → 향후 plan 생성 시 메타데이터 주입 고려

---

## 4. 다음 세션 작업

- **즉시**: 브라우저에서 대시보드 렌더링 확인 (타입 필터, plan 상세, 검색)
- **다음**: 확인 후 git commit + plugin.json 버전 업데이트
- **나중**: 완료/미완료 plan 세분화 필터, plan 내 리스트(`- 항목`) 렌더링 개선
