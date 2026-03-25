# Handoff — npm 설치 후 경고 진단 및 installMethod 수정 (세션 01)
> 날짜: 2026-03-10
> 세션 ID: 56e8e962-0b69-4a3c-9719-bb84cc3456ff
> 세션 경로: C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins-my-session-dashboard/56e8e962-0b69-4a3c-9719-bb84cc3456ff.jsonl
> 상태: 세션완료

---

## 1. 현재 상태

### 작업 목표
Bun segfault로 npm 전환 후 발생한 상태표시줄 경고 2건 원인 진단 및 해결

### 진행 현황
| 단계 | 상태 | 산출물 |
|------|------|--------|
| 원인 진단 (`~/.claude.json` installMethod 잔재) | ✅ 완료 | - |
| `installMethod` 수정: `"native"` → `"global"` | ✅ 완료 | `~/.claude.json` |
| `autoUpdatesProtectedForNative` 수정: `true` → `false` | ✅ 완료 | `~/.claude.json` |
| 환경변수 `DISABLE_AUTO_MIGRATE_TO_NATIVE=1` 설정 | ✅ 완료 | User 환경변수 |
| 검증: "installMethod is native, but not found" 경고 | ✅ 사라짐 | - |
| 검증: "switched from npm to native" 경고 | ⚠️ 지속 (구조적, 정보성) | - |
| native 복귀 절차 문서화 | ✅ 완료 | `20260309_04_...` |
| 관련 문서 업데이트 | ✅ 완료 | `20260309_03_`, `20260309_04_` |
| git 커밋 (구 문서 삭제) | ✅ 완료 | - |

### 핵심 의사결정 로그
- [결정 1] `installMethod`를 `"native"`→`"global"`로 수정. 이유: npm 설치로 전환했으나 config 잔재가 native binary 누락 경고를 유발.
- [결정 2] `DISABLE_AUTO_MIGRATE_TO_NATIVE=1` 환경변수 추가. 이유: cli.js 내부 auto-migrate 로직이 native 재설치를 자동 수행할 수 있음.
- [결정 3] "switched from npm to native" 경고는 해결 불가로 판단. 이유: npm 사용 중인 한 Anthropic이 강제 표시하는 제품 레벨 nudge.

### 다음 세션 시작점
- Bun #27471 패치 확인 → `20260309_04_` 파일의 Native 복귀 절차 따라 진행
- 모니터링 항목: `Bun is not defined` 에러 발생 여부, 30분+ 세션 안정성

---

## 2. 변경 내역 (이번 세션)

- **`C:\Users\ahnbu\.claude.json`** 수정
  - `installMethod`: `"native"` → `"global"`
  - `autoUpdatesProtectedForNative`: `true` → `false`
- **환경변수** `DISABLE_AUTO_MIGRATE_TO_NATIVE=1` User 범위 설정 (PowerShell)
- **`20260309_03_Bun_segfault_대응옵션검토_npm전환결정과_실행기록.md`** 업데이트
  - 검증 테이블 결과 반영, 현재 상태 요약 섹션 추가
  - Native 복귀 절차 섹션 추가
- **`20260309_04_클로드코드_native재설치방법.md`** 업데이트
  - Q&A 섹션 추가: `claude install` 명령의 의미
- 위 두 문서는 D:\CloudSync\download\ai-study\02클로드코드\20260309_클로드코드_bun충돌대응\로 이동됨 (사용자 작업)
- **git**: `20260309_Bun_segfault_npm전환_트레이드오프.md` 삭제 (D:\CloudSync로 이동·재편)

---

## 3. 피드백 루프
> ⚠️ 이 섹션은 AI 초안입니다. 검토·수정해 주세요.

### 잘된 점
- cli.js 소스 분석 기반 정확한 원인 진단 (config 잔재)
- 문제를 심각도별로 분류 (높음/중간/낮음)하여 우선순위 명확화
- 수정 후 즉시 검증 → 결과를 문서에 반영

### 문제·병목
- 파일 Read 없이 Edit 시도 → `File has not been read yet` 오류로 2회 재시도 필요
- `~/.claude.json`이 37K 토큰 초과 → 전체 Read 불가, Grep으로 필요 필드만 추출

### 레슨 (재사용 가능한 교훈)
- [대형 JSON 수정]에서는 전체 Read 대신 Grep으로 대상 라인 확인 후 부분 Read(offset+limit) → Edit 순서를 따라야 함
- [상태표시줄 경고 진단]에서는 cli.js 소스의 `installMethod` 체크 로직을 먼저 확인하면 원인 파악이 빠름
- `claude install` = npm CLI 내장 자가 마이그레이션 명령 (Bun 패치 전 실행 금지)

### 개선 액션
- 대형 JSON 파일(`~/.claude.json`) 수정 시 항상 Grep 우선, 전체 Read 금지 → 전역 지침 반영 검토

---

## 4. 다음 세션 작업

- **즉시**: 없음 (현재 npm 전환 상태로 안정 운영 중)
- **다음**: Bun #27471 패치 릴리스 시 native 복귀 (절차: `20260309_04_클로드코드_native재설치방법.md`)
- **나중**: 30분+ 세션 안정성 검증, `Bun is not defined` 에러 빈도 모니터링

---

## 5. 발견 & 교훈

- **발견**: `~/.claude.json`의 `installMethod: "native"` 잔재가 npm 전환 후에도 경고를 유발. npm 설치 자체는 정상이라도 config가 native를 기대하면 오류 출력.
- **발견**: `claude install` 서브커맨드는 npm CLI가 native installer를 자가 호출하는 마이그레이션 명령.
- **발견**: "switched from npm to native" 경고는 npm 사용 중인 한 억제 불가 (제품 레벨 nudge).
- **실수 → 교훈**: 병렬 실행 시 한 도구가 실패하면 동반 도구도 취소됨. 의존성 없더라도 순차적으로 진행할 필요 있음(특히 Edit이 Read 선행 필요한 경우).

---

## 6. 환경 스냅샷
> 알려진 이슈 있음

- **Claude Code 설치 방식**: npm global (`C:\Users\ahnbu\AppData\Roaming\npm\claude`)
- **알려진 제약**: npm은 deprecated (2026.02). "switched from npm to native" 경고 매 세션 표시. Bun #27471 패치 전까지 유지.
- **워크어라운드**:
  - `~/.claude.json`: `installMethod: "global"`, `autoUpdatesProtectedForNative: false`
  - 환경변수: `DISABLE_AUTO_MIGRATE_TO_NATIVE=1` (User 범위)
  - native binary: `~/.local/bin/claude.exe.bak` (비활성화 상태)
- **복귀 조건**: Bun #27471 fix 릴리스 확인 후 `20260309_04_클로드코드_native재설치방법.md` 절차 수행
