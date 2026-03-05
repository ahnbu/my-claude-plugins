# Task Plan: Phase 5 — Hook stdout → 시스템 메시지 방식

**목표**: 멀티세션에서 세션 ID를 100% 정확하게 획득하기 위해, UserPromptSubmit hook의 stdout이 해당 세션의 AI 컨텍스트에만 주입된다는 메커니즘을 활용

**기반 문서**: `20260305_세션ID멀티세션충돌_대책_계획.md` — Phase 5 섹션

---

## 변경 대상

| 파일 | 변경 내용 | 상태 |
|------|-----------|------|
| `hooks/hooks.json` | UserPromptSubmit 이벤트 + capture-session-id hook 추가 | pending |
| `hooks/capture-session-id.js` | hook_event_name 분기: UPS→console.log, SS→파일 기록 | pending |
| `skills/my-session-wrap/SKILL.md` | 2-1절: system-reminder `[session_id=...]` 탐색 우선 | pending |
| `.claude-plugin/plugin.json` | 2.7.3 → 2.8.0 | pending |
| `.claude-plugin/marketplace.json` | 버전 동기화 | pending |
| `CHANGELOG.md` | 변경사항 기록 | pending |

---

## 핵심 원리

- Hook stdout(console.log) → 해당 세션의 AI 컨텍스트에 system-reminder로 주입
- SessionStart: context 압축 시 유실 가능 → UserPromptSubmit 선택 (매 프롬프트 직전 발동)
- `/wrap` 실행 시 system-reminder에 `[session_id=XXX]` 패턴이 반드시 존재

## 세션 ID 획득 우선순위 (새 SKILL.md)

1. system-reminder에서 `[session_id=...]` 패턴 탐색 (멀티세션 안전 ✅)
2. `.claude/.current-session-id` 파일 fallback (단일세션)

---

## 진행 단계

- [ ] Phase A: hooks.json 수정
- [ ] Phase B: capture-session-id.js 수정
- [ ] Phase C: SKILL.md 2-1절 수정
- [ ] Phase D: plugin.json + marketplace.json 버전 bump
- [ ] Phase E: CHANGELOG 업데이트 + 커밋
