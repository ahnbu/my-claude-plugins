---
date: 2026-03-24
scope: current-session
session: "87d03c95-8eba-449d-b40f-f290790aa265"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/87d03c95-8eba-449d-b40f-f290790aa265.jsonl"
---

# continue 스킬 — 세션 ID 경로(Path A) DB 조회 개선

## 발단: 사용자 요청

> "현재 continue 스킬은 무조건 handoff를 읽게 되어 있는데, 세션id를 입력하면 해당 세션id에서 중단된 작업으로 시작하게 개선하고 싶다."

사용 패턴:
```
> 다음 세션을 이어서 진행하라.
  Session ID: 3178b6f6-f180-4cc2-be03-e945ab4da90d
```

추가 요청 (대화 중 추가):
> "ai를 명시하지 않으면 클로드코드를 우선 조회하면 좋겠다."

## 작업 상세내역

### 현재 continue 스킬 구조

`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\continue\SKILL.md` 에 두 경로가 존재:

- **Path A** (세션 ID 기반): UUID v4 감지 → `~/.claude/projects/**/<sessionId>.jsonl` Glob → Grep으로 user/assistant 메시지 추출 → 요약 → 작업 개시
- **Path B** (handoff 기반): `_handoff/handoff_*.md` Glob → 최신 파일 Read → 요약 → 작업 개시

### 발견된 Path A의 한계

| 항목 | 현재 상태 | 개선 방향 |
|------|-----------|-----------|
| **스코프** | Claude 전용 (`~/.claude/projects/**`) | Codex/Gemini 경로 미지원 |
| **조회 방식** | 파일시스템 Glob (느림) | DB `file_path` 직접 반환 ✅ |
| **메타데이터** | 없음 — JSONL raw 파싱만 | DB에 title, keywords, project 이미 있음 |
| **기본 스코프** | 명시 없으면 Claude 전용 | Claude 우선으로 명시 |

<span style="color:#888">*정렬 기준: 조회 방식이 핵심 병목, 메타데이터 부재가 복원 품질에 가장 큰 영향*</span>

### 의사결정: session-find 스킬 vs DB 직접 호출

평가 결과: **DB 직접 호출** 채택 (`query-sessions.js get <session_id>`)

- `session-find`는 검색(키워드→후보 목록) 스킬 — continue의 "정확한 ID 즉시 복원" 목적과 미스매치
- 스킬 체인 복잡도 증가 및 스킬 간 의존성 문제 회피
- `query-sessions.js`는 이미 공용 인프라로 안정화됨

## 의사결정 기록

- **결정**: Path A를 `query-sessions.js get <id>`로 교체 + Claude 기본 스코프 명시
- **근거**: DB에 `file_path`, `title`, `project`, `keywords`가 이미 저장되어 있어 Glob 불필요. 한 번의 Node 호출로 모든 메타데이터 획득.
- **트레이드오프**:
  - 얻는 것: 빠른 조회, 풍부한 컨텍스트, 멀티스코프 가능성
  - 잃는 것: `query-sessions.js` 의존성 추가 (리스크 낮음 — 이미 공용 인프라)

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| SKILL.md 수정 완료 | 파일 내용 확인 | ✅ 완료 | `continue/SKILL.md` 경로 A 교체 |
| DB 조회 흐름 확인 | `query-sessions.js get <id>` 직접 실행 | ✅ 완료 | 예시 세션 ID로 title/file_path 반환 확인 |
| 기존 Path B(handoff) 영향 없음 | SKILL.md 검토 | ✅ 완료 | 경로 B 코드 미변경 |

## 다음 액션

1. `continue/SKILL.md` Path A 수정:
   - UUID 감지 시 `query-sessions.js get <session_id>` 호출 (DB fast-path)
   - DB 결과에서 `file_path`, `title`, `project` 추출
   - JSONL 파일 직접 Read (Glob 불필요)
   - DB 메타데이터 + 마지막 메시지로 컨텍스트 복원
   - DB 결과 없을 때 기존 Glob 폴백 유지
2. 기본 스코프: AI 명시 없으면 Claude 우선 (`--scope claude`)

## 리스크 및 미해결 이슈

- Codex/Gemini 세션 ID 입력 시 Claude 우선 조회 후 miss → 어떻게 처리할지 (폴백 순서 결정 필요)
- JSONL이 매우 긴 경우 마지막 N개 메시지만 파싱하는 로직 필요 여부
