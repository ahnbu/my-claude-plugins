# Codex_Gemini_호출구분_실험일지

> 작성일: 2026-03-12
> 범위: current-session
> 세션: 019ce003-5ade-7120-8c72-9bb79bf874cc
> 세션 경로: C:/Users/ahnbu/.codex/sessions/2026/03/12/rollout-2026-03-12T12-07-22-019ce003-5ade-7120-8c72-9bb79bf874cc.jsonl

## 발단: 사용자 요청

사용자의 목적은 다음 두 경우를 세션 대시보드에서 구분하는 것이다.

1. Codex가 Gemini CLI를 shell로 호출해 생성한 Gemini 세션
2. 사용자가 Gemini CLI를 직접 실행해 생성한 Gemini 세션

추가 요구:

- Codex가 Gemini를 호출했을 때의 환경변수를 누락 없이 저장
- 직접 실행 Gemini와 비교해 구분 가능성 검토
- 대시보드에서 Codex-origin Gemini 세션을 제외하거나 별도 처리할 수 있는 설계 옵션 검토
- 이후 다른 사람이 바로 이어서 실험할 수 있도록 시행착오, 기각된 가설, 확인된 사실을 포함한 인수인계 문서화

## 작업 상세내역

### 1. Codex 경유 Gemini env dump 생성

Codex에서 Gemini CLI를 직접 호출해 현재 작업 폴더에 환경변수 덤프를 저장하도록 지시했다.

생성 파일:

- `gemini_env_from_codex.json`
- `gemini_env_from_codex.txt`

검증 결과:

- 1차 생성본: 48개
- 재생성본: 59개
- 실제 파일 존재 및 항목 수 확인 완료

관찰:

- Gemini 내부 확장, 훅, 서브에이전트 경로에 따라 환경변수 개수가 달라질 수 있었다.
- 따라서 "같은 Codex 경유 Gemini"라도 호출 경로와 로딩 상태에 따라 env dump가 조금 달라질 수 있다.

### 2. env 비교 가설과 정정

초기 가설:

- Codex에서 실행한 Gemini와 직접 실행 Gemini는 환경변수 차이로 구분될 수 있을 것이다.

초기 잘못된 중간 결론:

- 비교 스크립트가 JSON 구조를 잘못 읽어 차이가 많은 것처럼 보였다.

정정 후 최종 확인:

- `gemini_env_from_codex.json`은 object 구조
- `gemini_env_from_gemini_cli.json`은 `{Name, Value}` 배열 구조
- 이를 맞춰 비교한 결과 키 개수는 양쪽 모두 59개였고, 실제 값 차이는 `Path` 1개뿐이었다.

즉:

- 환경변수만으로 Codex-origin, direct Gemini를 안정적으로 구분하기는 어렵다.
- 현재 수집된 env에서는 식별용 전용 변수(`INVOKED_BY=codex` 같은 것)가 없다.

### 3. Gemini 세션 DB, 파서 구조 확인

검토 파일:

- `shared/session-db.js`
- `shared/session-parser.js`
- `my-session-dashboard/build.js`

확인 결과:

- Gemini 세션은 `~/.gemini/tmp/<projectAlias>/chats/session-*.json`에서 읽는다.
- `processGeminiSession()`은 `sessionId`, `startTime`, `lastUpdated`, `messages`를 파싱한다.
- `build.js`를 실행할 때만 Gemini 세션이 DB로 증분 sync된다.
- Claude와 달리 Gemini에는 현재 실시간 DB upsert hook가 없다.

이로부터 확인된 사실:

- "현재 진행 중인 Gemini 세션이 대시보드에 미표시"는 적어도 일부 경우, 단순히 build를 다시 안 돌렸기 때문일 수 있다.
- 실제로 최신 Gemini 세션 파일은 존재했지만 DB recent 목록에는 아직 없었다.

### 4. `bd4f4168...` 미표시 가설 검토

초기 계획문서에는 `bd4f4168` 세션이 미표시라고 적혀 있었으나, 실제 확인 결과 DB에는 해당 세션이 존재했다.

확인 결과:

- `node shared/query-sessions.js recent 10 --scope gemini` 에서 `gemini:bd4f4168-...` 조회됨
- 원본 세션 JSON에도 user message 다수, gemini message 다수 존재
- 따라서 "항상 파싱 누락"이라고 단정할 수 없음

가능한 원인 정리:

- 특정 시점 build 미실행
- UI 필터 상태
- 당시 build 시점과 현재 상태 차이
- 일시적 sync 누락

즉:

- 이 이슈는 "현재 구조상 실시간 반영 부재"와 분리해서 다뤄야 한다.

### 5. 자동 호출 세션 제외 방식에 대한 논의

초기 제안들:

- A. 특정 Gemini project alias 디렉토리 제외
- B. 짧은 지속시간 휴리스틱
- C. Codex DB 교차 참조
- D. wrapper + sidecar, mini DB
- E. 첫 메시지 태그 `(codex지시)` 또는 UUID tag

중간 논의에서 수정된 점:

- A는 `02-1`이 일회성 alias가 아니라 날짜, 환경에 따라 변하는 구조라서 부적절
- C는 처음에는 "실용성 없음"으로 평가됐으나, 실제 Codex 세션 원본 로그에 `gemini` 호출 흔적과 시각이 남는 것이 확인되어 "보조적 근거로는 의미 있음"으로 정정
- E의 일반 태그 `(codex지시)`는 LLM 준수율에 의존하므로 단독 수단으로 부적절
- B는 구현은 가장 쉽지만 휴리스틱 한계가 명확
- D는 exact에 가장 가까운 방향으로 논의가 진전됨

### 6. wrapper 논의에서 정리된 핵심

"wrapper를 쓰자"는 말은 두 가지 의미가 있었다.

1. 규칙 기반 wrapper
   - AGENTS, skill에 "항상 이 wrapper로 실행하라"를 적는 수준
   - 준수율 100%가 아니므로 보조수단
2. 기술적 인터셉트 wrapper
   - Codex가 쓰는 실행 경로에서 `gemini` 명령 해석 자체를 wrapper로 shadow, intercept
   - 사용자가 wrapper를 기억하지 않아도 호출 경로를 가로챌 수 있음

중요한 정리:

- 단순 wrapper 규칙은 exact 수단이 아님
- 기술적 인터셉트 wrapper는 exact에 가까운 수단이 될 수 있음
- 다만 절대경로 `gemini.cmd` 직접 호출 등 우회 경로가 있으면 100% 완전강제는 아님

### 7. env marker 기반 런타임 판별 자료 검토

참조 문서:

- `D:\CloudSync\download\ai-study\01공통연구\20260311_detect-runtime-env-호환성\20260311_detect-runtime_환경변수_호환성진단.md`
- `env_list/` 하위 환경별 env dump

해당 문서의 핵심 판정:

- `ANTIGRAVITY_AGENT` -> antigravity
- `CLAUDECODE` -> claude
- `CODEX_THREAD_ID` -> codex
- `GEMINI_CLI` -> gemini

실제 env 목록 일부 재확인:

- PS Codex TUI: `CODEX_THREAD_ID=...`
- PS ClaudeCode TUI: `CLAUDECODE=1`
- Codex가 호출한 Gemini env dump: `GEMINI_CLI=1`
- 하지만 Codex가 호출한 Gemini dump 안에는 `CODEX_THREAD_ID`가 보이지 않음

이 의미:

- 런타임 자체를 감지하는 env marker는 유용하다.
- 그러나 `codex -> gemini` 자식 프로세스까지 Codex marker가 항상 상속된다고 가정하면 안 된다.
- 따라서 "wrapper가 현재 env를 읽어 caller를 추론"하는 방식은 디버깅용 근거로는 좋지만, Codex-origin 판별의 단독 근거로는 취약할 수 있다.

### 8. mini DB + SessionStart hook 아이디어

사용자가 제안한 설계:

- wrapper가 env를 주입
- Gemini `SessionStart` hook가 env와 `sessionId`를 mini DB에 기록
- dashboard sync 시 mini DB를 참조해 `source=codex` 세션을 제외

검토 결과:

- 현재까지 논의된 방향 중 가장 설계가 좋음
- 이유:
  - 사후 휴리스틱이 아니라 실행 시점에 명시적으로 출처 기록
  - 프롬프트 본문 오염 없이도 구현 가능
  - direct Gemini와 Codex-origin 세션을 구분하기 쉬움
  - Codex DB와 Gemini DB를 timestamp 근접 매칭으로 억지 조인할 필요가 없음

남은 기술 확인 포인트:

- Gemini `SessionStart` hook stdin, context에 실제 `sessionId`가 들어오는지 아직 이 대화에서 확정하지 못함
- 다만 로컬 Gemini 확장 구조상:
  - `SessionStart` hook 존재
  - hook는 `stdin JSON`과 `process.env`를 읽을 수 있게 구현됨
- 따라서 `sessionId`만 hook input에 있다면 이 설계는 자연스럽게 성립 가능

## 가설과 확인 결과

### 가설 검증표

| 가설 | 확인 방법 | 결과 | 판단 |
|------|-----------|------|------|
| Codex-origin Gemini와 direct Gemini는 env 차이로 쉽게 구분된다 | `gemini_env_from_codex.json` vs `gemini_env_from_gemini_cli.json` 구조 맞춰 비교 | 실제 차이는 `Path` 1개뿐 | ❌ 기각 |
| `bd4f4168` 미표시는 파싱 누락이다 | DB recent 조회 + 원본 Gemini 세션 JSON 확인 | DB에 이미 존재 | ❌ 단정 기각 |
| 최신 Gemini 세션 미표시는 build 미실행 때문일 수 있다 | 최신 `~/.gemini/tmp` 파일과 DB recent 비교 | 최신 파일은 존재, DB에는 없음 | ✅ 유력 |
| 특정 project alias 제외로 Codex-origin Gemini를 처리할 수 있다 | alias 구조와 세션 저장 패턴 검토 | alias가 고정 식별자 역할을 하지 못함 | ❌ 기각 |
| 짧은 지속시간 필터면 충분하다 | 자동호출 8~17s vs 직접대화 95s+ 사례 비교 | 현재 데이터셋에서는 꽤 잘 맞음 | ⚠️ 임시안 |
| Codex DB 교차 참조는 의미가 없다 | Codex 원본 JSONL에서 `gemini` 호출 흔적 검색 | 실제 호출 시각, 명령 흔적 존재 | ⚠️ 정정 필요 |
| `(codex지시)` 같은 일반 태그로 안정 분류 가능하다 | 준수율, 규칙 의존성 검토 | LLM 준수율에 의존 | ❌ 단독 수단 부적합 |
| 기술적 인터셉트 wrapper면 exact에 가깝게 갈 수 있다 | 호출 경로 강제 수준 검토 | 규칙 기반이 아닌 인터셉트면 가능성 높음 | ✅ 유력 |
| wrapper env 주입 + SessionStart hook + mini DB는 가장 적절한 구조다 | hook 구조, env marker, session parser 경로 검토 | 성립 가능성 높음. sessionId 전달 여부만 추가 확인 필요 | ✅ 현재 최유력 |

## 의사결정 기록

### 옵션 비교표

| 항목 | A. alias 제외 | B. 지속시간 휴리스틱 | C. Codex DB 보조 참조 | D. 인터셉트 wrapper + UUID tag | E. 인터셉트 wrapper + env + SessionStart mini DB |
|------|---|---|---|---|---|
| 정확도 | ❌ ██░░░░ | ⚠️ ████░░ | ⚠️ ████░░ | ✅ ██████ | ✅ ██████ |
| 구현 단순성 | ✅ ██████ | ✅ ██████ | ❌ ██░░░░ | ████░░ | ⚠️ ████░░ |
| 유지보수성 | ❌ ██░░░░ | ✅ ██████ | ⚠️ ████░░ | ████░░ | ████░░ |
| 사용자 프롬프트 비오염 | ✅ | ✅ | ✅ | ⚠️ 태그 삽입 시 오염 | ✅ |
| 규칙 준수 의존성 | ❌ 높음 | ✅ 낮음 | ✅ 낮음 | ⚠️ 인터셉트 수준에 따라 다름 | ✅ 낮음 |
| 우회 가능성 방어 | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| 설명가능성 | ❌ | ⚠️ | ⚠️ | ✅ | ✅ |
| 현재 검토 상태 | 기각 | fallback 후보 | 보조 후보 | strong 후보 | **최유력 후보** |

### 옵션별 상세 판단

- A. alias 제외
  - 결정: 기각
  - 근거: 저장 디렉토리 alias가 출처 식별자 역할을 하지 못함

- B. 지속시간 휴리스틱
  - 결정: fallback 후보
  - 근거: 현재 데이터셋에는 잘 맞지만 본질적으로 휴리스틱

- C. Codex DB 교차 참조
  - 결정: 보조 후보
  - 근거: 원래 "무의미"로 평가했지만 실제 호출 흔적이 있어 보조 근거로는 유의미

- D. 인터셉트 wrapper + UUID tag
  - 결정: strong 후보
  - 근거: exact에 가깝지만 프롬프트 태그 노출이 남음

- E. 인터셉트 wrapper + env + SessionStart mini DB
  - 결정: 현재 최유력
  - 근거: exact 지향, 사후 설명 가능, 프롬프트 비오염, 휴리스틱 의존도 최소

## 런타임, env 식별 신호 비교

| 런타임 | 핵심 env marker | 사용자 관점 식별 안정성 | 비고 |
|--------|------------------|-------------------------|------|
| Codex TUI | ✅ `CODEX_THREAD_ID` | ██████ | Codex 자체 런타임 식별에는 유효 |
| ClaudeCode TUI, CLI | ✅ `CLAUDECODE` | ██████ | 직접 런타임 식별에는 유효 |
| Gemini CLI | ✅ `GEMINI_CLI` | ██████ | 직접 런타임 식별에는 유효 |
| Antigravity | ✅ `ANTIGRAVITY_AGENT` | ██████ | 확장, 사이드바 식별 가능 |
| Codex가 호출한 Gemini child | ⚠️ `GEMINI_CLI`만 확인 | ██░░░░ | Codex marker 상속이 불안정 |

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| Codex-origin Gemini env dump 생성 | Gemini CLI에 env 저장 프롬프트 실행 후 파일 존재, 개수 확인 | ✅ 완료 | `gemini_env_from_codex.json`, `txt` 생성 |
| Codex dump 재생성 | 동일 프롬프트 재실행 후 타임스탬프, 개수 확인 | ✅ 완료 | 재생성본은 59개 |
| Codex vs direct Gemini env 비교 | JSON 구조 정규화 후 key, value diff | ✅ 완료 | 차이는 `Path` 1개뿐 |
| Gemini 최신 세션 미표시 여부 | 최신 `~/.gemini/tmp` 파일과 DB recent 비교 | ✅ 완료 | 최신 파일은 있으나 DB recent 미반영 |
| `bd4f4168` DB 존재 여부 | `query-sessions --scope gemini` + 원본 JSON 확인 | ✅ 완료 | DB에 존재 |
| Codex DB에 gemini 호출 흔적 존재 여부 | `.codex/sessions` raw JSONL grep | ✅ 완료 | 호출 문자열과 시각 존재 |
| 런타임 env marker 유효성 | detect-runtime 자료와 env_list 교차 확인 | ✅ 완료 | marker 체계 유효 |
| SessionStart hook 존재 여부 | `~/.gemini/extensions/bkit/hooks/` 구조 확인 | ✅ 완료 | `session-start.js`, `hooks.json` 존재 |
| SessionStart hook에서 env 접근 가능성 | hook 코드, adapter 확인 | ✅ 완료 | `process.env`, stdin JSON 접근 가능 |
| SessionStart hook에서 sessionId 전달 여부 | 실제 hook input 스키마 확인 | ⏳ 미확정 | 다음 실험 필요 |

## 리스크 및 미해결 이슈

- `SessionStart` hook input에 `sessionId`가 실제로 들어오는지 아직 검증 안 됨
- Codex-origin Gemini child에서 `CODEX_THREAD_ID`가 상속되지 않는 사례가 있어 inherited env 단독 판별은 취약
- 기술적 인터셉트 wrapper도 절대경로 호출 등 우회 경로는 남을 수 있음
- `bd4f4168` 미표시 이슈는 당시 시점의 UI 상태, 필터 상태를 재현하지 못했으므로 원인 단정 금지
- compare-table 기준으로 현재 최유력안은 정리됐지만, 구현 전 마지막 팩트체크 1건이 남아 있음

## 다음 액션

1. Gemini `SessionStart` hook input 원본에서 `sessionId` 존재 여부를 직접 확인
2. 가능하면 `wrapper -> env 주입 -> SessionStart hook -> mini DB` POC 설계 확정
3. mini DB 스키마를 최소화
   - 권장: `session_id`, `source`, `runtime_markers`, `project`, `started_at`
4. session-dashboard sync에서 mini DB 조회 지점 정의
5. fallback으로 지속시간 휴리스틱을 남길지 여부 결정
6. 구현 시에는 direct Gemini도 기록할지, Codex-origin만 기록할지 범위 확정

## 검수 기록

### 1차 검수 포인트

| 검수 항목 | 확인 결과 | 판정 | 메모 |
|-----------|-----------|------|------|
| 사용자 원요청 반영 | Codex-origin vs direct Gemini 구분 목적 포함 | ✅ | 반영 |
| 실험 로그 반영 | env dump 생성, 재생성, 비교 포함 | ✅ | 반영 |
| 시행착오 반영 | 잘못된 env 비교 결론과 정정 포함 | ✅ | 반영 |
| 옵션 비교 반영 | A~E 옵션과 상태 포함 | ✅ | 반영 |
| 가설, 검증 반영 | 가설별 채택, 기각 명시 | ✅ | 반영 |
| 참조 문서 반영 | detect-runtime 문서와 env_list 근거 포함 | ✅ | 반영 |
| 미확정 사항 명시 | SessionStart의 sessionId 미확정 표시 | ✅ | 반영 |
| 과장, 단정 제거 | `bd4f4168` 이슈 단정 표현 제거 | ✅ | 반영 |

### 1차 검수 결과 요약

- 구조화 데이터, 의사결정, 기각된 옵션, 남은 가설을 모두 포함하도록 보강함
- "환경변수 기반 구분 불가" 결론은 완전 부정이 아니라 "현재 수집된 env만으로는 불가"로 정제함
- "Codex DB 교차 참조 무의미"는 잘못된 중간 결론이었음을 명시적으로 정정함
