---
name: continue
description: "Session ID, handoff 문서, context_limit 데이터 기반으로 이전 세션 컨텍스트 복원. Triggers: /continue 슬래시 커맨드로만 호출"
---

# Session Continue

이전 세션의 handoff 또는 Session ID를 기반으로 컨텍스트를 재수립합니다.

## 실행 흐름

### Step 0: 입력 분석
- 사용자 메시지에서 UUID v4 패턴(`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) 검출
- Session ID가 있으면 → **경로 A (세션 파일 기반)**
- Session ID가 없으면 → **경로 B (통합 복원)**

### 경로 A: 세션 파일 기반 복원

#### A-1: DB Fast-path (우선)
1. DB 조회:
   ```
   node ~/.claude/my-claude-plugins/shared/query-sessions.js doc <sessionId> --no-sync
   ```
   - 출력: 마크다운 (헤더에 title·project 포함, 대화 내용 포함)
2. 출력이 있으면:
   - 컨텍스트 요약 출력 (doc 마크다운 기준):
     - **세션 제목**: doc 헤더 title
     - **프로젝트**: doc 헤더 project
     - **대화 흐름**: doc 마크다운 내용
3. DB 결과 없으면 → A-2 Glob 폴백으로 진행

#### A-2: Glob 폴백
session_id 접두어로 AI 타입 분기:
- `codex:` 접두어 → `~/.codex/sessions/**/*-<UUID>.jsonl` Glob
- `gemini:` 접두어 → `~/.gemini/tmp/*/chats/session-*.json` (UUID 매칭)
- 순수 UUID → `~/.claude/projects/*/{sessionId}.jsonl` (기존)

1. 위 패턴으로 Glob 탐색
2. 파일 미발견 시 → "해당 Session ID의 세션 파일을 찾을 수 없습니다" 안내 후 경로 B로 폴백
3. 파일 발견 시 → Grep으로 type이 "user" 또는 "assistant"인 줄만 추출 후 Read로 읽기
4. 대화 내용에서 컨텍스트 요약 출력:
   - **작업 디렉토리**: cwd 필드
   - **대화 요약**: 주요 user/assistant 메시지 흐름
   - **마지막 작업**: 마지막 assistant 메시지 기준

#### A-3: 공통 완료 처리
- "위 컨텍스트로 이어서 작업할까요?" AskUserQuestion 확인
- 승인 시 마지막 작업 지점부터 작업 개시

### 경로 B: 통합 복원

1. handoff 디렉토리 결정:
   a. `git rev-parse --show-toplevel` → `<root>/_handoff`
   b. 실패 시 CWD의 `_handoff`
   c. 디렉토리 미존재 시 `--handoff-dir` 인자 생략
2. 스크립트 호출 (현재 세션 ID를 인자로 전달):
   ```
   node ~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/find-context-warning.mjs --session-id <현재_session_id> [--handoff-dir <path>]
   ```
   - 현재 session_id: system-reminder의 `[session_id=XXXX]` 값
   - 출력 JSON: `{ found: boolean, count?, sections?: { context_limit, handoff_only } }`
   - 부수효과: `.pending_<session_id>` 파일 생성 (PostToolUse hook이 resolved 마킹에 사용)
3. `found: false` → "복원 가능한 세션이 없습니다" 안내 후 종료
4. `found: true` → 텍스트로 통합 목록 출력 (AskUserQuestion 사용 금지):
   ```
   이전 세션 {count}개:

   [context limit] (최근6시간 이내)
   1. {display}   ← handoff_path 있으면 "📎" 표시, resolved이면 "(완료)" 접두어
      └ {session_id}
   2. {display}
      └ {session_id}

   [handoff only] (최근3일)
   3. {title} ({created})
      └ {session_id 또는 "session_id 없음"}
      └ {file_path}

   0. 건너뛰기

   번호를 입력하세요:
   ```
   - `context_limit` 섹션이 비어있으면 해당 섹션 헤더 생략
   - `handoff_only` 섹션이 비어있으면 해당 섹션 헤더 생략
5. 사용자 입력 대기 (일반 채팅 응답)
6. `context_limit` 항목 선택 시 → **경로 A** 실행 (해당 `session_id`로)
   - PostToolUse hook이 경로 A-1의 `query-sessions.js get <session_id>` 호출을 자동 감지하여 resolved 마킹
   - resolved_doc가 있으면 경로 A 완료 후 안내: "이전 doc-save 문서: {경로} — 이어서 업데이트합니다."
   - `handoff_path` 있으면 경로 A 완료 후 안내: "관련 handoff: {handoff_path}"
7. `handoff_only` 항목 선택 시:
   - `session_id` 있으면 → **경로 A** 실행
   - `session_id` 없으면 → `file_path` Read 후 요약 출력:
     - **작업 목표**: §1에서 추출
     - **현재 상태**: 진행 현황 테이블
     - **시작점**: 다음 세션 시작점
     - **알려진 제약**: §6 환경 스냅샷 (있을 경우)
8. 0 선택 → 종료
