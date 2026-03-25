---
title: "플러그인 수동 설치 & EEXIST 대처 문서화"
created:
tags:
session_id: c6ea7dee-cf5d-448c-9788-150846eefe35
session_path:
plan:
---

# 플러그인 수동 설치 & EEXIST 대처 문서화

---

## 1. 현재 상태

### 작업 목표
EEXIST 버그로 막힌 `my-session-dashboard` 플러그인을 수동 설치하고, 관련 절차를 문서화

### 진행 현황

| 단계 | 상태 | 산출물 |
|------|------|--------|
| EEXIST 버그 현황 확인 (v2.1.59) | ✅ 완료 | — |
| my-session-dashboard 수동 설치 | ✅ 완료 | `installed_plugins.json`, `settings.json` |
| /ss 동작 확인 | ✅ 완료 | — |
| CLAUDE.md 수동 설치 절차 업데이트 | ✅ 완료 | `CLAUDE.md` |
| docs/ 신규 생성 + 에러 대처 문서 작성 | ✅ 완료 | `docs/플러그인에러대처_20260226.md` |
| /ss-new 임시 커맨드 삭제 | ✅ 완료 | `~/.claude/commands/ss-new.md` 삭제 |

### 핵심 의사결정 로그
- [결정 1] 신규 플러그인 설치 절차를 기존 업데이트 절차(A)와 분리하여 CLAUDE.md에 A/B로 명시
- [결정 2] 워크어라운드 절차를 CLAUDE.md에서 삭제하지 않고 `docs/플러그인에러대처_20260226.md`에 영구 보존
- [결정 3] /ss-new는 my-session-dashboard 설치 완료로 역할 종료 → 삭제

### 다음 세션 시작점
특별한 이어가기 작업 없음. 필요 시 CHANGELOG 업데이트 및 git commit.

---

## 2. 변경 내역 (이번 세션)

- **`CLAUDE.md`** 수정: 수동 캐시 동기화 섹션을 A(기존 플러그인 업데이트) / B(신규 플러그인 설치)로 분리
  - B 절차에 `settings.json → enabledPlugins` 추가 필요 명시
  - `cp -r /* ` 대신 `cp -r /.` 사용 (숨김 디렉토리 포함) 주의사항 추가
- **`~/.claude/plugins/installed_plugins.json`** 수정: `my-session-dashboard@my-claude-plugins` 항목 추가
- **`~/.claude/settings.json`** 수정: `enabledPlugins`에 `"my-session-dashboard@my-claude-plugins": true` 추가
- **`docs/플러그인에러대처_20260226.md`** 신규: EEXIST 버그 원인·워크어라운드 A/B 영구 참조 문서
- **`~/.claude/commands/ss-new.md`** 삭제: my-session-dashboard 설치 완료로 불필요

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- `installed_plugins.json`만으로는 부족하고 `settings.json → enabledPlugins`도 필요하다는 것을 실패에서 빠르게 파악
- `/ss` 실행 결과에서 `PLUGIN_DIR` 경로를 보고 마켓플레이스 클론 vs 캐시 vs dev repo 구분을 즉시 진단

### 문제·병목
- `cp -r .../*` 로 복사 시 `.claude-plugin/` 숨김 디렉토리가 누락 → diff 후 발견하여 추가 복사
- `scripts/next-handoff.sh` 경로가 없어 handoff 파일명을 수동으로 결정

### 레슨 (재사용 가능한 교훈)
- [규칙 후보] 플러그인 수동 설치 시 `installed_plugins.json` + `settings.json` 두 파일 모두 수정 필수
- [규칙 후보] `cp -r <src>/*` 대신 `cp -r <src>/.` 사용 — 숨김 디렉토리 누락 방지

---

## 4. 다음 세션 작업

- **나중**: CHANGELOG.md에 이번 세션 변경 사항 기록 후 git commit

---

## 5. 발견 & 교훈

- **발견**: Claude Code는 플러그인 인식에 `installed_plugins.json`(설치 기록)과 `settings.json → enabledPlugins`(UI 표시 + 활성화) 두 파일을 모두 사용
- **발견**: `/ss` 스킬은 캐시가 아닌 마켓플레이스 클론(`marketplaces/my-claude-plugins/...`)을 직접 참조하도록 SKILL.md에 하드코딩되어 있음 — 의도된 설계
- **실수 → 교훈**: `cp -r .../*` glob은 숨김 파일/디렉토리를 포함하지 않음. 반드시 `/.` 또는 명시적 경로 사용

---

## 6. 환경 스냅샷

- **Claude Code**: v2.1.59
- **EEXIST 버그**: 미해결 (`/plugin update`, UI 설치, UI 마켓플레이스 삭제 모두 실패)
- **워크어라운드**: 수동 git pull + 캐시 복사 + JSON 편집 (CLAUDE.md § EEXIST 버그 워크어라운드 참조)
- **my-session-dashboard**: 수동 설치 완료 (v1.1.0), `/ss` 정상 동작 확인
