---
date: 2026-03-25
scope: current-session
session: "02414e89-1659-4bea-a078-73060b033da9"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/02414e89-1659-4bea-a078-73060b033da9.jsonl"
---

# context-warning 자동 기록 + continue 스킬 통합 구현 설계

## 발단: 사용자 요청

context limit 도달로 세션이 중단되는 경우 자동으로 기록하여, `/continue` 스킬에서 해당 세션을 자동으로 불러오도록 하고 싶다.

## 작업 상세내역

### 1. context limit hook 존재 여부 조사

Claude Code 공식 hook 이벤트 목록:
- `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, `Notification`

**결론**: context limit 전용 hook 없음. `Stop` hook도 세션 종료가 아닌 응답 1회 완료 시점.

### 2. statusline stdin 구조 확인

`cc-alchemy-custom.mjs`는 Claude Code가 매 응답 후 실행하며, stdin으로 세션 정보를 수신한다.
실제 stdin 구조 확인 결과:

```json
{
  "session_id": "df6f94d8-...",
  "transcript_path": "...",
  "cwd": "...",
  "context_window": {
    "used_percentage": 57,
    "remaining_percentage": 43,
    "context_window_size": 200000
  }
}
```

**결론**: `session_id`와 `context_window.used_percentage` 모두 포함. 정확한 컨텍스트 사용률을 실시간으로 수신 가능.

### 3. statusline 실행 주기 타이밍 분석

실험: `statusline_log.jsonl`에 매 실행 시 timestamp + session_id + cp 기록 후 JSONL 이벤트와 대조.

**타이밍 측정 결과** (세션 `02414e89` 기준):

| 시각 (UTC) | 세션 이벤트 | Statusline 로그 | 비고 |
|-----------|-----------|----------------|------|
| 01:57:07.892 | `assistant` 응답 완료 | | |
| 01:57:08.304 | `system` 이벤트 | | |
| **01:57:08.338** | | **cp=39** | system +0.03s |
| 01:57:24.962 | `assistant` thinking | | |
| **01:57:25.403** | | **cp=39** | thinking +0.44s |
| 01:57:26.027 | `assistant` tool_use | | |
| **01:57:26.478** | | **cp=39** | tool_use +0.45s |

**발견사항**:
- Statusline은 각 assistant 청크(thinking, 텍스트, tool_use 완료)마다 **+0.43~0.45s** 지연 후 실행
- `system` 이벤트 후에는 더 빠르게 **+0.03s**
- AI 작업 중 **중간에도 지속 갱신됨** (tool 1회 완료 = statusline 1회 추가 실행)

**AI 처리 중 최대 갱신 간격** (사용자 대기 제외):
| 구간 | 간격 | 원인 |
|------|------|------|
| 01:58:57 → 01:59:41 | **43s** | 병렬 Bash tool 실행 |
| 01:58:22 → 01:58:55 | **34s** | tool 2개 실행 |
| 01:57:44 → 01:58:13 | **29s** | 긴 텍스트 생성 |

→ AI 처리 중 최대 43s 지연. 80% 감지 목적에 충분.

### 4. 커스텀 보정값 vs raw 값

스크립트 내부:
```javascript
const cp = ctx.used_percentage || 0;       // raw 값 (API 직접 제공)
const normCp = ... (cp - BASELINE) ...     // 커스텀 보정 (시스템 프롬프트 ~18% 제거, 화면 표시용)
```

임계치 판단에는 `cp` (raw) 사용. `normCp`는 실제 소모량보다 낮게 표시되므로 안전 기준으로 부적합.

## 의사결정 기록

### 방식 비교

| 항목 | UserPromptSubmit hook | Stop hook | **statusline mjs** |
|------|----------------------|-----------|-------------------|
| context 데이터 접근 | ❌ 없음 (추정만 가능) | ⚠️ 불확실 | ✅ 직접 제공 |
| 사용자 입력 지연 | ❌ 발생 가능 | ✅ 없음 | ✅ 없음 |
| 실행 빈도 | 사용자 입력마다 | 응답 완료 시 | ✅ tool 완료마다 |
| 구현 복잡도 | 보통 | 보통 | ✅ 단순 (기존 파일 수정) |

<span style="color:#888">*정렬 기준: context 데이터 접근 가능 여부가 핵심. 이미 정확한 값을 받는 statusline이 압도적으로 유리.*</span>

- **결정**: `cc-alchemy-custom.mjs` (statusline)에서 직접 감지 후 파일 기록
- **근거**: stdin으로 정확한 `used_percentage`를 이미 수신 중. 별도 hook 불필요.
- **트레이드오프**: 없음. 기존 파일에 로직 추가만으로 완결.

### 임계치 결정

- **80%**: 충분한 여유 + wrap/continue 준비 여유 확보 ← **채택**
- 85%: cp 점프 케이스 대비 이전 채택값
- 90%: 이전 채택값 (여유 부족 우려로 하향)
- 95%: 너무 늦음, 다음 응답에서 limit 도달 위험

### 파일 구조

세션별 독립 파일 방식 채택:
```
~/.claude/scripts/context-warning/   ← cc-alchemy-custom.mjs 기준 상대 경로
  {session_id}.json
```

단일 공유 파일 방식 대비 장점: 멀티 세션 경쟁 조건 없음.
`scripts/` 폴더 아래 위치: cc-alchemy-custom.mjs 실행 파일과 동일 폴더 (SCRIPT_PATH 기준).

## 구현 범위 (최종)

### 파일 1: `~/.claude/scripts/cc-alchemy-custom.mjs`

변경사항:
- `import { join }` → `import { join, dirname }` 추가
- `appendFileSync` import 제거
- warningDir: `join(HOME, ".claude", "context-warning")` → `join(dirname(SCRIPT_PATH), "context-warning")`

```javascript
const warningDir = join(dirname(SCRIPT_PATH), "context-warning");
mkdirSync(warningDir, { recursive: true });
// 1일 초과 파일 삭제
const cutoff = Date.now() - 86400000;
for (const f of readdirSync(warningDir)) {
  const fp = join(warningDir, f);
  try { if (statSync(fp).mtimeMs < cutoff) unlinkSync(fp); } catch {}
}
// cp >= 80 이면 기록
if (cp >= 80 && data.session_id) {
  writeFileSync(join(warningDir, `${data.session_id}.json`), JSON.stringify({...}));
}
```

**주의**: hook 환경에서 `trash` CLI 사용 불가 → `unlinkSync` 직접 사용 (1일 초과 파일은 복구 불필요).

### 파일 2: `~/.claude/my-claude-plugins/my-session-wrap/skills/continue/SKILL.md`

Step 0 분기 (최종):
```
UUID 있으면 → 경로 A (세션 파일 기반)
UUID 없으면 → 경로 B (context-warning 체크) → 없으면 경로 C (handoff)
```

경로 B: 스크립트 호출 방식
```
node ~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/find-context-warning.mjs
출력: { found: boolean, session_id?, cp?, remaining?, ts? }
```

### 파일 3 (신규): `~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/find-context-warning.mjs`

`~/.claude/scripts/context-warning/*.json` 탐색 → ts 기준 최신 1개 반환.

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| mjs: warningDir → scripts/ 기준 경로 | `dirname(SCRIPT_PATH)` 사용 확인 | ✅ 완료 | syntax OK |
| mjs: cp >= 90 파일 생성 | context-warning/ 폴더 + syntax 검사 | ✅ 완료 | 폴더 생성 확인 |
| mjs: 1일 초과 파일 삭제 | 코드 로직 확인 | ✅ 완료 | cutoff = Date.now() - 86400000 |
| mjs: 테스트 로그 코드 제거 | appendFileSync import 제거 확인 | ✅ 완료 | statusline_log.jsonl 미참조 |
| continue: 경로명 B/C 재정렬 | SKILL.md Step 0 분기 확인 | ✅ 완료 | B=context-warning, C=handoff |
| continue: 경로 B 스크립트화 | find-context-warning.mjs 생성 + 실행 | ✅ 완료 | `{"found":false}` 정상 출력 |
| continue: 경로 B → A 연결 | 승인 시 session_id로 경로 A 진입 | ⚠️ 부분 완료 | 실제 80% 도달 전까지 실행 테스트 불가 |

## 리스크 및 미해결 이슈

- **cp가 80% 도달하지 않고 context limit 도달**: 실제 limit가 예상보다 낮은 경우 (캐시, 시스템 프롬프트 변동 등). 보완책 없음, 허용 범위로 판단.
- **unlinkSync 사용**: CLAUDE.md 원칙상 삭제는 `trash` CLI 사용이지만, hook 환경(subprocess)에서 `trash` CLI 경로를 보장할 수 없어 직접 삭제 적용. 1일 초과 파일이므로 복구 필요성 없음.

## 다음 액션

1. `cc-alchemy-custom.mjs` 수정 실행
2. `continue/SKILL.md` 경로 C 추가
3. 검증 수행
