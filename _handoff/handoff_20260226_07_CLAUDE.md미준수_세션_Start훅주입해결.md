---
title: CLAUDE.md 미준수 문제 → SessionStart 훅 주입으로 해결
created:
tags:
session_id: adbc7042-3798-4ece-82e8-8d01e3fb890d
session_path:
plan:
---

# CLAUDE.md 미준수 문제 → SessionStart 훅 주입으로 해결 (세션 07)

---

## 0. 초기 문제 정의

**증상**: Claude가 `my-claude-plugins` 폴더에서 작업할 때 프로젝트 CLAUDE.md의 플러그인 배포 절차를 읽지 않고 임의 순서로 진행하여 사용자 개입이 반복적으로 필요했다.

**핵심 질문**: CLAUDE.md는 이미 컨텍스트에 로드되는데, 왜 Claude가 절차를 준수하지 않는가?

**진단**: 접근 불가 문제가 아니라 **준수 실패** 문제. 일반 지식이 프로젝트 절차를 override함.

---

## 1. 현재 상태

### 작업 목표
Claude가 `my-claude-plugins` 폴더에서 세션 시작 시 플러그인 배포 절차(A/B)를 자동으로 인식하도록 SessionStart 훅 주입 구현.

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| 문제 정의 및 옵션 도출 | ✅ 완료 | - |
| `inject-plugin-guidelines.js` 훅 작성 | ✅ 완료 | `my-session-wrap/hooks/inject-plugin-guidelines.js` |
| hooks.json 등록 | ✅ 완료 | `my-session-wrap/hooks/hooks.json` |
| EEXIST 섹션 동적 감지 로직 추가 | ✅ 완료 | - |
| 캐시 반영 및 동작 검증 | ✅ 완료 | - |
| Hook세팅가이드 문서 업데이트 | ✅ 완료 | `docs/Hook세팅가이드_20260224.md` |

---

## 2. 원인 진단

| 가설 | 검증 결과 |
|------|-----------|
| Claude가 CLAUDE.md에 접근 불가 | ❌ CLAUDE.md는 이미 claudeMd system-reminder로 자동 로드됨 |
| 내용은 있으나 절차 준수 실패 | ✅ 일반 지식이 프로젝트 절차를 override하는 LLM 특성 |
| 특정 섹션이 눈에 안 띔 | ✅ 긴 CLAUDE.md에서 배포 절차 섹션이 묻힘 |

**결론**: CLAUDE.md에 아무리 내용을 추가해도 Claude가 자발적으로 따르도록 강제할 수 없다. **외부에서 컨텍스트를 주입**해야 한다.

---

## 3. 옵션 도출과 평가

| 옵션 | 설명 | 평가 |
|------|------|------|
| C. CLAUDE.md 구조 강화 | 배포 절차 앞에 강조 마커 추가 | ❌ 제외 — "안 읽는데 추가해봤자 무의미" |
| A. UserPromptSubmit 훅 (키워드 조건) | 프롬프트에 "플러그인" 등 키워드 포함 시 주입 | △ 커버리지 낮음 (모호한 프롬프트 미감지) |
| A'. UserPromptSubmit 훅 (cwd 조건) | `my-claude-plugins` 폴더이면 매 프롬프트 주입 | △ 노이즈 과다 |
| B. `/plugin-update` 슬래시 커맨드 | 체크리스트 강제 커맨드 | △ 사용자가 직접 입력해야 함 |
| **채택: SessionStart 훅 + cwd 조건** | 세션 시작 시 폴더 감지 → 절차 1회 주입 | ✅ 자동·조용·높은 커버리지 |

---

## 4. 실행 계획 → 실행 결과

### 계획
1. `inject-plugin-guidelines.js` SessionStart 훅 작성
2. CLAUDE.md의 EEXIST 버그 워크어라운드 섹션 존재 여부로 출력 분기
3. EEXIST 섹션 있음 → A/B 절차 인라인 포함 출력
4. EEXIST 섹션 없음 → 정식 절차만 + 훅 정리 권장 알림 (반복)
5. hooks.json 등록 → 캐시 반영 → 검증

### 실행 결과
- 훅 로직 정상 (단계별 파일 디버깅으로 확인)
- hook stdout → Claude 컨텍스트(system-reminder)에 주입됨 확인
  - 검증: 새 세션에서 "방금 훅으로 받은 내용이 있는가?" 질문 → Claude가 내용 답변

---

## 5. 평가 결과표

| 항목 | 목표 | 결과 | 판정 |
|------|------|------|------|
| Claude가 절차를 인식하는가 | 세션 시작 시 A/B 절차가 컨텍스트에 주입 | ✅ system-reminder로 주입 확인 | ✅ |
| 자동 동작하는가 | 사용자 개입 없이 실행 | ✅ SessionStart 훅 자동 실행 | ✅ |
| cwd 조건이 정확한가 | my-claude-plugins 폴더에서만 발동 | ✅ cwd 포함 여부로 정확 감지 | ✅ |
| EEXIST 버그 해결 후 자동 전환 | 섹션 삭제 시 정식 절차로 전환 | ✅ CLAUDE.md 읽어 동적 분기 | ✅ |
| 버그 수정 후 사용자 알림 | 정리 권장 메시지 반복 표시 | ✅ 매 세션 알림 | ✅ |
| **실제 준수율 개선** | Claude가 절차를 따르는가 | 🔄 다음 세션부터 관찰 필요 | 진행중 |

> 마지막 항목(실제 준수율)은 이번 세션에서 구현 완료, **다음 세션들에서 효과 관찰 필요**.

---

## 6. 변경 내역 (이번 세션)

- `my-session-wrap/hooks/inject-plugin-guidelines.js` — 신규: SessionStart cwd 기반 배포 절차 주입 훅
- `my-session-wrap/hooks/hooks.json` — inject-plugin-guidelines 훅 등록
- `my-session-wrap/.claude-plugin/plugin.json` — 2.2.0 → 2.3.0
- `.claude-plugin/marketplace.json` — 버전 동기화
- `docs/Hook세팅가이드_20260224.md` — §6에 "hook stdout → Claude 컨텍스트 주입" 내용 추가
- `CHANGELOG.md` — 이번 세션 커밋 4건 기록

---

## 7. 발견 & 교훈

- **발견**: hook stdout은 사용자 터미널이 아닌 Claude 컨텍스트(system-reminder)에만 주입된다. 터미널에 안 보인다고 동작 안 하는 게 아님.
- **발견**: CLAUDE.md 내용이 컨텍스트에 있어도 Claude가 준수하지 않을 수 있다. 강제 주입이 필요.
- **실수 → 교훈**: 훅에서 "CLAUDE.md 워크어라운드 섹션 참조하라"고만 써두면 동일 문제 반복. 절차를 인라인으로 포함해야 효과 있음.

---

## 8. 다음 세션

- 실제 플러그인 작업 시 훅 주입 내용이 Claude 행동에 영향을 주는지 관찰
- 효과 없으면 B안(`/plugin-update` 커맨드) 추가 검토
