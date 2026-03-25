---
name: continue
description: "최신 handoff를 읽고 이전 세션 컨텍스트를 재수립. Triggers: 'continue', '이어서', '이전 세션', '컨텍스트 복원', '세션 이어가기'"
---

# Session Continue

이전 세션의 handoff 또는 Session ID를 기반으로 컨텍스트를 재수립합니다.

## 실행 흐름

### Step 0: 입력 분석
- 사용자 메시지에서 UUID v4 패턴(`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) 검출
- Session ID가 있으면 → **경로 A (세션 파일 기반)**
- Session ID가 없으면 → **경로 B (context-warning 체크)** → 없으면 **경로 C (handoff 기반)**

### 경로 A: 세션 파일 기반 복원

#### A-1: DB Fast-path (우선)
1. DB 조회 (Claude 스코프 우선):
   ```
   node ~/.claude/my-claude-plugins/shared/query-sessions.js get <sessionId>
   ```
   - AI 스코프 미명시 시 `--scope claude` 적용 (Claude 우선 조회)
   - 출력 JSON: `{ session_id, title, project, file_path, keywords, first_message, ... }`
2. DB 결과가 있으면:
   - `file_path`로 JSONL 파일을 직접 Read (Glob 불필요)
   - 컨텍스트 요약 출력:
     - **세션 제목**: `title` 필드
     - **프로젝트**: `project` 필드
     - **키워드**: `keywords` 배열
     - **마지막 작업**: JSONL 마지막 assistant 메시지 기준
3. DB 결과 없으면 → A-2 Glob 폴백으로 진행

#### A-2: Glob 폴백
1. `~/.claude/projects/*/{sessionId}.jsonl` Glob으로 파일 탐색
2. 파일 미발견 시 → "해당 Session ID의 세션 파일을 찾을 수 없습니다" 안내 후 경로 C로 폴백
3. 파일 발견 시 → Grep으로 type이 "user" 또는 "assistant"인 줄만 추출 후 Read로 읽기
4. 대화 내용에서 컨텍스트 요약 출력:
   - **작업 디렉토리**: cwd 필드
   - **대화 요약**: 주요 user/assistant 메시지 흐름
   - **마지막 작업**: 마지막 assistant 메시지 기준

#### A-3: 공통 완료 처리
- "위 컨텍스트로 이어서 작업할까요?" AskUserQuestion 확인
- 승인 시 마지막 작업 지점부터 작업 개시

### 경로 B: context-warning 기반 복원

1. 스크립트 호출:
   ```
   node ~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/find-context-warning.mjs
   ```
   - 출력 JSON: `{ found: boolean, session_id?, cp?, remaining?, ts? }`
2. `found: false` → 경로 C로 넘어감
3. `found: true, count == 1` → AskUserQuestion으로 제안:
   > "컨텍스트 {cp}%에서 중단된 세션이 있습니다.
   > 세션 ID: {session_id} (기록 시각: {ts})
   > 이어서 진행할까요? (예/아니오)"
4. `found: true, count >= 2` → AskUserQuestion으로 목록 표시:
   > "컨텍스트 한계 세션 {count}개가 있습니다:
   > 1. {session_id} — {cp}% ({ts})
   > 2. {session_id} — {cp}% ({ts})
   > ...
   > 번호를 선택하거나 '건너뛰기'를 입력하세요."
5. 승인/선택 시 → **경로 A** 실행 (해당 `session_id`로)
6. 거절/건너뛰기 시 → 경로 C로 넘어감

### 경로 C: handoff 기반 복원 (기존)
1. handoff 검색 (다단계 탐색):
   a. `git rev-parse --show-toplevel`로 레포 루트 확인 → `<레포루트>/_handoff/handoff_*.md` Glob 검색
   b. 미발견 또는 git 레포 아닌 경우 → CWD에서 `_handoff/handoff_*.md` Glob 검색
   c. 미발견 시 → "handoff 파일을 찾을 수 없습니다" 안내 후 종료
   → 파일명 기준 최신순 정렬
2. 당일 파일이 2개 이상이면 AskUserQuestion으로 선택, 아니면 최신 1개 자동 선택
3. 선택된 handoff를 Read로 읽기
4. 요약 출력:
   - **작업 목표**: §1에서 추출
   - **현재 상태**: 진행 현황 테이블
   - **시작점**: 다음 세션 시작점
   - **알려진 제약**: §6 환경 스냅샷 (있을 경우)
5. "위 컨텍스트로 시작할까요?" AskUserQuestion 확인
6. 승인 시 handoff의 "다음 세션 시작점"부터 작업 개시
