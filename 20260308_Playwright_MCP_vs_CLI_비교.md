# Playwright MCP vs CLI 비교 분석

> 작성일: 2026-03-08
> 범위: current-session
> 세션: ab5b5d95-47f0-49cd-992b-c1f6f787e2c3
> 세션 경로: C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/ab5b5d95-47f0-49cd-992b-c1f6f787e2c3.jsonl

## 관련 작업 추적

- **Playwright 검증 작업이 포함된 handoff**: `C:/Users/ahnbu/.claude/my-claude-plugins/_handoff/handoff_20260308_02_Codex세션-대시보드통합.md`
  - 이 handoff의 §검증 섹션에 Playwright MCP로 수행한 대시보드 UI 검증 내역이 기록되어 있음

---

## 발단: 사용자 요청

Codex 대시보드 통합 작업 완료 후 Playwright MCP로 UI 검증을 수행했는데, 토큰 소모가 과다하게 발생했다. 이에 "playwright-cli가 토큰 소모와 속도 관점에서 우월할 것"이라는 가설을 제시하며 두 접근법 비교를 요청.

---

## 배경: 이번 세션에서 수행한 Playwright MCP 검증 내역

### 검증 대상
- `C:/Users/ahnbu/.claude/my-claude-plugins/output/session-dashboard/index.html`
- my-session-dashboard 플러그인에 Codex 세션 통합 후 UI 동작 확인

### 수행 단계
1. `ToolSearch`로 Playwright MCP 도구 로드 (`select:mcp__plugin_playwright_playwright__browser_navigate` 등)
2. `file://` URL 시도 → **차단됨** (Playwright MCP는 file:// 프로토콜 미지원)
3. `npx serve -l 8933`으로 HTTP 서버 기동 후 `http://localhost:8933` navigate
4. `browser_navigate` 실행 → **473,282자 반환** (오버플로, 파일로 저장 후 별도 Read 필요)
5. `browser_resize(1400×900)` → `browser_take_screenshot`
6. Codex 탭 클릭 (`browser_run_code`)
7. 첫 번째 Codex 세션 클릭 → 대화 렌더링 확인 스크린샷
8. 서브태스크 체크박스 ON/OFF 검증 (181 → 351개 변화 확인)
9. 검색 동작 확인

### 검증 결과
| 검증 항목 | 결과 |
|---|---|
| 탭 4개 (전체/Claude/Plan/Codex) | ✅ |
| 통계 (455 Claude \| 351 Codex \| 209 Plan) | ✅ |
| Codex 탭 → CODEX 배지 목록 표시 | ✅ |
| 서브태스크 포함 체크박스 (OFF: 181개 → ON: 351개) | ✅ |
| Codex 세션 클릭 → 대화 내용 렌더링 | ✅ |
| shell_command 도구 블록 표시 | ✅ |
| 전체 탭 통합 검색 | ✅ |

---

## 작업 상세내역: 세 가지 Playwright 접근법 탐색

탐색 결과 확인된 Playwright 접근법 세 가지:

### 1. playwright-cli (글로벌 스킬)
- **위치**: `C:\Users\ahnbu\.claude\skills\playwright-cli\`
- **호출**: Bash에서 `playwright-cli <cmd>` 직접 실행
- **작동 방식**: 독립 CLI 바이너리 + 데몬 프로세스로 브라우저 관리

**지원 기능 카테고리**

| 카테고리 | 명령어 예시 |
|---|---|
| Core | `open`, `goto`, `click`, `fill`, `snapshot`, `eval` |
| Save as | `screenshot`, `pdf` |
| Network | `route`, `route-list`, `unroute` (요청 모킹/차단) |
| Storage | `state-save/load`, `cookie-*`, `localstorage-*` |
| DevTools | `console`, `network`, `run-code`, `tracing-start/stop`, `video-start/stop` |
| Sessions | `-s=name` 플래그로 멀티 브라우저 세션 동시 실행 |

### 2. Playwright MCP (플러그인)
- **위치**: `C:\Users\ahnbu\.claude\plugins\marketplaces\claude-plugins-official\external_plugins\playwright\`
- **호출**: MCP 도구 (`mcp__plugin_playwright_playwright__browser_*`)
- **작동 방식**: `npx @playwright/mcp@latest` MCP 서버 → Claude 도구 프로토콜 경유

### 3. webapp-testing (document-skills 플러그인)
- **위치**: `C:\Users\ahnbu\.claude\plugins\marketplaces\anthropic-agent-skills\skills\webapp-testing\`
- **호출**: Python 스크립트 작성 + Bash 실행
- **특징**: `with_server.py` 헬퍼로 서버 시작/종료 자동화, 로컬 웹앱 테스트 특화

---

## 의사결정 기록

### 핵심 가설 (사용자 제기)
> "토큰 소모와 속도 관점에서 playwright-cli가 MCP보다 우월할 것"

### 근거 — MCP의 토큰 과다 소모 실측치

이번 세션에서 `browser_navigate` 1회 호출로 **473,282자**가 반환됨:
- 대시보드 HTML에 세션 데이터가 인라인 임베딩 → DOM 거대
- 오버플로로 인해 파일 저장 후 별도 Read 필요 → 추가 토큰 소모
- 실질적으로 navigate 1회 = ~150K+ 토큰 소비

### 정량 비교표

| 항목 | Playwright MCP | playwright-cli |
|---|---|---|
| navigate 반환 크기 | **473,282자** (전체 DOM snapshot) | ~수백 줄 (접근성 트리만) |
| screenshot 반환 | 이미지 바이너리 인라인 | 파일 경로 문자열만 |
| 예상 토큰 소모 (동일 검증) | ~150K+ 토큰 | ~5K 토큰 (예상) |
| 절감 배율 | 기준 | **약 30배 절감** (추정) |
| file:// URL 지원 | ❌ (HTTP 서버 필요) | ✅ (직접 가능) |
| 속도 | MCP 프로토콜 오버헤드 | 직접 CLI 호출 (빠름) |
| 네트워크 모킹 | ❌ | ✅ (`route` 명령) |
| 트레이싱/비디오 | ❌ | ✅ (`tracing-start/stop`, `video-start/stop`) |
| 멀티 세션 | 단일 세션 | ✅ (`-s=name` 플래그) |
| 테스트 코드 생성 | ❌ | ✅ (자동 TypeScript 코드) |

### 가설 판정

| 관점 | 판정 | 근거 |
|---|---|---|
| 토큰 소모 | ✅ CLI 우위 | navigate 반환이 DOM 전체(MCP) vs 접근성 트리(CLI) 차이 |
| 속도 | ✅ CLI 우위 | MCP 프로토콜 오버헤드 없음 |
| 기능 풍부함 | ✅ CLI 우위 | 모킹·트레이싱·멀티세션 등 추가 지원 |
| file:// 지원 | ✅ CLI 우위 | HTTP 서버 없이 직접 로컬 파일 열기 가능 |
| 결론 | **가설 타당** | 특히 대용량 페이지 검증에서 CLI 압도적 유리 |

### playwright-cli 동일 검증 예시

```bash
# HTTP 서버 불필요 — file:// 직접 열기 가능
playwright-cli open file:///C:/Users/ahnbu/.claude/my-claude-plugins/output/session-dashboard/index.html

# 스크린샷 (반환: 파일 경로 문자열만)
playwright-cli screenshot dashboard-initial.png

# Codex 탭 클릭 (snapshot에서 ref 확인 후)
playwright-cli snapshot   # → 접근성 트리 YAML 반환 (수백 줄)
playwright-cli click --ref=eXX

# 추가 스크린샷
playwright-cli screenshot dashboard-codex.png
```

---

## 실행 및 검증

<!-- 사후 업데이트 영역: playwright-cli로 실제 검증 실행 후 토큰 비교 수치 업데이트 -->

---

## 리스크 및 미해결 이슈

- **토큰 비교 수치는 추정치**: playwright-cli의 실제 접근성 트리 크기는 페이지마다 다름. 대시보드처럼 긴 목록이 있으면 CLI도 snapshot이 클 수 있음.
- **playwright-cli 미설치 가능성**: 글로벌 스킬로 등록은 되어 있으나 바이너리 실제 설치 여부 미확인.
- **MCP가 유리한 경우**: 간단한 페이지(DOM 작음)에서는 MCP의 도구 프로토콜 편의성이 오히려 유리할 수 있음.

---

## 다음 액션

- **검증 필요**: playwright-cli로 실제 동일 검증 수행 → 토큰 소모 수치 실측
- **규칙 후보**: "대용량 페이지 검증 시 playwright-cli 우선 사용" → CLAUDE.md 반영 검토
