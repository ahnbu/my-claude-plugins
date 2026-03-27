# Changelog

## 작성 규칙

- **모든 커밋**을 기록 (타입으로 구분)
- 최신 항목을 테이블 최상단에 추가
- 버전 열: 플러그인 버전 변경이 있을 때만 기재, 없으면 `-`

## 이력

| 날짜 | 타입 | 버전 | 변경 내용 |
|------|------|------|-----------|
| 2026-03-27 | docs | - | continue 완료마킹·doc-save 이어쓰기 설계 및 cp/wrap 커밋로직 스크립트화 설계 문서 저장 |
| 2026-03-27 | feat | - | resolve-context-warning PostToolUse 훅 및 save-doc-record 스크립트 추가 |
| 2026-03-27 | refactor | - | wrap SKILL.md Step 0 제거 및 next-handoff.mjs 로직 이동, prompt-context.js .sh→.mjs 참조 수정 |
| 2026-03-27 | feat | - | 세션 last_message 필드 추가 — 마지막 사용자 메시지 검색·조회 지원 |
| 2026-03-27 | docs | - | 스킬 description 정제 — 트리거를 /continue 슬래시 커맨드 전용으로 변경, 설명 내용 개선 |
| 2026-03-27 | refactor | - | cp Step 1 레포 감지 find_save_target.js 스크립트화, files[] 추가, shared/로 이동 |
| 2026-03-27 | feat | - | 경로 B/C 통합 — handoff 스캔 추가, 3일 TTL, 섹션 레이블 유효기간 표기 |
| 2026-03-27 | docs | - | 스킬 JSONL→세션DB 전환 작업 기록 저장 (continue/history-insight/session-analyzer, 검증 결과 포함) |
| 2026-03-27 | refactor | - | continue/history-insight/session-analyzer 스킬 JSONL 직접 조회 → 세션DB 전환 — doc --no-sync 통합, 멀티AI Glob 분기, find/stat 제거 |
| 2026-03-27 | feat | - | sessions 테이블 last_message 컬럼 추가 — session-db/parser/query-sessions 연동, continue 스킬 마지막 입력 표시, find-context-warning display 포맷 개선 |
| 2026-03-27 | feat | - | query-sessions.js doc 커맨드 추가 (on-demand sync·마크다운 출력), SESSION-DB.md §9 사용 가이드 신설 |
| 2026-03-26 | feat | - | 문서 다운로드 버튼 추가 — .md 파일 직접 저장 (일반/상세 구분, _detail 접미어) |
| 2026-03-25 | docs | - | 스킬 레지스트리 JSON 중앙화 구현 기록 — build-skills-registry.mjs 설계, skill-doctor/session-parser 전환, SessionStart hook 의사결정 근거 포함 |
| 2026-03-25 | feat | - | session-parser.js loadSkillWhitelist() 추가 — skills-registry.json names→Set, 미존재 시 buildCodexSkillWhitelist() fallback; my-session-wrap SessionStart hook에 build-skills-registry.mjs 실행 추가 |
| 2026-03-25 | docs | - | 20260325_04 2차 작업내역 추가 (Codex 화이트리스트), 20260325_02 삭제 |
| 2026-03-25 | chore | - | handoff 파일 YAML 일괄 변환 완료 — BQ→YAML 160건, YAML 정규화 81건 (총 241건 자동 처리) |
| 2026-03-25 | feat | - | changelog-add-row.mjs 추가 + Codex 스킬 화이트리스트 필터 (extractCodexSkills whitelist 파라미터) |
| 2026-03-25 | feat | - | migrate-handoff-to-yaml YAML 정규화 기능 추가 — date→created 변환, 불필요 키 제거, FM_KEYS/REMOVE_KEYS 상수화 |
| 2026-03-25 | refactor | - | handoff template frontmatter 정리 — date→created·불필요 키 제거·tags/plan 추가, next-handoff session_id 인자 지원 |
| 2026-03-25 | refactor | - | Co-Authored-By 하드코딩 제거, detect-runtime --coauthor 스크립트로 런타임 감지 |
| 2026-03-25 | docs | - | `_docs` slash_commands 확장·skill_calls 신설 구현 문서 추가 (plan 원문 포함) |
| 2026-03-25 | docs | - | `_docs` context-warning 임계치 80%로 하향 반영 — 설계 문서 갱신 |
| 2026-03-25 | feat | - | `my-session-dashboard` slash_commands 추적 확장 + skill_calls 신설 — Codex `$skill`·Gemini·Antigravity `/skill` 추출, Claude Skill tool_use를 skill_calls에 저장, SESSION-DB.md 갱신 |
| 2026-03-25 | feat | - | `my-session-wrap` continue 경로 B: DB 일괄 조회·display 1줄 포맷·AskUserQuestion 제거 — 속도 20s→12s |
| 2026-03-25 | docs | - | `_docs` continue 스킬 경로 B 검증 및 개선 문서 추가 |
| 2026-03-25 | docs | - | `_docs` wrap 스킬 YAML전환 설계 문서 — /wrap E2E 검증 완료 및 pre-commit hook 버그 수정 내역 추가 |
| 2026-03-25 | fix | - | `git-hooks` pre-commit: 한글 파일명 _handoff 전용 커밋 스킵 오작동 수정 — `git -c core.quotepath=false` 적용 |
| 2026-03-25 | docs | - | `_handoff` wrap YAML형식 E2E검증 handoff 추가 |
| 2026-03-25 | docs | - | `_handoff` 누락 handoff 파일 22건 일괄 추가 (2026-03-06 ~ 2026-03-24) |
| 2026-03-25 | docs | - | `_docs` context-warning 자동기록 + continue 스킬 통합 구현 설계 문서 추가 (기존 설계 문서 대체) |
| 2026-03-25 | feat | - | `my-session-wrap` continue 스킬: context-warning 기반 복원 경로 B 추가 — find-context-warning.mjs 스크립트, 컨텍스트 한계 세션 자동 감지 후 이어가기 제안 |
| 2026-03-25 | feat | - | `my-session-wrap` handoff 파일 git 추적 복원 — pre-commit hook `_handoff/` 전용 커밋 예외, `.gitignore` 제거, SKILL.md Step 3-3 handoff 커밋 단계 추가 |
| 2026-03-25 | docs | - | `_docs` wrap 스킬 handoff YAML 전환 설계 문서 — 비정형 9건 수동 전환 결과 섹션 추가 |
| 2026-03-25 | feat | - | `my-session-wrap` migrate-handoff-to-yaml.mjs 스크립트 추가 — 최근 7일 BQ 형식 handoff 일괄 YAML 전환, dry-run 기본, --apply 실행, bullet/table/unknown 경고 출력 |
| 2026-03-25 | fix | - | `my-session-wrap` template.md 래퍼 제거 — `# Handoff 문서 템플릿` 헤더·```markdown 블록 제거, next-handoff.mjs가 YAML frontmatter부터 직접 복사하도록 수정 |
| 2026-03-25 | docs | - | `_docs` wrap 스킬 handoff YAML 전환 설계 문서 추가 — BQ vs YAML 비교분석, 전환 결정 근거, template.md Read 미실행 원인 분석 |
| 2026-03-24 | docs | - | `my-session-wrap` handoff 형식 불일치 원인 분석 문서 추가 — ai-study 8건·90_자료수집 3건 JSONL 대조, template.md Read 미실행이 YAML 발생 원인 확정 |
| 2026-03-24 | fix | - | `my-session-wrap` SKILL.md 스크립트 참조 .sh → .mjs 잔여 수정 — history-insight/session-analyzer .sh 파일 삭제 + SKILL.md 참조 업데이트 |
| 2026-03-24 | feat | - | `my-session-wrap` continue 스킬: 세션 ID Path A를 DB fast-path로 개선 — query-sessions.js 직접 조회로 Glob 대체, Claude 스코프 우선 |
| 2026-03-24 | fix | - | `shared` session-db: getSession 응답에 slashCommands 필드 추가 — slash_commands 컬럼 파싱 포함 |
| 2026-03-24 | fix | - | `my-session-wrap` SKILL.md .sh → .mjs 통일 — history-insight/session-analyzer/my-session-wrap 스킬 스크립트 명령어 전환 |
| 2026-03-24 | docs | - | `_docs` 슬래시 커맨드 추적 문서 Phase 2 업데이트 — UI 표시, 대화 뷰 버그, DB 재파싱 작업 내역 추가 |
| 2026-03-24 | fix | - | `shared` session-parser: 슬래시 커맨드 메시지 대화 뷰 표시 수정 — cleanText 빈 문자열 시 cmds 폴백으로 "/wrap" 등 텍스트 복원 |
| 2026-03-24 | feat | - | `my-session-dashboard` index.html: 슬래시 커맨드 UI 표시 — 세션 카드 태그, 상세 뷰 "사용 커맨드" 행, 검색 필드 추가 |
| 2026-03-24 | feat | - | `shared` session-parser/session-db/text-utils: 슬래시 커맨드 사용 이력 추적 — `extractSlashCommands()` 추가, sessions 테이블에 `slash_commands` 컬럼 신설 |
| 2026-03-24 | fix | - | `my-session-dashboard` 타임라인 sticky header 투명 틈 제거 — body padding-top 0으로 변경, summary margin으로 보상 |
| 2026-03-24 | fix | - | `my-session-dashboard` 타임라인 모달: 소요 계산 개선, idle 행 삽입, "세션 소요"→"작업 소요", "입력"→"대상" (timeline-builder.js와 동기화) |
| 2026-03-24 | fix | - | `my-session-wrap` session-timeline: 소요 열을 턴 내 스텝 시간으로 변경, idle 행 삽입(5분 임계값), "세션 소요"→"작업 소요"(idle 제외), "입력"→"대상" 열 이름 변경 |
| 2026-03-24 | fix | - | `my-session-wrap` next-handoff.sh → .mjs 통일 — MSYS bash git의 외부 gitdir 경로 오해석 버그 수정, .sh/.ps1 삭제, SKILL.md `bash`→`node` 치환 |
| 2026-03-24 | docs | - | `commands` 신규 스킬의 슬래시 커맨드 등록 규칙 문서화 — `CLAUDE.md`에 스킬래퍼 형식과 `~/.claude/commands/<skill-name>.md` 등록 기준 추가 |
| 2026-03-24 | chore | - | `my-session-wrap,my-session-dashboard` ensure-commands.js 원본 삭제 완료 — .bak 전환 커밋 마무리 |
| 2026-03-24 | chore | - | `my-session-dashboard` hooks/ 미사용 파일 정리 — ensure-commands.js → .bak 전환, hooks.json SessionStart 빈 배열로 정리 |
| 2026-03-24 | chore | - | `my-session-wrap` hooks/ 미사용 파일 정리 — ensure-commands.js → .bak 전환, hooks.json SessionStart 죽은 참조 3개 제거 |
| 2026-03-23 | docs | - | `_docs` session-timeline 스킬 복구 + 소요 열 추가 작업 문서 |
| 2026-03-23 | feat | - | `my-session-wrap` session-timeline 스킬 복구 + 소요 열 추가 — 삭제된 스킬 파일 git 복구, renderTimelineMarkdown()에 소요 열 추가, CLI 테스트 복구 |
| 2026-03-23 | fix | - | `my-session-wrap` continue 스킬 handoff 검색 경로 개선 — git 레포 루트 우선 탐색 후 CWD 폴백 |
| 2026-03-23 | docs | - | `my-session-dashboard` 온디맨드 타임라인 구현 작업 문서 추가 |
| 2026-03-23 | refactor | - | `my-session-dashboard` 타임라인 소요 열 추가 + 왼쪽 패널 도구배지·키워드태그 제거 |
| 2026-03-23 | feat | - | `my-session-wrap` history-insight 리포트 자동 저장 — SKILL.md에 저장 경로 지시 추가, history-insights-report/ 폴더 생성, 2달간 활동 분석 상세 리포트 |
| 2026-03-23 | docs | - | `_docs` 세션DB 검토 문서 + cp 스킬 레포감지 개선 문서 추가, cp 스킬 Step 1 로직 반영 |
| 2026-03-23 | refactor | - | `my-session-wrap` cp 스킬 Step 1 레포 감지 개선 — CWD 3종 스캔 → 변경 파일 기준 레포 감지로 전환, 유령 파일(~/.claude/skills/cp/) 삭제, Gemini/Codex junction 플러그인 원본으로 재설정 |
| 2026-03-23 | feat | 1.5.0 | `my-session-dashboard` 온디맨드 타임라인 — 세션 상세 패널에 "타임라인" 버튼 추가, serve.js에 `/api/timeline/:sessionId` API 엔드포인트 구현, 모달에 요약 통계·도구 호출·서브에이전트 테이블 표시, 빌드 후 자동 종료를 5분 idle timeout으로 변경 |
| 2026-03-23 | refactor | - | `my-session-wrap` 사장 스킬 정리 — session-timeline/session-transcript 스킬 삭제(기법은 대시보드에 흡수), CLI 테스트 2개 제거, session-analyzer 보류(코드 유지) |
| 2026-03-23 | feat | - | `shared` error_count DB 컬럼 추가 — session-parser에 errorCount 카운트, session-db에 ALTER TABLE 마이그레이션, 대시보드 세션 목록에 도구 수/에러 수 배지 표시 |
| 2026-03-23 | feat | - | `my-session-dashboard` 메시지 뷰 개선 — shortenToolName() MCP 도구명 축약, toolSummary() MCP 폴백, 도구 응답 필터 드롭다운(전체/숨김/에러만) 추가 |
| 2026-03-23 | docs | - | 커맨드 스킬 래퍼 패턴 전환 — 4~5단계 테스트 및 의사결정 기록 추가 (session-timeline/session-transcript 동작 검증, doc-save-cp 커맨드 발견, 디스커버리 메커니즘 정리) |
| 2026-03-23 | docs | - | 커맨드 스킬 래퍼 패턴 전환 의사결정 기록 |
| 2026-03-23 | refactor | - | `my-session-wrap` 커맨드를 스킬 래퍼 패턴으로 전환 — wrap/continue/cp 커맨드를 SKILL.md 참조 래퍼로 교체, history-insight 커맨드 신규 생성, save 커맨드 폐기(temp 이동), allowed-tools 제거 |
| 2026-03-21 | feat | - | 대시보드 실행 시 터미널 창 숨김 — session.vbs 래퍼 추가, serve.js 브라우저 열기를 PowerShell Start-Process로 변경, 바로가기(.lnk) wscript.exe 연결 |
| 2026-03-21 | docs | - | 사이드바 토글 성능 개선 의사결정 기록 — grid-template-columns Layout transition 제거, transform: translateX로 GPU 슬라이드 전환. 두 방식 비교(속도·효과·복잡도), 설계 결정(JS 핵 제거) 문서화 |
| 2026-03-21 | feat | - | 세션 대시보드 UI 개선 및 상태 추적 시스템 추가 — index.html 검색 UI 개선(89줄), .pdca-status.json 상태 파일 신규, SESSION-DB.md 테이블 순서 정렬, sidebar 스크린샷 3종 추가 |
| 2026-03-21 | fix | my-session-dashboard | 검색 잘림(substring 10000/2000) 제거 — 26% 세션(574개) 검색 누락 해소 |
| 2026-03-20 | docs | - | 세션 대시보드 과최적화 원복 작업 기록 — Phase 2+3 취소 결정, 변경 분석, 의사결정 근거, Gemini 중복 UUID 수정 검증 |
| 2026-03-20 | docs | - | SESSION-DB.md 개요에 데이터 계층 비교표 2개 추가 — JSONL raw → DB 계층별 용도·크기(100%→1-12% 압축), messages vs events 세부 구성(저장 여부·용량) |
| 2026-03-20 | fix | my-session-dashboard | Gemini 중복 UUID 파일 매빌드 "신규 17" 반복 감지 수정 — 동일 session_id 중복 파일을 sentinel로 저장 |
| 2026-03-20 | revert | my-session-dashboard | 로딩 성능 최적화 원복 — 인라인 방식 복원, 서버 의존성 제거 (Gemini 캐시는 유지) |
| 2026-03-20 | fix | my-session-dashboard | _docs 문서 내 HTML 크기 오기 수정 (8.3MB→33MB) |
| 2026-03-20 | feat | my-session-dashboard | 전문 검색 인덱스 확장 — 도구 JSON 제외, 대화 텍스트 전체 포함 (HTML 33MB, 99MB 대비 67% 감소) |
| 2026-03-20 | feat | my-session-dashboard | 로딩 성능 최적화 — HTML 99MB→33MB(데이터 분리+lazy load), Gemini sentinel 캐시, 가상 스크롤, 증분 빌드, 전문 검색 인덱스 |
| 2026-03-20 | refactor | my-session-dashboard | 목차 펼치기 버튼 위치 조정 — "문서 복사" 버튼 하단으로 이동 (top: 120px → 200px) |
| 2026-03-20 | feat | my-session-dashboard | TOC 접힘 상태 localStorage 유지 — 세션 상세 열 때 이전 접힘 상태 복원, 토글 시 저장 |
| 2026-03-20 | refactor | my-session-dashboard | 도구 응답 행 그레이 처리 — role-badge·tool-name·tool-block 색상을 amber→gray로 변경, tool-result-msg 클래스 분리 |
| 2026-03-20 | fix | my-session-dashboard | AG 토글 UX 개선 — 서브필터를 Antigravity 탭 클릭 시에만 표시(Codex 패턴 일치), 라벨 "전체 탭에도 포함"으로 명확화 |
| 2026-03-20 | feat | my-session-dashboard | Antigravity 포함 토글 추가 — 전체 탭에서 AG 포함 체크박스, localStorage로 상태 유지; Codex 서브태스크도 localStorage 복원 |
| 2026-03-20 | refactor | my-session-dashboard | stats 포맷 간결화 — `Claude(N) | Codex(N) | ...` 형식, 토큰 표시 제거 |
| 2026-03-20 | feat | my-session-dashboard | Antigravity 필터 탭 추가 — CSS 변수·배지·세션 아이템 스타일, 타입 필터 버튼, stats 카운트, 프로젝트 필터 분기; `build.js`에 `syncAntigravity()` 호출 추가 |
| 2026-03-20 | refactor | my-session-wrap | `/cp` Step 1 레포 감지 로직 개선 — CWD 기준 git 3종 스캔(unstaged+staged+untracked)으로 미커밋 변경 파일 수집 후 레포 루트별 그룹핑 |
| 2026-03-20 | feat | shared | Antigravity IDE 대화 세션DB 통합 — `session-parser.js`에 `processAntigravitySession()`·`normalizeAntigravityEntries()` 추가, `session-db.js`에 `syncAntigravity()`·`_syncAntigravityFile()` 추가, `query-sessions.js`에 `--scope antigravity` 필터 추가. export JSON 기반 증분 동기화 |
| 2026-03-19 | feat | my-session-dashboard | 검색창 반응형 개선 — `.header` flex-wrap, `.search-box` min-width 200px, 1024px 미디어쿼리 추가로 반쪽 모니터 대응 |
| 2026-03-19 | feat | my-session-dashboard | `session-parser.js` — isMeta 스킬 본문 대화내역 제외: `if (entry.isMeta) continue;` 추가, DB·HTML·TOC 노이즈 제거 |
| 2026-03-19 | feat | shared/query-sessions.js | query-sessions 스크립트 업데이트 |
| 2026-03-19 | docs | _docs | 루트 문서 3건 삭제 후 `_docs/`에 통합 버전 3건 추가 — Codex/Gemini 호출구분 실험일지, Gemini 자동호출 세션 제외, wrap 스킬 통합 리팩터링 구현계획과 반영결과; 훅현황 정리작업 문서 보완 |
| 2026-03-17 | docs | _docs | 의사결정 문서 2건 `_docs/`로 이동 — wrap 세션DB 통합 검토, 세션DB session alias 동기화 |
| 2026-03-17 | feat | my-session-wrap | wrap 세션DB 통합 — `extract-session-summary.js` 신규, SKILL.md에 Step 2-1.5 DB 조회 + Step 2-4 대조 검수 추가, handoff 템플릿에 토큰·도구 통계 필드 추가 |
| 2026-03-17 | refactor | my-session-wrap | handoff 스크립트 경로를 hook 피드백 기반으로 전환 — `capture-session-id.js` → `prompt-context.js` 리네임, `/wrap` 감지 시 스크립트 절대경로 제공, SKILL.md에서 `find` 제거 |
| 2026-03-17 | docs | my-session-wrap | handoff 경로 오류 수정 의사결정 문서 — 6개 대안 비교분석, D'' Hook 통합 방식 채택 근거 |
| 2026-03-15 | fix | my-session-wrap | `SKILL.md` Step 4-2 출력 템플릿 — `<handoff 파일 경로>` → `<handoff 절대경로 (상대경로 금지)>` 로 변경하여 AI가 상대경로를 사용하는 경우 방지 |
| 2026-03-14 | feat | my-session-dashboard | `index.html` — favicon 추가: dashboard.ico를 base64 inline으로 삽입 |
| 2026-03-12 | docs | - | `20260312_wrap_스킬_통합_리팩터링_구현계획.md` — wrap 스킬 통합 리팩터링 의사결정 기록 (대안 비교·검증 결과 포함) |
| 2026-03-12 | refactor | my-session-wrap | `SKILL.md` 통합 리팩터링 — name: wrap, Step 0 런타임 감지(detect-runtime.ps1), 세션 ID 3분기(Claude/Codex/Gemini), bash/pwsh 스크립트 통합 호출, 관심사별 커밋 사이클 공통 적용; `next-handoff.ps1` 추가(Codex에서 이식); `template.md` 플레이스홀더 통일; `commands/wrap.md` 참조명 my-session-wrap→wrap |
| 2026-03-12 | fix | - | `shared/session-db.js` — Gemini 자동 호출 세션 필터 확장: (claude) 태그도 제외 대상에 추가 (`(codex\|claude)` 정규식으로 통합) |
| 2026-03-12 | fix | - | `shared/session-db.js` — Gemini 자동 호출 세션 제외: (codex) 태그 + 60초 미만 필터 추가. 82→54개 (28개 자동 호출 세션 제거) |
| 2026-03-12 | docs | - | `20260312_Codex_Gemini_호출구분_실험일지.md`, `_handoff/handoff_20260312_02_Gemini-호출구분.md` — Codex-origin Gemini 세션 구분 실험일지 및 handoff 작성: env dump 비교 정정, 옵션 A~E 비교, 최유력안(`인터셉트 wrapper + env + SessionStart mini DB`)과 남은 팩트체크 정리 |
| 2026-03-12 | feat | my-session-dashboard | `index.html` — Gemini 탭 UI 추가: CSS 변수·배지·세션 아이템 스타일, 타입 필터 버튼, stats 카운트, 프로젝트 필터 분기 |
| 2026-03-12 | docs | - | `README.md` 업데이트 — 현행 운용 모드·플러그인 목록 반영 |
| 2026-03-12 | chore | - | `git-hooks/check-version-sync.js`, `my-session-id/`, `my-session-wrap/hooks/check-handoff.js` 삭제 — .bak 파일로 보존 |
| 2026-03-12 | docs | - | `_docs/` — 플러그인 하위 문서 _docs/로 통합 이동, 신규 문서(세션DB 경로 정리·훅 현황·메트릭 개선·문서복사 모드 분리) 추가 |
| 2026-03-12 | docs | - | `_docs/20260312_SESSION-DB_레퍼런스_문서화_및_버전관리_체계_구축.md` — 세션DB 레퍼런스 작성·버전관리 3가지 방법 비교·pre-commit 훅 구현 결과 doc-save |
| 2026-03-12 | chore | - | `git-hooks/pre-commit` 복원 + `check-session-db-doc.js` 추가 — CHANGELOG 강제·SESSION-DB.md 변경 이력 강제·버전 동기화 3단계 검증 |
| 2026-03-12 | docs | - | `_docs/20260312_Gemini_세션_DB_통합_구현결과.md` — Gemini 통합 구현 결과 doc-save: 파서 구조·검증 결과·의사결정·미해결 이슈·plan 원문 포함 |
| 2026-03-12 | docs | - | `SESSION-DB.md` — 작성일·기준 커밋 메타, 변경 이력 표(섹션 8) 추가; `CLAUDE.md` — 세션 DB 변경 시 SESSION-DB.md 갱신 규칙 추가 |
| 2026-03-12 | docs | - | `SESSION-DB.md` — 세션 DB 레퍼런스 최초 작성 (스키마·데이터 흐름·파일 맵·CLI API·확장 가이드) |
| 2026-03-12 | feat | - | `shared/session-parser.js` — `processGeminiSession()`, `normalizeGeminiEntries()` 추가: Gemini CLI `session-*.json` 파싱, thoughts/toolCalls 정규화, 토큰 합산(`input+cached+tool`, `output+thoughts`) |
| 2026-03-12 | feat | - | `shared/session-db.js` — Gemini 세션 DB 통합: `geminiDir` 생성자 옵션, `_syncGeminiDir()` + `_findSessionByFilePath()` 추가, `syncSingleSession()` gemini: 분기, `idx_sessions_file_path` 인덱스 추가 |
| 2026-03-12 | feat | - | `shared/query-sessions.js` — `--scope gemini` 필터 추가 |
| 2026-03-12 | feat | - | `my-session-dashboard/build.js` — Gemini 통계(`geminiNew`) 로그 및 `totalNew` 합산 |
| 2026-03-12 | docs | - | `SESSION-DB.md` — Gemini 통합 반영: 개요·스키마·인덱스·데이터 흐름·파일 맵·CLI·확장 가이드 업데이트 |
| 2026-03-10 | refactor | - | `my-session-id/` 플러그인 삭제 — 초기 세션 ID 테스트용 플러그인, 현재 미사용(settings.json 미등록); `CLAUDE.md`, `marketplace.json`, `README.md`에서 참조 제거 |
| 2026-03-10 | refactor | - | `git-hooks/pre-commit`, `git-hooks/check-version-sync.js` → `.bak` 리네임, `.git/hooks/pre-commit` 제거 — 미설치 운용 모드에서 배포 불필요, 커밋 차단 해제 |
| 2026-03-10 | refactor | - | `my-session-wrap/hooks/check-handoff.js` → `.bak` 리네임, `~/.claude/settings.json` SessionStart에서 해당 hook 제거 — 사용 빈도 낮음 |
| 2026-03-10 | refactor | - | `git-hooks/auto-push-update.js`, `git-hooks/post-commit` → `.bak` 리네임 — plugin 미설치 운용 모드에서 배포 자동화 불필요, 배포 시 복원용으로 보존 |
| 2026-03-10 | refactor | - | `my-session-wrap/hooks/inject-plugin-guidelines.js` → `.bak` 리네임, `~/.claude/settings.json` SessionStart에서 해당 hook 제거 — plugin 미설치 운용 모드에서 배포 절차 주입 불필요 |
| 2026-03-10 | docs | - | `CLAUDE.md` — 배포 워크플로우 섹션을 미설치 운용 모드 기준으로 재작성, 세션 DB 정본을 소스 레포 `output/`로 명시 |
| 2026-03-10 | fix | my-session-wrap 2.9.2 | `hooks/sync-session-stop.js`, `lib/session/session-loader.js` — DB 경로 하드코딩(`os.homedir()`) → `__dirname` 상대경로로 수정: marketplace에서 로드 시 올바른 DB 경로(설치 위치 기준)를 사용하도록 버그 수정 |
| 2026-03-10 | feat | - | `git-hooks/post-commit`, `git-hooks/auto-push-update.js` 신규 추가 — 플러그인 변경 커밋 시 `git push` + `claude plugin marketplace update` + `claude plugin update` 자동 실행; 문서 전용 커밋(`_docs/`, `_handoff/`, 루트 `.md`)은 스킵; `shared/` 변경 시 전체 플러그인 업데이트 |
| 2026-03-10 | feat | my-session-dashboard 1.4.3 | `my-session-dashboard/index.html` — "문서 전체 복사" 버튼 → "문서 복사" + "문서 복사 (상세)" 2개로 분리: 기본은 tool 한 줄 요약(`> 🔧 도구명 summary`), 상세는 tool input JSON 전체 포함; 역할 라벨 분화(User/도구 응답/스킬/Assistant); `messagesToMarkdown(messages, detailed)` 헬퍼 추출 |
| 2026-03-10 | feat | my-session-dashboard 1.4.2 | `shared/session-parser.js` + `my-session-dashboard/index.html` — "도구 응답" 배지에 도구 이름·주요 인자 힌트 추가: `toolUseIdMap`으로 tool_use_id → name/input 매핑, 렌더러에서 `"도구 응답 · Read › /path"` 형태 표시 |
| 2026-03-10 | fix | my-session-dashboard 1.4.1 | `shared/session-db.js` — `messages` 테이블에 `subtype` 컬럼 추가: 스키마·INSERT·SELECT 3곳 수정 + ALTER TABLE 마이그레이션 → 대시보드 역할 라벨 분화("사용자"/"스킬"/"도구 응답") 누락 수정 |
| 2026-03-10 | feat | - | `my-session-dashboard/index.html` — 대화 뷰어 역할 라벨 분화: user subtype별 "사용자"/"스킬"/"도구 응답" 배지 + CSS 추가; 사이드바 "도구" 수 표시 제거 |
| 2026-03-10 | fix | - | `shared/text-utils.js` — `stripSystemTags`에 `task-notification` 태그 추가; `shared/session-parser.js` — `userTextMessageCount` 과다 카운트 수정: `isMeta` 엔트리 제외 + `subtype` 분류 필드(`user_input`/`meta`/`tool_result`) 추가 |
| 2026-03-10 | docs | - | `20260310_세션_메트릭_분리_리네이밍.md`, `_docs/20260310_message_count_...계획.md`, `_docs/20260310_syncSingleSession_Codex_지원하도록_개선.md` — 메트릭 분리 계획 문서 및 이전 세션 Codex syncSingleSession 개선 문서 추가 |
| 2026-03-10 | feat | - | `my-session-dashboard/index.html` — 세션 목록 "메시지" 수 표시를 `userTextMessageCount` 기준으로 전환 (tool_result만 있는 엔트리 제외) |
| 2026-03-10 | feat | - | `shared/session-parser.js`, `shared/session-db.js` — `message_count` → `user_entry_count` 리네이밍 + 신규 메트릭 `user_text_message_count`(실제 텍스트 입력 수), `tool_result_count`(block 수) 추가; DB 자동 마이그레이션(RENAME COLUMN + mtime=0 강제 재동기화) |
| 2026-03-10 | fix | my-session-wrap 2.9.1 | `SKILL.md` — `next-handoff.sh` 탐색 `ls` → `find` 교체: 와일드카드 버전 번호·경로 하드코딩 문제 해소, `$HOME/.claude` 전체를 재귀 탐색하여 개발 레포/marketplaces/cache 어디서든 동작 |
| 2026-03-10 | feat | - | `shared/session-parser.js` — `normalizeCodexEntries()` 추가: Codex JSONL(`event_msg`/`response_item`)을 events 테이블용 이벤트 배열로 정규화, export 포함 |
| 2026-03-10 | feat | - | `shared/session-db.js` — `syncSingleSession()` Codex 분기 추가 + `_findCodexSessionFile()` 추가: `codex:` prefix 감지 → codexDir DFS 탐색 → `normalizeCodexEntries()` 호출 |
| 2026-03-10 | docs | - | `my-session-dashboard/` — Bun segfault npm 전환 트레이드오프 분석 문서 삭제 (D:\CloudSync로 재편, 번호 prefix 포함 4개 파일로 분리) |
| 2026-03-09 | docs | - | `20260309_ss_빌드_성능_개선.md` — 3회차 섹션 추가: 배포 누락 재발 원인 분석, 올바른 CLI 절차, 교훈 기록 |
| 2026-03-09 | docs | - | `CLAUDE.md`, `inject-plugin-guidelines.js` — 배포 절차 CLI 명령 명시: `claude plugin marketplace update` + `claude plugin update` (AI 직접 실행 가능, 마켓플레이스 직접 수정 금지 명문화) |
| 2026-03-09 | docs | - | `my-session-dashboard/` — Bun segfault npm 전환 트레이드오프 분석 문서 추가 |
| 2026-03-09 | docs | - | `_docs/` — 세션통합DB 관련 문서 3건 파일명 리네임 (순번 prefix 01/02/03 추가, 3번 문서 내용 업데이트) |
| 2026-03-09 | feat | - | `my-session-dashboard/build.js` — 변경 없을 때 HTML rebuild early return: `totalNew === 0 && htmlDest 존재` 시 DB 쿼리·JSON.stringify·HTML 쓰기 전체 생략 |
| 2026-03-09 | fix | - | `shared/session-db.js` — Codex cacheKey UUID 불일치 수정: `rollout-...-UUID.jsonl` 파일명에서 UUID만 추출하여 DB session_id(`codex:UUID`)와 일치시킴 → 캐시 미스 376회/실행 → 0회, 2회차 빌드 0.76초 달성 |
| 2026-03-09 | fix | - | `shared/session-db.js` — `sync()` 단일 트랜잭션 래핑 추가: 첫 실행 빌드 시간 1분+ → 4.5초 (약 13배 개선), autocommit으로 매 INSERT마다 fsync하던 문제 해결 |
| 2026-03-09 | docs | - | `_docs/` — 세션통합DB 이슈 검토 문서 §1 원본 plan 전문으로 확장 (Context 표, 기술 비교표, 아키텍처, 스키마 포함) |
| 2026-03-09 | chore | my-session-wrap 2.9.0 | 버전 2.8.1 → 2.9.0 bump — DB 전체 파이프라인 전환 + Stop 훅 추가 반영 |
| 2026-03-09 | feat | - | `my-session-wrap` — Stop 훅 추가: `sync-session-stop.js` 세션 종료 시 `SessionDB.syncSingleSession(force)` 호출로 events DB 즉시 갱신 (Hybrid C) |
| 2026-03-09 | feat | - | `my-session-wrap` — DB 전체 파이프라인 전환: `session-loader.js` DB events 직접 조회(`_loadEventsFromDb`), `session-normalizer.js` `fromDb: true` 분기로 `normalizeEntries` 스킵 → timeline/transcript JSONL 파싱 없이 동작 |
| 2026-03-09 | feat | - | `my-session-wrap` — `session-loader.js` DB 우선 파일 조회: sessions.db의 `file_path` 활용으로 DFS 생략, `options.dbPath=false`로 비활성화 가능, 기존 테스트 전부 통과 |
| 2026-03-09 | feat | - | `my-session-dashboard` — `build.js` SQLite DB 기반 증분 빌드 전환: `.build-cache.json` 제거, `SessionDB.sync()` 증분 upsert, `getAllMeta()`·`getMessages()`·`getPlanContent()` 조회로 HTML 생성 |
| 2026-03-09 | feat | - | `shared/` 공유 모듈 신설: `text-utils.js`(stripSystemTags 등 공통 유틸), `session-parser.js`(JSONL/Plan/Codex 파싱), `session-db.js`(SQLite SessionDB — sync/getAllMeta/getMessages/getEvents/syncSingleSession API); `my-session-wrap` shared.js·session-normalizer.js 위임 전환 |
| 2026-03-09 | feat | - | `my-session-wrap` — timeline 표에 `간격`(이전 도구 호출 대비 경과시간)·`입력`(도구 호출 컨텍스트) 열 추가, `getToolContext` shared.js로 이전, `timelinePreview` 2-pass 정리(cleanToolResultText → JSON wrapper 제거) |
| 2026-03-09 | feat | - | `my-session-wrap` — timeline/transcript MD 가독성 개선: `shared.js`에 `formatDuration`·`shortenToolName`·`cleanToolResultText` 헬퍼 추가, `renderTimelineMarkdown` 테이블 렌더링 전환 (ms 노출 제거, 도구명 축약), `buildTranscript` 대화 포맷 개선 (한국어 역할명·`---` 구분선·blockquote 도구 블록), 단위 테스트 11개 추가 |
| 2026-03-09 | feat | - | `my-session-dashboard`: plan 상세 세션ID에 plan slug 대신 실제 세션 UUID 표시 (`linkedSessionId` 추가) |
| 2026-03-09 | chore | - | 루트 `dashboard-*.png` 4개 제거 |
| 2026-03-09 | docs | - | `_docs/` 폴더 구조 재편 — 문서 이동 반영 (`_docs/공통/`으로 세션이력분석·플러그인계획 통합, `_docs/my-session-dashboard/`로 문서 이동, `_docs/문서시스템연구/`·`_docs/세션이력분석/` 폴더 제거) |
| 2026-03-09 | chore | - | `my-cowork`, `taskmaster-cli` 플러그인 제거 — git에서 삭제 반영 |
| 2026-03-09 | feat | - | `my-session-dashboard` — 세션 ID 검색 지원 + 세션/Plan 상세 패널 헤더에 세션 ID 행 및 복사 버튼 추가 |
| 2026-03-09 | feat | - | `my-session-wrap` — 세션 타임라인/트랜스크립트 분석 기능 추가: 공통 session parsing layer, `session-timeline`·`session-transcript` 스킬/CLI, `tool_result`/`planContent` 보존 정책, fixture 기반 `node --test` 검증 |
| 2026-03-08 | docs | - | Playwright MCP vs CLI 비교 및 CLI 우선 규칙 문서 추가 |
| 2026-03-08 | docs | - | `my-session-dashboard` — Codex 세션 통합 대시보드 스크린샷(dashboard-*.png) 및 기능 요약 문서 추가 |
| 2026-03-08 | chore | - | `.gitignore` — `_handoff/`, `.playwright-mcp/` 추가 |
| 2026-03-08 | fix | - | `my-session-dashboard` — 검색 범위 확대: 대화 본문 3000→10000자, toolNames 도구명 검색 필드 추가 |
| 2026-03-08 | chore | - | `my-session-dashboard` — 타입 필터 탭 "Claude" → "Session" 네이밍 변경 |
| 2026-03-08 | fix | - | `my-session-dashboard` — `copyDoc` Plan 본문 첫 줄 `# 제목` 메타 헤더 중복 제거 (`meta.type === "plan"` 분기) |
| 2026-03-08 | feat | my-session-dashboard 1.4.0 | `my-session-dashboard` — Codex 세션 통합 조회: `~/.codex/sessions/` JSONL 파싱 (`processCodexSession`, `loadCodexSessions`), Codex 탭 추가, 서브태스크 포함 토글, 주황 CODEX 배지, toolSummary Codex 도구 지원 (`shell`, `apply_patch`, `web_search`) |
| 2026-03-08 | feat | - | `my-session-dashboard` — `copyDoc` Plan 유형 메타 헤더 추가(slug·수정일·글자수·프로젝트·파일) + `currentMeta` 전역 변수로 `sessions.find()` 중복 제거 |
| 2026-03-08 | feat | - | `my-session-dashboard` — 문서 전체 복사 시 메타 정보 헤더 포함: 제목·프로젝트·브랜치·소요시간·토큰·모델·파일 경로 |
| 2026-03-08 | feat | - | `my-session-dashboard` — 세션 상세 헤더에 "문서 전체 복사" 버튼 추가 + `copyDoc` 마크다운 대화 포맷 변환 (`## User`/`## Assistant` + `---` 구분선) |
| 2026-03-08 | feat | - | `my-session-dashboard` — 목차 패널 assistant 메시지 그룹핑: user 간 assistant 다수 메시지 중 가장 긴 대표 1개만 표시, `[thinking]`·10자 미만 메시지 목차 제외 |
| 2026-03-08 | fix | - | `my-session-dashboard` — 프로젝트 필터 펼침 시 하단 가림 수정: `grid-template-rows` 4행으로 확장 + `.sidebar`/`.main`에 `grid-row: 4` 명시, `.filters` max-height 40vh + overflow-y auto |
| 2026-03-08 | feat | - | `my-session-dashboard` — 검색창 X 버튼 + ESC 더블탭 초기화: 입력 시 X 표시, 클릭 시 초기화, ESC 2회(300ms 내) 입력 초기화 |
| 2026-03-08 | fix | - | `my-session-dashboard` — 검색 AND 지원: 공백으로 구분된 다중 단어 입력 시 모든 단어가 포함된 세션만 반환 |
| 2026-03-08 | fix | - | `my-session-dashboard` — 세션 검색에 대화 내용(messages) 포함 확장 + 파일 경로 복사 버튼 백슬래시 누락 수정 (data-path 속성 방식으로 전환) |
| 2026-03-07 | feat | - | `taskmaster-cli` 플러그인 신규 추가 — task-master-start/stop, tm-done/list/next/parse-prd/progress/show 8개 스킬 |
| 2026-03-07 | feat | - | `my-session-wrap` SKILL.md — `/wrap` 스킬 멀티 레포 그룹핑 지원: Step 1 레포 루트 수집, Step 3 레포별 CHANGELOG·커밋 순회 처리 추가 |
| 2026-03-07 | feat | - | `my-session-wrap/commands/cp.md` — `/cp` 멀티 레포 지원: 변경 파일별 레포 루트 감지 → 레포별 그룹핑 → CHANGELOG + 커밋 + 푸시 개별 처리 |
| 2026-03-07 | fix | - | `my-session-wrap` handoff 세션 경로 full path 기재 — SKILL.md `~/.claude/...` 단축형 제거 후 `C:/Users/ahnbu/.claude/projects/...` 명시, `세션 경로:` 필드를 template.md에 추가 |
| 2026-03-06 | fix | - | `my-session-wrap` SKILL.md 3-1/3-2절 — CHANGELOG 일괄 추가 후 커밋 분리 시 pre-commit hook 차단 버그 수정: 3-1은 위치·양식 확인만, 3-2에서 "관심사 1줄 추가 → git add → commit" 사이클 반복 패턴으로 변경 |
| 2026-03-06 | fix | - | `my-session-wrap/commands/cp.md` — remote 없는 레포에서 push 시도 방지: git remote 확인 후 없으면 "로컬 전용 레포 — push 생략" 안내로 분기 |
| 2026-03-06 | docs | - | 미추적 handoff 파일 7개 추가 (`20260225_09~12`, `20260302_01`, `20260305_04`, `20260306_01`) + `20260306_문서_handoff_경로통일_계획.md` → `_docs/공통/`으로 이동 |
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
