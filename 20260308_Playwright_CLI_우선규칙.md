# Plan: Playwright CLI 우선 사용 규칙 추가

> 저장일: 2026-03-08 | 원본: C:/Users/ahnbu/.claude/plans/fancy-exploring-noodle.md

## 발단: 사용자 요청

> "playwright cli를 기본으로 쓰고 싶다. 그런데, 내가 프롬프트에 playwright를 써서 검증해달라고 했더니, playwright mcp를 먼저 호출했다. 그 덕에 체감상 토큰이 녹아내린 것 같다. (정말 그런지는 팩트 체크 필요)"

---

## Context

사용자가 "playwright로 검증해달라"고 요청했을 때, Claude가 Playwright MCP(`mcp__plugin_playwright_playwright__browser_*`)를 먼저 호출하는 문제 발생. MCP의 `browser_navigate` 1회 호출이 473,282자(~150K+ 토큰)를 반환하여 토큰 과다 소모. playwright-cli는 접근성 트리(수백 줄)만 반환하여 약 30배 절감 추정.

### 토큰 소모 팩트 체크

| 항목 | Playwright MCP | playwright-cli |
|------|---------------|----------------|
| navigate 반환 | 473,282자 (전체 DOM) | 접근성 트리 YAML (수백 줄) |
| screenshot 반환 | 이미지 바이너리 인라인 | 파일 경로 문자열만 |
| 실측 근거 | 이전 세션에서 확인 | 추정치 (구조적으로 확실히 작음) |

**결론**: MCP가 토큰을 훨씬 더 소모하는 것은 구조적 사실. 정확한 배수는 페이지마다 다르지만, CLI가 우위인 것은 확실.

---

## 변경 내용

### 1. 글로벌 CLAUDE.md에 규칙 추가

**파일**: `C:\Users\ahnbu\.claude\CLAUDE.md`
**위치**: `## 도구` 섹션, 기존 Playwright 관련 규칙 근처 (99행 부근)

**추가할 규칙**:
```
- Playwright 브라우저 자동화 시: `playwright-cli` 스킬 우선. MCP(`mcp__plugin_playwright_playwright__*`)는 CLI 사용 불가 시에만 대체. 이유: MCP navigate가 전체 DOM(수십만 자)을 반환하여 토큰 과다 소모, CLI는 접근성 트리만 반환.
```

기존 두 줄(SNS User-Agent, GitHub 조회 우선순위)은 유지.

## 변경하지 않는 것

- Playwright MCP 플러그인 삭제/비활성화: MCP가 필요한 경우도 있으므로 유지
- playwright-cli 스킬 수정: 현재 description/트리거 충분
- 프로젝트 CLAUDE.md: 글로벌 규칙이므로 프로젝트 CLAUDE.md에 넣지 않음

---

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| CLAUDE.md 규칙 추가 확인 | Read로 해당 줄 확인 | ⏳ 미실행 | 99행 부근 |
| 다음 세션에서 CLI 우선 트리거 | "playwright로 검증해줘" 요청 후 동작 확인 | ⏳ 미실행 | 행동 변화 확인 |

---

## 보충: 비교 검토

### Playwright MCP vs playwright-cli 비교

| 항목 | Playwright MCP | playwright-cli |
|------|---------------|----------------|
| 토큰 효율 | ❌ navigate 1회 = ~150K+ 토큰 | ✅ 접근성 트리만 반환 (~30배 절감 추정) |
| file:// 지원 | ❌ HTTP 서버 필요 | ✅ 직접 열기 가능 |
| 속도 | MCP 프로토콜 오버헤드 | ✅ 직접 CLI 호출 |
| 기능 | 기본 조작 | ✅ 모킹·트레이싱·멀티세션 추가 지원 |
| 호출 우선권 | ❌ deferred tools로 항상 로드 가능 → 먼저 선택됨 | 스킬 description 매칭 시 로드 |

### 원인 분석

- Playwright MCP: deferred tools 목록에 상시 존재 → ToolSearch 한 번이면 즉시 접근
- playwright-cli: 글로벌 스킬이지만, 기존 CLAUDE.md에 "CLI 우선" 명시 규칙 없음
- → Claude가 "MCP가 더 편리하다"고 판단하여 먼저 호출
