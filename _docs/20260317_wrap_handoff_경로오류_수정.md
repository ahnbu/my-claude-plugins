---
date: 2026-03-17
scope: current-session
session: "321caf0d-6a76-4dd0-b45f-1791e2a5d0b1"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/321caf0d-6a76-4dd0-b45f-1791e2a5d0b1.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/wiggly-squishing-thimble.md"
---

# wrap 스킬 handoff 경로 오류 수정 — Hook 통합 방식(D'')

## 발단: 사용자 요청

`/wrap` 스킬 실행 시 다음 오류 발생. 원인과 재발방지 방안 제시 요청.

```
● Bash(cd "C:/Users/ahnbu/.claude/skills" && pwsh -Command "&
      'C:/Users/ahnbu/.claude/skills/wrap/scripts/next-handoff.ps1'")
  ⎿  Error: Exit code 1
     &: The term 'C:/Users/ahnbu/.claude/skills/wrap/scripts/next-handoff.ps1' is not recognized
```

AI가 SKILL.md의 `find` 명령을 무시하고 존재하지 않는 경로 `skills/wrap/scripts/next-handoff.ps1`을 추측하여 실패. 2차 시도에서 올바른 경로(`my-claude-plugins/my-session-wrap/skills/my-session-wrap/scripts/next-handoff.ps1`)로 성공.

추가로 gitignore 차단 오류도 보고되었으나 사용자가 범위에서 제외 지시.

## 작업 상세내역

### 1단계: 오류 원인 분석

- SKILL.md(`:163-170`)에 `find` 명령으로 스크립트를 탐색하도록 지시되어 있으나, AI가 코드블록을 참고용으로만 해석하고 자체 경로 조합
- 실제 스크립트 위치: `~/.claude/my-claude-plugins/my-session-wrap/skills/my-session-wrap/scripts/next-handoff.sh`
- `~/.claude/skills/.gitignore`에 `_handoff/` 포함 → handoff 파일 `git add` 시 차단 (범위 제외됨)

### 2단계: 수정 방식 비교 — 3안 비교 (1차)

| 항목 | A. 인라인 (git only) | B. 인라인 (marker scan 포함) | C. 기존 스크립트 유지 + 지시문 강화 |
|------|------|------|------|
| 오류 재발 방지 | ✅ 근본 제거 — find 자체 불필요 | ✅ 근본 제거 — find 자체 불필요 | ⚠️ AI가 지시문 무시 시 재발 가능 |
| 유지보수 편의 | ✅ SKILL.md 하나만 관리 | SKILL.md 하나만 관리 | ❌ 스크립트(.sh+.ps1) + SKILL.md 3파일 |
| SKILL.md 길이 증가 | ✅ ~15줄 | ~25줄 | ❌ 0줄 (대신 외부 의존) |
| 비-git 프로젝트 지원 | ❌ 미지원 | ✅ marker scan으로 지원 | ✅ marker scan으로 지원 |
| 크로스플랫폼 | ✅ bash만 — Claude/Gemini/Codex 모두 | ✅ bash만 | ⚠️ .sh + .ps1 이중 관리 |
| 변경 규모 | SKILL.md 수정 + 스크립트 2개 삭제 | SKILL.md 수정 + 스크립트 2개 삭제 | ✅ SKILL.md 지시문 2줄 수정 |

*정렬 기준: 오류 재발 방지력 > 유지보수 편의 > 비-git 지원 순.*

사용자 피드백: "스크립트를 분리하는 안은 고려 대상이 아닌가?"

### 3단계: 스크립트 분리 재평가 (2차 비교)

C안의 약점이 "AI가 지시문을 무시"하는 것이지 스크립트 분리 자체의 문제가 아님을 인식.

| 항목 | 인라인 (B) | 스크립트 분리 (C 개선) |
|------|------|------|
| 오류 재발 방지 | ✅ find 불필요 | ✅ `${CLAUDE_PLUGIN_ROOT}` 상대경로로 find 제거 가능 |
| 로직 변경 시 | ❌ SKILL.md 마크다운 안에서 bash 수정 | ✅ 스크립트 파일만 수정, 테스트 용이 |
| SKILL.md 가독성 | ❌ ~25줄 bash 블록이 문서 중간에 삽입 | ✅ 1줄 호출만 |
| 단독 테스트 | ❌ SKILL.md에서 추출해야 테스트 | ✅ `bash scripts/next-handoff.sh` 직접 실행 |

*정렬 기준: 오류 재발 방지(동등) > 로직 변경 용이성 > SKILL.md 가독성*

사용자 피드백: "hook으로 호출하는 방식은 어떤가?"

### 4단계: Hook 기반 방식(D안) 검토

**D안 구상**: `/wrap` 실행 시 `UserPromptSubmit` hook이 `${CLAUDE_PLUGIN_ROOT}`로 스크립트를 호출하고, 결과 경로를 AI에게 전달.

**문제점 발견**:
1. 요약어가 없다 — hook은 AI가 세션을 분석하기 전에 실행됨
2. 매 프롬프트 실행 — `/wrap`만 필터링하려면 hook 내부에서 프롬프트 파싱 필요
3. 경로 전달 방식 — hook stdout은 피드백으로 전달되지만 SKILL.md에 추가 지시 필요

**재설계**: hook이 스크립트를 실행하는 것이 아니라 **스크립트의 절대경로만 제공**하면 요약어 문제가 해결됨.

### 5단계: 4안 최종 비교

| 항목 | A. 인라인 git-only | B. 인라인 full | C. 스크립트+확정경로 | D. Hook 기반 |
|------|------|------|------|------|
| find 제거 | ✅ | ✅ | ✅ `${CLAUDE_PLUGIN_ROOT}` | ✅ `${CLAUDE_PLUGIN_ROOT}` |
| 요약어 반영 | ✅ AI가 직접 조합 | ✅ AI가 직접 조합 | ✅ 인자로 전달 | ❌ hook 시점에 미정 |
| 구현 복잡도 | ████░░ | ██░░░░ | ████░░ | ░░░░░░ |
| 테스트 용이 | ❌ SKILL.md에서 추출 | ❌ SKILL.md에서 추출 | ✅ 스크립트 직접 실행 | ⚠️ hook + 스크립트 연동 테스트 |
| 비-git 지원 | ❌ | ✅ | ✅ | ✅ |
| SKILL.md 가독성 | ██░░░░ | ░░░░░░ | ✅ 1줄 호출 | ✅ hook이 처리 |

*정렬 기준: find 제거(동등) > 요약어 반영 > 구현 복잡도. D안은 요약어 타이밍 문제가 치명적.*

**D' 재설계**: hook이 스크립트 절대경로만 AI에게 전달 → 요약어 문제 해결.

### 6단계: `${CLAUDE_PLUGIN_ROOT}` 미확장 문제 발견

사용자 지적: "이게 플러그인으로 등록되지 않는 상태다. 그래도 `${CLAUDE_PLUGIN_ROOT}`이 동작하는가?"

분석 결과:
- `${CLAUDE_PLUGIN_ROOT}`는 **hooks.json 내부에서는** Claude Code가 확장 (현재 동작 중)
- **SKILL.md는 AI에게 텍스트로 전달** → `${CLAUDE_PLUGIN_ROOT}` 미확장
- **C안(스크립트+확정경로) 불가 확정** — SKILL.md에서 변수 사용 불가

이로써 D' 방식(hook이 `${CLAUDE_PLUGIN_ROOT}` 확장 가능한 컨텍스트에서 경로 제공)이 유일한 스크립트 분리 + find 제거 방안으로 확정.

### 7단계: Hook 통합 방식(D'') 확정

사용자 제안: "capture-session-id.js에 통합해서 실행하는 것은 어떤가?"

- 별도 hook 추가 없음 — 기존 프로세스에 3줄 추가
- `/wrap` 아닐 때 오버헤드 0 (조건 분기만)
- `__dirname` 기준 상대경로 → 레포 위치 무관

사용자 추가 지시: hook 이름을 기능에 맞게 수정 → `capture-session-id.js` → `prompt-context.js`

## 의사결정 기록

### 검토한 옵션

| 옵션 | 채택 | 제외 사유 |
|------|------|-----------|
| A. 인라인 git-only | ❌ | 비-git 프로젝트 미지원 (사용자가 비-git 사용 확인) |
| B. 인라인 full | ❌ | SKILL.md에 ~25줄 bash 삽입 → 가독성 저하, 테스트 어려움 |
| C. 스크립트+확정경로 | ❌ | `${CLAUDE_PLUGIN_ROOT}` SKILL.md에서 미확장 → 근본적 불가 |
| D. Hook 별도 | ❌ | 매 프롬프트 추가 프로세스 → 비효율 |
| D'. Hook→경로제공 | ❌ | D''로 발전 (별도 파일 불필요) |
| **D''. Hook 통합** | ✅ | **채택** |

- 결정: D'' — `capture-session-id.js`를 `prompt-context.js`로 리네임하고 `/wrap` 감지 로직 통합
- 근거: 추가 프로세스 없음, `${CLAUDE_PLUGIN_ROOT}`가 hooks.json 컨텍스트에서 확장됨, `__dirname` 기준으로 스크립트 절대경로 안전 계산, 스크립트 분리 유지
- 트레이드오프: hook 파일이 2가지 책임(세션 ID + wrap 경로)을 가짐. 하지만 두 기능 모두 "프롬프트 제출 시 컨텍스트 제공"이라는 동일 역할이므로 응집도 양호.

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| prompt-context.js 리네임 | `ls hooks/` 확인 | ✅ 완료 | `capture-session-id.js` 제거 확인 |
| hooks.json 파일명 반영 | hooks.json + settings.json 참조 확인 | ✅ 완료 | settings.json도 추가 발견하여 수정 |
| `/wrap` 입력 시 `[handoff_script=...]` 출력 | stdin mock 테스트 | ✅ 통과 | 절대경로 정상 출력 |
| 일반 프롬프트에서 `handoff_script` 미출력 | stdin mock 테스트 | ✅ 통과 | session_id만 출력 |
| SKILL.md find 블록 교체 | SKILL.md `:159-167` 확인 | ✅ 완료 | hook 피드백 참조 + find 폴백 |
| 기존 세션 ID 기능 정상 | 두 테스트 모두 `[session_id=...]` 출력 | ✅ 통과 | |
| 스크립트 실존 | `test -f` 확인 | ✅ EXISTS | |

## 리스크 및 미해결 이슈

- gitignore 차단 문제 (오류 2)는 범위 제외 — 별도 세션에서 처리 필요
- `next-handoff.ps1` 삭제 여부 미결정 (Codex 환경 호환성 고려하여 현재 유지)
- 실제 `/wrap` 실행은 다음 세션에서 E2E 테스트 필요 (이번 세션은 mock 테스트만 수행)

## 다음 액션

1. ~~`prompt-context.js` 내용 수정~~ ✅ 완료
2. ~~`hooks.json` 파일명 변경 반영~~ ✅ 완료 (settings.json 추가 발견하여 함께 수정)
3. ~~`SKILL.md` find 블록 → hook 피드백 참조로 교체~~ ✅ 완료
4. ~~검증 수행~~ ✅ 전수 통과
5. 다음 세션에서 `/wrap` E2E 테스트
6. gitignore 차단 문제 별도 처리

## 참고: Plan 원문

> 원본: C:/Users/ahnbu/.claude/plans/wiggly-squishing-thimble.md

# wrap 스킬 handoff 경로 오류 수정 (D'' Hook 통합 방식)

## Context

`/wrap` 실행 시 AI가 SKILL.md의 `find` 명령을 무시하고 존재하지 않는 경로를 추측하여 실패.
```
pwsh -Command "& 'C:/Users/ahnbu/.claude/skills/wrap/scripts/next-handoff.ps1'"
→ not recognized
```

### 근본 원인
- SKILL.md는 AI에게 텍스트로 전달 → `${CLAUDE_PLUGIN_ROOT}` 미확장
- `find` 기반 탐색을 AI가 무시하고 경로 직접 조합
- Plugin 미설치 운용 모드에서 SKILL.md 내부에서 확정 경로를 지정할 방법 없음

### 의사결정 과정
- A(인라인 git-only): 비-git 미지원 → 탈락
- B(인라인 full): 가능하나 SKILL.md에 ~25줄 bash 삽입 → 가독성 저하
- C(스크립트+확정경로): `${CLAUDE_PLUGIN_ROOT}` SKILL.md에서 미확장 → 불가
- D(Hook 별도): 매 프롬프트 추가 프로세스 → 비효율
- **D''(Hook 통합)**: capture-session-id.js에 3줄 추가. 추가 프로세스 없음, 스크립트 분리 유지 ✅

## 수정 계획

### 1. capture-session-id.js → prompt-context.js 리네임 + 수정

**파일**: `my-session-wrap/hooks/capture-session-id.js` → `my-session-wrap/hooks/prompt-context.js`

역할: 프롬프트 제출 시 컨텍스트 정보(세션 ID, wrap 스크립트 경로 등)를 AI에게 제공

hooks.json 연동 수정:
```json
"command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/prompt-context.js\""
```

Before:
```javascript
process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id } = data;
    if (!session_id) return;
    console.log(`[session_id=${session_id}]`);
  } catch (_) {}
});
```

After:
```javascript
process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id, prompt } = data;
    if (session_id) console.log(`[session_id=${session_id}]`);
    if (prompt && /^\/wrap\b/.test(prompt.trim())) {
      const scriptPath = require('path').join(__dirname, '..', 'skills', 'my-session-wrap', 'scripts', 'next-handoff.sh');
      console.log(`[handoff_script=${scriptPath}]`);
    }
  } catch (_) {}
});
```

변경점:
- `session_id` 없어도 즉시 return하지 않음 → `prompt` 체크 가능하도록
- `/wrap`으로 시작하는 프롬프트 감지 시 `next-handoff.sh` 절대경로 출력
- `__dirname` 기준 상대경로 → 레포 위치 무관

### 2. SKILL.md 수정

**파일**: `my-session-wrap/skills/my-session-wrap/SKILL.md` (`:159-171`)

Before:
```
아래 순서로 스크립트를 실행하여 경로를 결정한다:

\`\`\`bash
# bash 우선 (Claude/Gemini 환경)
SCRIPT=$(find "$HOME/.claude" -path "*/my-session-wrap/scripts/next-handoff.sh" -print -quit 2>/dev/null)
if [ -n "$SCRIPT" ]; then
  bash "$SCRIPT" "" "<요약>"
else
  # pwsh 폴백 (Codex 환경)
  SCRIPT=$(find "$HOME/.claude" -path "*/my-session-wrap/scripts/next-handoff.ps1" -print -quit 2>/dev/null)
  pwsh -File "$SCRIPT" -Summary "<요약>"
fi
\`\`\`
```

After:
```
이 대화의 hook 피드백에서 `[handoff_script=...]`를 찾아 해당 경로를 사용한다.

\`\`\`bash
bash "<handoff_script 경로>" "" "<요약>"
\`\`\`

- `<handoff_script 경로>`: hook 피드백의 `[handoff_script=...]`에서 추출한 절대경로
- `<요약>`: 세션 작업 내용 3-4단어 요약
- hook 피드백에 `handoff_script`가 없으면: `find "$HOME/.claude" -path "*/my-session-wrap/scripts/next-handoff.sh" -print -quit` 로 폴백
```

### 3. next-handoff.ps1 삭제 (선택)

bash 통일 후 ps1은 불필요. 단, Codex 환경에서 bash 미지원 시 필요할 수 있으므로 현재는 유지.

## 수정 대상 파일

1. `my-session-wrap/hooks/capture-session-id.js` → `prompt-context.js` 리네임 + 로직 추가
2. `my-session-wrap/hooks/hooks.json` — 파일명 변경 반영
3. `my-session-wrap/skills/my-session-wrap/SKILL.md` (`:159-171`) — find 블록을 hook 피드백 참조로 교체

## 검증

1. `/wrap` 입력 시 hook 피드백에 `[handoff_script=...]`가 포함되는지 확인
2. AI가 해당 경로로 스크립트를 실행하여 handoff 파일 경로를 정상 수신하는지 확인
3. `/wrap` 외 일반 프롬프트에서 `handoff_script` 미출력 확인
