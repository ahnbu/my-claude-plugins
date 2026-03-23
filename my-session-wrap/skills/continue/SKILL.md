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
- Session ID가 없으면 → **경로 B (handoff 기반, 기존 흐름)**

### 경로 A: 세션 파일 기반 복원
1. `~/.claude/projects/*/{sessionId}.jsonl` Glob으로 파일 탐색
2. 파일 미발견 시 → "해당 Session ID의 세션 파일을 찾을 수 없습니다" 안내 후 경로 B로 폴백
3. 파일 발견 시 → Grep으로 type이 "user" 또는 "assistant"인 줄만 추출 후 Read로 읽기
4. 대화 내용에서 컨텍스트 요약 출력:
   - **작업 디렉토리**: cwd 필드
   - **대화 요약**: 주요 user/assistant 메시지 흐름
   - **마지막 작업**: 마지막 assistant 메시지 기준
5. "위 컨텍스트로 이어서 작업할까요?" AskUserQuestion 확인
6. 승인 시 마지막 작업 지점부터 작업 개시

### 경로 B: handoff 기반 복원 (기존)
1. `_handoff/handoff_*.md` Glob으로 검색 → 파일명 기준 최신순 정렬
2. 당일 파일이 2개 이상이면 AskUserQuestion으로 선택, 아니면 최신 1개 자동 선택
3. 선택된 handoff를 Read로 읽기
4. 요약 출력:
   - **작업 목표**: §1에서 추출
   - **현재 상태**: 진행 현황 테이블
   - **시작점**: 다음 세션 시작점
   - **알려진 제약**: §6 환경 스냅샷 (있을 경우)
5. "위 컨텍스트로 시작할까요?" AskUserQuestion 확인
6. 승인 시 handoff의 "다음 세션 시작점"부터 작업 개시
