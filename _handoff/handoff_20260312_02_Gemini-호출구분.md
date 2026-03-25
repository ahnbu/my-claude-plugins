---
title: Gemini 호출구분
created:
tags:
session_id: 019ce003-5ade-7120-8c72-9bb79bf874cc
session_path: "C:/Users/ahnbu/.codex/sessions/2026/03/12/rollout-2026-03-12T12-07-22-019ce003-5ade-7120-8c72-9bb79bf874cc.jsonl"
plan:
---

# Gemini 호출구분 (세션 02)

---

## 1. 현재 상태

### 작업 목표
- Codex가 호출한 Gemini 세션과 사용자가 직접 실행한 Gemini 세션을 안정적으로 구분하는 방법을 설계한다.

### 진행 현황
| 단계 | 상태 | 산출물 |
|---|---|---|
| Codex 경유 Gemini env dump 생성 및 재생성 | ✅ 완료 | `gemini_env_from_codex.json`, `gemini_env_from_codex.txt` |
| Codex vs direct Gemini env 비교 및 정정 | ✅ 완료 | `20260312_Codex_Gemini_호출구분_실험일지.md` |
| 세션 DB, parser, build 경로 검토 | ✅ 완료 | `shared/session-db.js`, `shared/session-parser.js`, `my-session-dashboard/build.js` |
| 옵션 비교 및 최유력안 도출 | ✅ 완료 | `20260312_Codex_Gemini_호출구분_실험일지.md` |
| `SessionStart` hook input에 `sessionId` 존재 여부 검증 | ⬜ 미착수 | - |

### 핵심 의사결정 로그
- [결정] 단순 env 비교로 Codex-origin Gemini를 구분하는 접근은 기각. 이유: direct Gemini와 비교 시 차이가 사실상 `Path` 1개뿐이었다.
- [결정] `project alias 제외` 방식은 기각. 이유: alias가 날짜/환경에 따라 달라져 출처 식별자로 부적절하다.
- [결정] `지속시간 휴리스틱`은 fallback 후보로 유지. 이유: 현재 데이터셋에서는 잘 맞지만 본질적으로 오탐, 미탐이 남는다.
- [결정] 현재 최유력안은 `인터셉트 wrapper + env 주입 + Gemini SessionStart hook + mini DB`. 이유: 프롬프트 오염 없이 출처를 실행 시점에 기록할 수 있고, 사후 휴리스틱 의존을 크게 줄일 수 있다.
- [정정] `Codex DB 교차 참조는 의미 없음`이라는 중간 평가는 틀렸음. 실제 Codex 원본 JSONL에 `gemini` 호출 흔적과 시각이 남아 있어 보조 근거로는 유의미하다.

### 다음 세션 시작점
- 먼저 `~/.gemini/extensions/bkit/hooks/scripts/session-start.js`가 실제 실행될 때 stdin JSON에 `sessionId`가 포함되는지 확인한다.
- 확인되면 wrapper에서 `CALLER_RUNTIME=codex` 같은 marker를 주입하고, SessionStart hook가 `{sessionId, source, project, startedAt}`를 mini DB에 적재하는 POC를 설계한다.

---

## 2. 변경 내역 (이번 세션)

- `20260312_Codex_Gemini_호출구분_실험일지.md` 신규 작성
  - env dump 생성/재생성
  - 잘못된 env 비교 결론과 정정
  - `bd4f4168` 미표시 이슈 재검토
  - 옵션 A~E 비교표
  - 가설 검증표
  - 최유력안과 남은 팩트체크 정리
- `_handoff/handoff_20260312_02_Gemini-호출구분.md` 신규 작성
- `CHANGELOG.md` 업데이트 예정 또는 반영

실제 확인한 결과:

- `gemini_env_from_codex.json`과 `gemini_env_from_gemini_cli.json`은 정규화 비교 시 59개 키로 동일했고, 차이는 `Path` 1개뿐이었다.
- 최신 Gemini 세션 파일은 `~/.gemini/tmp/my-claude-plugins/chats/`에 존재했지만 DB recent 목록에는 없었다. 현재 구조상 Gemini는 `build.js` 실행 시점에만 DB sync된다.
- `gemini:bd4f4168-...` 세션은 이미 DB에 존재했다. 따라서 "항상 파싱 누락"으로 단정하면 안 된다.
- Codex 원본 세션 JSONL에는 `gemini` 호출 문자열과 시각이 남는다.

---

## 3. 피드백 루프

### 잘된 점
- env dump를 실제 파일로 생성하고 재검증해, 추정이 아니라 파일 기반으로 결론을 정리했다.
- 잘못된 JSON 비교 방식이 있었음을 중간에 발견하고 정정했다.
- 옵션을 "규칙 기반 wrapper"와 "기술적 인터셉트 wrapper"로 분리해 논의를 명확히 했다.

### 문제·병목
- 처음에는 `gemini_env_from_gemini_cli.json` 구조를 잘못 해석해 차이점 판단이 틀어졌다.
- `bd4f4168` 미표시 문제는 당시 UI 상태를 재현하지 못해 완전한 원인 규명이 되지 않았다.
- `SessionStart` hook에서 실제 `sessionId`가 들어오는지 아직 실험하지 못했다. 이 1건이 설계 확정의 마지막 병목이다.

### 레슨
- [환경 비교]에서는 JSON 포맷을 먼저 정규화하지 않으면 잘못된 diff 결론이 나오기 쉽다.
- [호출 구분 설계]에서는 휴리스틱보다 실행 시점의 명시적 기록이 훨씬 설명 가능성이 높다.
- [wrapper 논의]에서는 "규칙 기반"과 "인터셉트 기반"을 섞어 말하면 판단이 흐려진다.

### 개선 액션
- 다음 세션 첫 작업으로 `SessionStart` hook input을 캡처하는 최소 실험을 수행한다.
- wrapper가 inherited env에 의존하지 않도록 `CALLER_RUNTIME` 같은 명시 마커를 직접 주입하는 방향으로 설계를 좁힌다.

---

## 4. 다음 세션 작업

- 즉시:
  - `SessionStart` hook stdin에 `sessionId`가 들어오는지 확인
  - direct Gemini 실행과 Codex-origin 실행에서 hook input 차이 확인
- 다음:
  - mini DB 스키마 초안 작성
  - session-dashboard sync 시 mini DB 조회 지점 설계
- 나중:
  - fallback으로 지속시간 휴리스틱을 병행할지 여부 결정
  - 필요 시 Codex DB 보조 참조를 2차 안전망으로 추가 검토

---

## 5. 발견 & 교훈

- 발견:
  - `CODEX_THREAD_ID`는 Codex 런타임 자체 식별에는 유효하지만, Codex가 호출한 Gemini child env에 항상 남는다고 볼 수 없다.
  - `GEMINI_CLI=1`은 direct Gemini와 Codex-origin Gemini child 모두에 나타날 수 있어 caller 식별자로는 부족하다.
  - Gemini는 현재 build 기반 sync이므로 "진행 중 세션 미표시" 현상은 구조적으로 발생할 수 있다.

- 실수 -> 교훈:
  - env 비교에서 object와 `{Name, Value}` 배열을 섞어 비교함 -> 포맷 정규화 후 비교를 기본 절차로 삼아야 한다.
  - `Codex DB 교차 참조 무의미`라고 너무 빨리 결론냄 -> raw session log에 실제 호출 흔적이 있는지 먼저 확인해야 한다.

---

## 6. 환경 스냅샷

- 프로젝트 루트: `C:\Users\ahnbu\.claude\my-claude-plugins`
- Codex 세션 ID: `019ce003-5ade-7120-8c72-9bb79bf874cc`
- 핵심 참조 문서:
  - `C:\Users\ahnbu\.claude\my-claude-plugins\20260312_Codex_Gemini_호출구분_실험일지.md`
  - `D:\CloudSync\download\ai-study\01공통연구\20260311_detect-runtime-env-호환성\20260311_detect-runtime_환경변수_호환성진단.md`
- 핵심 참조 파일:
  - `C:\Users\ahnbu\.claude\my-claude-plugins\gemini_env_from_codex.json`
  - `C:\Users\ahnbu\.claude\my-claude-plugins\gemini_env_from_codex.txt`
  - `C:\Users\ahnbu\.claude\my-claude-plugins\gemini_env_from_gemini_cli.json`
