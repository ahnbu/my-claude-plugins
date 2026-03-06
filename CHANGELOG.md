# Changelog

## 작성 규칙

- **모든 커밋**을 기록 (타입으로 구분)
- 최신 항목을 테이블 최상단에 추가
- 버전 열: 플러그인 버전 변경이 있을 때만 기재, 없으면 `-`

## 이력

| 날짜 | 타입 | 버전 | 변경 내용 |
|------|------|------|-----------|
| 2026-03-06 | docs | - | `my-session-dashboard` — 플러그인 독립 전환 계획 문서 추가 (`20260306_플러그인_독립모듈_전환_계획.md`): 전체 플러그인 hook 분석, 독립 전환 가능 판단, 7단계 실행 계획 포함 |
| 2026-03-06 | docs | - | `my-session-dashboard` — 세션 대시보드 로컬 서버 구현 계획 문서 추가 (`20260306_세션대시보드_로컬서버_계획.md`): serve.js 구현 이력, 버그 발견·수정 과정, 설계 진화 3단계 포함 |
| 2026-03-06 | feat | my-session-dashboard 1.3.0 | `serve.js` 신규 — 로컬 HTTP 서버 + SSE 빌드 오케스트레이션. `session.bat` 신규. `generate-icon.js` + `dashboard.ico` (32x32 ICO, 순수 Buffer). `세션대시보드.lnk` 신규 (dashboard.ico 포함). `SKILL.md` 단순화 (4단계→2단계, node serve.js 호출). serve.js 버그 수정: output 경로 불일치(L17 `../` 추가), IPv4 바인딩 문제(`server.listen(0)` 전환), exec URL 모호성 (`start "" "url"`) |
| 2026-03-06 | chore | - | 산재 문서/_handoff 파일을 루트 `_docs/`·`_handoff/`로 통일 — `_docs/my-session-wrap/_handoff/` 5개→루트 `_handoff/`, 플러그인 내부 문서 3개→`_docs/` 이동, `.current-session-id` 임시파일 삭제 |
| 2026-03-06 | docs | - | 프로젝트 CLAUDE.md `### Handoff 문서` 섹션 삭제 — 글로벌 CLAUDE.md(L50)에 동일 규칙 있으므로 중복 제거 |
| 2026-03-05 | docs | - | `_handoff/` + `_docs/` 파일명 일괄 규격 적용 — 하이픈 구분에서 언더스코어 구분으로 35개 파일 리네임 |
| 2026-03-05 | docs | - | 미추적 문서 3건 정리 — `_docs/my-session-wrap/20260305_세션ID멀티세션충돌_대책_계획.md`, `_docs/my-session-wrap/task_plan.md`, `_handoff/handoff_20260305_01_대시보드-경로복사-복사버튼-UI개선.md` 추가 |
| 2026-03-05 | refactor | my-session-wrap 2.8.1 | `capture-session-id.js` SessionStart 파일 기록 분기 제거 (dead code — UPS hook이 항상 먼저 발동하므로 파일 fallback 에지케이스 없음). `hooks.json` SessionStart에서 capture-session-id hook 엔트리 제거. `fs`/`path` import 정리 |
| 2026-03-05 | feat | my-session-wrap 2.8.0 | Phase 5 구현 — Hook stdout → 시스템 메시지 방식으로 멀티세션 세션 ID 완전 격리. `hooks.json` UserPromptSubmit 이벤트 추가(capture-session-id.js 연결). `capture-session-id.js` hook_event_name 분기: UPS→`console.log([session_id=...])` stdout 주입, SS→파일 기록 fallback 유지. `SKILL.md` 2-1절 세션 ID 획득 1차를 system-reminder `[session_id=...]` 패턴 탐색으로 변경 |
| 2026-03-05 | docs | - | `my-session-dashboard` — 계획 문서 추가 (`20260305_세션대시보드_경로복사_계획.md`): 파일 경로 복사·문서전체복사·헤더 레이아웃 개선 실행 결과 포함 |
| 2026-03-05 | feat | my-session-dashboard 1.2.0 | `build.js` — `processSession`·`parsePlan` metadata에 `filePath`(절대경로) 추가. `index.html` — 헤더 레이아웃 재배치(`[검색][필터][통계]`), detail-header에 파일 경로 + 경로 복사 버튼 추가, Plan h2 행에 `문서전체복사` 버튼 배치, 복사 버튼 accent 색상 시각화 + 토스트 알림 |
| 2026-03-05 | fix | my-session-wrap 2.7.3 | `my-session-wrap` SKILL.md 세션 ID 획득 — JSONL 최신 파일명 방식으로 전환 (멀티세션 안전). capture-session-id.js CLAUDE_ENV_FILE 코드 제거 (Bash 도구 미전달 확인). 파일 fallback 유지 |
| 2026-03-05 | fix | my-session-wrap 2.7.2 | `my-session-wrap` capture-session-id.js — CLAUDE_ENV_FILE 기반 세션 ID 기록 추가 (1차: 환경변수, 2차: 파일 fallback). SKILL.md 세션 ID 획득 순서 업데이트. 멀티세션 충돌 해결 |
| 2026-03-05 | fix | my-session-wrap 2.7.1 | `my-session-wrap` capture-session-id.js — CLAUDE_ENV_FILE 가용성 확인용 디버그 로깅 추가 (`~/session-id-debug.log`). 멀티세션 충돌 대책 Phase 1 검증용 임시 코드 |
| 2026-03-05 | fix | - | `my-session-wrap` SKILL.md Step 2-2 — `next-handoff.sh` 경로를 `$(dirname "$0")` 에서 bash fallback(로컬 dev → 캐시 순 탐색)으로 교체. SKILL.md는 마크다운 프롬프트이므로 `$0` 미작동, AI가 스크립트를 우회하여 날짜 오류 발생하던 문제 해결 |
| 2026-03-05 | feat | my-session-wrap 2.7.0 | `/continue` — Session ID(UUID v4) 감지 분기 추가: 입력에 UUID가 있으면 `~/.claude/projects/*/{id}.jsonl`을 직접 탐색하여 컨텍스트 복원(경로 A), 없으면 기존 handoff 흐름(경로 B) 유지. `allowed-tools`에 `Grep` 추가 |
| 2026-03-05 | fix | - | `my-session-wrap` SKILL.md Step 3-1 — CHANGELOG.md 경로를 CWD 상대경로에서 `<ProjectRoot>/CHANGELOG.md` 역산 방식으로 변경 (handoff 경로의 `_handoff/` 부모 = ProjectRoot) |
| 2026-03-05 | fix | - | `my-session-wrap` Claude Code 버전 ProjectRoot 판정 추가 — `next-handoff.sh`에 git root → 마커 스캔(3단계) → throw 로직 구현, SKILL.md Step 2-2 인라인 코드를 스크립트 위임으로 교체 |
| 2026-03-05 | fix | - | `wrap` 스킬 ProjectRoot 판정 로직 추가 — `next-handoff.ps1`에 `-ProjectRoot` 파라미터 및 자동 탐색(git root → 마커 스캔 3단계 → throw) 구현, handoff 경로 절대경로 강제, `-Verbose` 옵션 추가. `SKILL.md` 경로 결정 4단계 우선순위 문서화. Codex·Gemini wrap SKILL.md 및 CHANGELOG.md 동기화 |
| 2026-03-04 | docs | - | `_handoff/handoff_20260304_02_테이블-렌더링-지원.md` 추가 — 세션 요약, 변경 파일, 검증 결과, 다음 세션 재개 포인트 기록 |
| 2026-03-04 | feat | - | my-session-dashboard `index.html` — markdown table 렌더링 지원 추가(`parseMarkdownTable`), 코드블록 보호/CRLF/정렬 구분선 처리, 테이블 CSS 및 모바일 가로 스크롤 보강 |
| 2026-03-04 | docs | - | 문서 경로 정리 — `docs/`→`_docs/`, `handoff/`→`_handoff/` 이동 및 `my-session-wrap/_handoff`, `_handoff` 신규 handoff 문서 반영 |
| 2026-03-04 | docs | - | CLAUDE.md — Handoff 문서 경로 `docs/.../handoff/` → `_docs/.../_handoff/` 수정 (폴더명 변경 방침 동기화) |
| 2026-03-04 | docs | - | README.md — `handoff/` → `_handoff/` 경로 참조 2건 수정 (폴더명 변경 방침 동기화) |
| 2026-03-04 | fix | my-session-wrap | `SKILL.md`, `check-handoff.js`, `next-handoff.sh`, `continue.md` — `handoff/` → `_handoff/` 경로 변경 반영 (폴더명 변경 방침 동기화) |
| 2026-03-04 | fix | my-session-wrap 2.6.1 | inject-plugin-guidelines.js — EEXIST 워크어라운드 분기 제거, 정식 배포 절차만 출력하도록 간소화 |
| 2026-03-04 | docs | - | CLAUDE.md — EEXIST 버그 워크어라운드 섹션 삭제 (버그 해결, 정식 절차 복원); 백업 _docs/공통/ 보관 |
| 2026-03-03 | docs | - | README.md — 마켓플레이스 등록 섹션 추가 (GitHub 레포·로컬 경로 등록, 플러그인 설치 명령어) |
| 2026-03-02 | docs | - | docs/my-session-wrap — v2 문서에 §9 실제 실행 결과 검증 추가 (워크플로우 흐름·3개 체크포인트·핵심 현상 해소 확인) |
| 2026-03-02 | docs | - | docs/my-session-wrap — CHANGELOG 이중 작성 분석 v1/v2 문서 추가 (§8 추후 과제·고도화 관점 포함) |
| 2026-03-02 | fix | - | my-session-wrap SKILL.md Step 3-2 재구성 — handoff 커밋 단계 제거, 관심사별 분리 커밋으로 변경; .gitignore에 handoff/ 추가 |
| 2026-03-01 | feat | my-session-wrap 2.6.0 | /wrap SKILL.md — AskUserQuestion 3곳 전면 제거: 체크리스트 후보·규칙 후보는 보고로 전환, git commit은 자동 실행으로 변경 |
| 2026-02-28 | docs | - | docs/공통 파일명 규격 통일 — YYYYMMDD_이슈명 포맷 적용, 구파일 삭제 |
| 2026-02-28 | docs | - | 전체 docs 파일명 규격 통일 — YYYYMMDD_이슈명 포맷 적용, study-doc-system·study-session-history-analysis → docs/문서시스템연구·세션이력분석으로 이동 및 한글화 |
| 2026-02-28 | docs | - | docs/my-session-wrap 파일명 규격 통일 — YYYYMMDD_이슈명 포맷 적용, handoff 서브폴더 분리, CLAUDE.md에 문서 파일 이름 규칙 추가 |
| 2026-02-28 | fix | - | /wrap SKILL.md Step 3 — CHANGELOG 업데이트를 커밋 전 필수 단계로 추가 (기존 양식 존중, 없으면 템플릿 생성, Scope 포괄값 금지 명시) |
| 2026-02-28 | docs | - | handoff 폴더명 변경 의사결정 기록 추가 (wrap 개명·점 접두사 모두 기각) |
| 2026-02-27 | feat | my-session-wrap 2.5.0 | /wrap Step 1.5 개선 — 1.5-B 추가: 프로젝트 CLAUDE.md의 관리 대상 파일과 git diff 교차 분석으로 체크리스트 미등록 항목만 탐지·제안 |
| 2026-02-27 | feat | my-session-wrap 2.4.0 | /wrap SKILL.md — Step 1.5 추가: 프로젝트 CLAUDE.md의 `## Wrap 체크리스트` 섹션을 읽어 미완료 항목을 handoff 작성 전에 처리 |
| 2026-02-26 | docs | - | Hook세팅가이드 §6 — hook stdout이 Claude 컨텍스트(system-reminder)에만 주입됨, 검증법 추가 |
| 2026-02-26 | fix | - | inject-plugin-guidelines.js — EEXIST 워크어라운드 절차 A/B 인라인 포함 (CLAUDE.md 참조 안내에서 직접 내용으로 교체) |
| 2026-02-26 | feat | - | inject-plugin-guidelines.js — CLAUDE.md EEXIST 섹션 존재 여부로 워크어라운드 안내 동적 전환 |
| 2026-02-26 | feat | my-session-wrap 2.3.0 | SessionStart hook inject-plugin-guidelines.js — my-claude-plugins 폴더에서 세션 시작 시 플러그인 배포 절차(A/B) 강조 주입 |
| 2026-02-26 | fix | - | /wrap SKILL.md — next-handoff.sh 상대경로 호출을 인라인 bash로 교체 (타 프로젝트에서 호출 시 스크립트 미발견 버그 수정) |
| 2026-02-26 | docs | - | study-doc-system 문서관리_사례모음 — 섹션 제목 정비·사례 추가 (KPT, 업무 기억 파일 시스템, 마누스) |
| 2026-02-26 | docs | - | CLAUDE.md 수동 설치 절차 A/B 분리 — A(기존 플러그인 업데이트), B(신규 플러그인 설치, settings.json enabledPlugins 추가 포함) |
| 2026-02-26 | docs | - | docs/플러그인에러대처_20260226.md 신규 — EEXIST 버그 원인·워크어라운드 영구 참조 문서 |
| 2026-02-26 | chore | - | /ss-new 임시 커맨드 삭제 — my-session-dashboard 수동 설치 완료로 불필요 |
| 2026-02-26 | chore | - | /ss-new 임시 커맨드 생성 — 개발 레포 build.js 직접 실행 (marketplace 동기화 전 우회용) |
| 2026-02-26 | feat | my-session-wrap 2.2.0 | /continue 커맨드 신규 생성 — 최신 handoff 자동 검색·요약·재개 |
| 2026-02-26 | feat | - | SessionStart hook check-handoff.js — 24시간 이내 handoff 감지 시 /continue 안내 |
| 2026-02-26 | feat | - | /wrap Step 4 추가 — 재개 프롬프트 출력 + 규칙 후보 확인 |
| 2026-02-26 | feat | - | handoff 템플릿에 §6 환경 스냅샷 섹션 추가 |
| 2026-02-26 | docs | - | 글로벌 CLAUDE.md에 handoff 재개 프로토콜 추가 |
| 2026-02-26 | feat | - | /wrap 피드백 루프에 [규칙 후보] 마킹 로직 추가 |
| 2026-02-26 | fix | - | build.js의 String.replace() $특수문자 해석으로 인한 HTML 손상 수정 |
| 2026-02-26 | feat | - | 타입 필터(전체/세션/플랜)를 헤더로 이동하여 1차 네비게이션 강화 |
| 2026-02-25 | feat | my-session-wrap 2.1.0 | /cp (commit-push) 및 /save (응답 저장) 경량 커맨드 추가 |
| 2026-02-25 | fix | - | next-handoff.sh에서 touch 제거 — Write 도구 1회 실패 해소 |
| 2026-02-25 | fix | - | 세션 ID 획득을 파일 기반으로 변경 + ${baseDir} 미정의 변수를 상대 경로로 수정 |
| 2026-02-25 | docs | - | CHANGELOG.md에서 중복 플러그인 열 제거 |
| 2026-02-25 | docs | - | changelog을 CHANGELOG.md로 분리 + CLAUDE.md 규칙 업데이트 |
| 2026-02-25 | docs | - | CLAUDE.md 플러그인 테이블 업데이트 |
| 2026-02-25 | chore | - | handoff 파일명 규칙 통일 (handoff_YYYYMMDD_NN_요약) |
| 2026-02-25 | feat | - | pre-commit hook으로 marketplace/plugin 버전 동기화 검증 + 릴리스 워크플로우 문서화 |
| 2026-02-25 | feat | my-session-wrap 2.0.0 | handoff 파일명에 당일 순번(NN) 자동 부여 |
| 2026-02-25 | docs | - | README에 플러그인 설치 범위 섹션 추가 + 세션 handoff |
| 2026-02-25 | docs | - | v2.1.55 공식 수정 확인 및 workaround 환경변수 제거 반영 |
| 2026-02-25 | docs | - | EEXIST GitHub 보고·플러그인 진단 세션 handoff 추가 |
| 2026-02-25 | docs | - | 수동 git pull workaround 성공 확인 반영 |
| 2026-02-25 | docs | - | EEXIST 진단문서에 플러그인 상태 진단·고아 캐시 정리 내역 추가 |
| 2026-02-25 | docs | - | Bash EINVAL·EEXIST 버그 진단 handoff 문서 추가 |
| 2026-02-25 | feat | my-session-wrap 2.0.0 | handoff 파일명을 YYYYMMDD_한줄요약 형식으로 변경 |
| 2026-02-25 | feat | my-session-dashboard 1.1.0 | plans 폴더 검색·조회 기능 추가 |
| 2026-02-25 | feat | my-session-dashboard 1.1.0 | 빌드 출력 경로를 레포 최상위 output/으로 변경 |
| 2026-02-24 | docs | - | Hook 작성 규칙 CLAUDE.md에 추가 |
| 2026-02-24 | docs | - | 리팩토링 기록·심층분석·세션ID 테스트 문서 정리 |
| 2026-02-24 | docs | - | Hook 세팅 초보자 가이드 작성 |
| 2026-02-24 | refactor | my-session-wrap 2.0.0 | 5개 분석 에이전트 제거, handoff+commit 경량 워크플로우로 전환 |
| 2026-02-24 | fix | my-session-wrap 2.0.0 | 디버그 코드 제거 → 프로덕션 전환 (SessionStart만 유지) |
| 2026-02-24 | feat | my-session-id 1.0.0 | 세션 ID 캡처 및 훅 이벤트별 비교 플러그인 추가 |
| 2026-02-24 | fix | my-session-wrap 2.0.0 | 3개 이벤트 병렬 디버그 + stdout/파일 이중 출력 |
| 2026-02-24 | fix | my-session-wrap 2.0.0 | capture-session-id를 bash→Node.js로 전환 (Windows 호환) |
| 2026-02-24 | fix | my-session-wrap 2.0.0 | hook command에서 bash 접두사 제거 |
| 2026-02-24 | fix | my-session-wrap 2.0.0 | capture-session-id.sh에서 stdin cwd 절대경로 사용 |
| 2026-02-24 | chore | - | bkit 자동생성 파일 git 추적 제거 |
| 2026-02-24 | docs | - | 세션 ID 테스트 기록 문서 추가 (1~4차) |
| 2026-02-24 | feat | my-session-wrap 2.0.0 | UserPromptSubmit hook으로 세션 ID 파일 기반 캡처 |
| 2026-02-22 | docs | - | ensure-commands 통합 계획 및 핸드오프 문서 추가 |
| 2026-02-22 | feat | my-session-dashboard 1.1.0 | 시스템 태그 제거, NaN/빈 세션 필터링, self-contained HTML, 증분 빌드, 한국어 UI |
| 2026-02-22 | docs | - | README 업데이트 — 세션 ID 캡처 기능 및 hooks 구조 추가 |
| 2026-02-22 | feat | my-session-wrap 1.1.0 | handoff 문서에 세션 ID 필수 기록 기능 추가 |
| 2026-02-22 | feat | my-session-dashboard 1.0.0 | 세션 대시보드 플러그인 신규 추가 |
| 2026-02-22 | docs | - | CLAUDE.md — 아키텍처 섹션 추가 및 구조 개선 |
| 2026-02-21 | docs | - | README.md — 커맨드 자동 등록 동작 방식 표 추가 |
| 2026-02-21 | feat | my-cowork 1.1.3 | 플러그인 마커 기반 충돌 감지 — my-cowork, my-session-wrap 적용 |
| 2026-02-21 | fix | my-cowork 1.1.2 | ensure-commands.js — 자동 갱신 방식으로 통일 |
| 2026-02-21 | fix | my-session-wrap 1.0.3 | ensure-commands.js — 플러그인 원본 변경 시 커맨드 자동 갱신 |
| 2026-02-21 | fix | my-cowork 1.1.1 | hooks.json에서 once:true 제거 — 매 세션마다 커맨드 재확인 |
| 2026-02-21 | fix | my-session-wrap 1.0.2 | hooks.json에서 once:true 제거 |
| 2026-02-21 | feat | my-cowork 1.1.0 | SessionStart hook 추가 — /cowork 커맨드 자동 등록 및 충돌 감지 |
| 2026-02-21 | feat | my-cowork 1.0.0 | doc-coauthoring 포크 — AskUserQuestion 의무화 |
| 2026-02-21 | feat | my-session-wrap 1.0.1 | SessionStart hook으로 커맨드 자동 등록 + handoff 스크립트 분리 |
| 2026-02-21 | feat | - | marketplace.json 추가 (GitHub 마켓플레이스 전환) |
| 2026-02-21 | chore | - | .gitignore 추가 및 docs 폴더 트래킹 |
| 2026-02-21 | docs | - | README.md 추가 |
| 2026-02-21 | - | - | Initial commit |
