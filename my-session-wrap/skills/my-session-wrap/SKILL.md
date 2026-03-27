---
name: wrap
description: "세션 마무리: handoff 문서 저장 + git commit. /wrap 슬래시 명령어로만 실행."
---

# Session Wrap

세션 마무리 시 실행하는 경량 워크플로우. Claude, Codex, Gemini 공통.

1. **컨텍스트 복원** — `_handoff/handoff_YYYYMMDD_01_한줄요약.md` 저장으로 다음 세션에서 즉시 재개
2. **변경사항 반영** — (git 있을 시) commit으로 작업 이력 기록

## 실행 흐름

```
Step 1. handoff 파일 생성
Step 2. git commit — cp 위임 (git 없으면 종료)
Step 3. 규칙 후보 확인 + 재개 안내
```

---

## Step 1: handoff 파일 생성

### 1-1. 컨텍스트 수집 + 파일 생성 (절대 생략 불가)

다음 스크립트 실행 전에 파일명에 포함될 `<한줄요약>`을 작성한다.
파일명 형식: `_handoff/handoff_YYYYMMDD_01_한줄요약.md` (예: `next-handoff-스크립트화`, `세션ID-훅-수정`)

```bash
SCRIPT="$(node -e "process.stdout.write(require('os').homedir())")/.claude/my-claude-plugins/my-session-wrap/skills/my-session-wrap/scripts/next-handoff.mjs"
node "$SCRIPT" --json "" "<한줄요약>" "<session_id>"
```

- `<session_id>`: hook 피드백 `[session_id=...]` 값. 없으면 빈 문자열.

스크립트가 런타임 감지, 세션 ID 해결, 세션 요약 조회, handoff 파일 생성을 일괄 수행한다. JSON 출력을 `CONTEXT`로 기억한다.

- `CONTEXT.handoff_path`: 생성된 파일 — Read 후 Edit으로 본문을 채운다
- `CONTEXT.summary`: null이면 AI 컨텍스트에서 직접 작성
- **exit 1 시**: 사용자에게 오류 보고 후 중단

### 1-2. handoff 파일 작성

`CONTEXT.handoff_path` 파일을 **Read한 뒤, Edit으로** 채운다.

**YAML frontmatter:**
- `tags`: 필수 — 프로젝트명·작업유형 (예: `my-claude-plugins, wrap, refactor`)
- `plan`: 비어있고 이 세션에서 Plan Mode 사용 시 plan 파일 절대경로 직접 채움

**본문 §1~§6:**
- 세션 컨텍스트로 작성. 내용 없는 항목은 생략.
- `CONTEXT.summary`가 null이 아니면: 헤더에 토큰·도구 통계 포함, keyEvents로 진행 현황 교차 검증
- §3 레슨 중 이전 handoff에서도 언급된 패턴(2회+)이면 `[규칙 후보]` 태그 추가
- §6: 알려진 이슈가 있을 때만 포함

**금지:** YAML frontmatter 형식 변경, BQ(`>`) 헤더 추가

### 1-3. DB 대조 검수 (CONTEXT.summary가 null이 아닐 때만)

handoff 작성 완료 후, `CONTEXT.summary`의 `gaps` 배열과 작성된 handoff를 대조한다:

- gaps에 `decision` 유형이 있지만 handoff §1 의사결정에 미반영 → 보완
- gaps에 `unresolved` 유형이 있지만 handoff에 미반영 → §4 다음 세션 작업에 추가
- gaps에 `lesson` 유형이 있지만 handoff §5에 미반영 → 보완
- 대조 결과 보완 사항이 없으면 이 단계 스킵

---

## Step 2: git commit

Step 1의 handoff 작성이 완료되면, 아래 스킬을 읽고 그대로 따른다.

`C:\Users\ahnbu\.claude\my-claude-plugins\my-session-wrap\skills\cp\SKILL.md`

- `cp`의 staging, commit message, push 로직을 여기서 재구현하지 않는다.

---

## Step 3: 규칙 후보 확인 + 재개 안내

### 3-1. 규칙 후보 확인

handoff의 `[규칙 후보]` 태그가 1개 이상이면 재개 안내에 포함시켜 출력:

```
⚠️ [규칙 후보] N건 — handoff §3 참조. 반영하려면 "규칙 후보 반영해줘"로 요청.
```

### 3-2. 재개 안내 출력

생성된 handoff 경로를 포함한 재개 프롬프트 출력:

```
---
✅ Handoff 저장: <handoff 절대경로 (상대경로 금지)>

다음 세션에서 이어가려면:
  이전 세션에 이어서 작업합니다. /continue
---
```

---

> **주의:** MEMORY.md(auto memory)는 이 워크플로우의 범위가 아니다. auto memory는 작업 중 자연스럽게 갱신되는 별도 기능이다.
