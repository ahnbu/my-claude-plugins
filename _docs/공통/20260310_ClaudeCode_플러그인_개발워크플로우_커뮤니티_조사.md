# Claude Code Plugin 개발 워크플로우 커뮤니티 조사

> 조사일: 2026-03-10

---

## Executive Summary

Claude Code plugin 개발 생태계에서 **가장 큰 페인 포인트는 캐시 무효화 실패**다. 소스 파일을 수정해도 캐시된 구버전이 계속 서빙되어, 개발자가 수동으로 캐시를 삭제하거나 버전을 범프해야 한다. 이 문제는 2025년 8월부터 2026년 2월까지 최소 6건의 GitHub 이슈로 반복 보고되었으나 미해결 상태다. 커뮤니티가 채택한 주요 워크어라운드는 (1) 캐시 삭제 스크립트, (2) symlink로 캐시를 라이브 소스에 연결, (3) `--plugin-dir` 플래그로 캐시 우회 개발이다.

---

## 1. 로컬 개발 vs 설치 모드 (이중 경로 문제)

### 공식 지원 방식

| 방식 | 명령 | 캐시 사용 | 즉시 반영 |
|------|------|-----------|-----------|
| `--plugin-dir` | `claude --plugin-dir ./my-plugin` | X | O |
| 로컬 마켓플레이스 | `/plugin marketplace add ./local-mp` → 설치 | O | X |
| GitHub 마켓플레이스 | `claude plugin marketplace update` → 설치 | O | X |

- `--plugin-dir`은 캐시를 우회하므로 개발 중 즉시 반영되지만, 매번 플래그를 붙여야 하고 세션 재시작이 필요
- 마켓플레이스 경로는 설치 후 `~/.claude/plugins/cache/`에 복사본을 만들며, 이후 소스 변경이 반영되지 않음

### 커뮤니티 워크어라운드

**워크어라운드 1: 캐시 수동 삭제 (가장 보편적)**
```bash
rm -rf ~/.claude/plugins/cache/local-plugins/my-plugin
# 세션 재시작
```

**워크어라운드 2: symlink로 캐시 → 라이브 소스 연결 (플러그인 개발자용)**
```bash
# 캐시 삭제 후 symlink 생성
rm -rf ~/.claude/plugins/cache/my-marketplace/
mkdir -p ~/.claude/plugins/cache/my-marketplace
for plugin in plugin-a plugin-b; do
  mkdir -p ~/.claude/plugins/cache/my-marketplace/$plugin
  ln -sfn ~/.claude/plugins/marketplaces/my-marketplace/plugins/$plugin \
    ~/.claude/plugins/cache/my-marketplace/$plugin/1.0.0
done
```
출처: [#17361](https://github.com/anthropics/claude-code/issues/17361)

**워크어라운드 3: 버전 범프**
- `plugin.json`의 `version`을 변경하면 캐시가 새 버전으로 인식하여 재생성
- 개발 중 빈번한 범프가 필요하여 비실용적이라는 의견 다수

### 핵심 이슈

- [#17361](https://github.com/anthropics/claude-code/issues/17361) - Plugin cache never refreshes (Open, 2026-01-10)
- [#28492](https://github.com/anthropics/claude-code/issues/28492) - Local plugin cache not invalidated when source files change
- [#14061](https://github.com/anthropics/claude-code/issues/14061) - /plugin update does not invalidate plugin cache
- [#15642](https://github.com/anthropics/claude-code/issues/15642) - CLAUDE_PLUGIN_ROOT points to stale version after plugin update
- [#29074](https://github.com/anthropics/claude-code/issues/29074) - Plugin cache not cleared on uninstall/reinstall
- [#13799](https://github.com/anthropics/claude-code/issues/13799) - Plugin cache not invalidated when marketplace is updated

> "A local plugin's cache should be invalidated when the source files change — checking file modification timestamps would be sufficient. Caching by version alone makes sense for published/marketplace plugins, but for local development it creates a confusing experience." — [DEV Community 블로그](https://dev.to/wkusnierczyk/claude-code-plugin-cache-1dn)

---

## 2. Skills, Hooks, Commands 간 상호참조 복잡성

### 아키텍처 계층 정리

| 구성요소 | 성격 | 트리거 | 토큰 비용 |
|----------|------|--------|-----------|
| Skills | 지식·가이드 | AI 자율 판단 또는 `/slash` | ~100 (메타) → <5k (본문) |
| Commands | 명시적 호출 | `/slash` 전용 | 전체 로드 |
| Hooks | 결정론적 자동화 | 이벤트 (PreToolUse, SessionStart 등) | 0 (코드 실행) |
| Agents | 독립 워크플로우 | `/agent` 호출 | 에이전트별 컨텍스트 |

### 커뮤니티가 보고한 복잡성

1. **이름 충돌**: Skill과 Command가 같은 이름이면 Skill이 우선. 의도치 않은 shadowing 발생 가능
2. **중복 등록**: 플러그인 설치 시 `~/.claude/skills/`에 symlink가 자동 생성되어 같은 스킬이 2번 표시됨 ([#23819](https://github.com/anthropics/claude-code/issues/23819))
3. **스킬 인플레이션**: 캐시 복사본으로 인해 시스템 프롬프트에 같은 스킬이 N배 로딩 ([#14549](https://github.com/anthropics/claude-code/issues/14549))
4. **자기 참조 제약**: 설치된 플러그인은 자기 디렉토리 외부 파일 참조 불가 (`../shared-utils` 등 경로 순회 차단)

### 베스트 프랙티스 (커뮤니티 합의)

- SKILL.md는 2,000 단어 이내로 유지. 상세 내용은 `references/` 하위로 분리
- Hooks는 "반드시 매번 실행해야 하는 것"에만 사용. 선택적 로직은 Skill로
- MCP 토큰 20k 초과 시 Claude 효율 급감 → 스킬·MCP 합산 토큰 관리 필요
- 플러그인 내 모든 리소스를 자기 완결적(self-contained)으로 구성

---

## 3. "Dev Mode" vs "Installed Mode" 워크플로우

### 현재 상태: 공식 Dev Mode 없음

커뮤니티에서 반복 요청되었으나 공식 구현은 없음:

- [#18174](https://github.com/anthropics/claude-code/issues/18174) - Support hot-reload for plugins without session restart
- [#6497](https://github.com/anthropics/claude-code/issues/6497) - Hot reload of agents and slash commands
- [#15858](https://github.com/anthropics/claude-code/issues/15858) - RFC: Config Hot-Reload for CLAUDE.md and Settings

### 현재 가능한 Hot-Reload 범위

| 대상 | Hot-Reload | 비고 |
|------|------------|------|
| Skills (`.claude/skills/`) | O | 파일 변경 감지 자동 반영 |
| CLAUDE.md | X | 세션 재시작 필요 |
| Commands | X | 세션 재시작 필요 |
| Hooks | X (부분) | 설치/활성화 시 즉시 적용, 소스 변경은 재시작 필요 |
| MCP Servers | 별도 도구 필요 | [claude-code-mcp-reload](https://github.com/data-goblin/claude-code-mcp-reload) |
| Plugin 전체 | X | 세션 재시작 필수 |

### 커뮤니티 개발 워크플로우 패턴

**패턴 A: `--plugin-dir` 반복 (가장 단순)**
```
1. 소스 수정
2. Claude 세션 종료
3. claude --plugin-dir ./my-plugin 로 재시작
4. 테스트
5. 반복
```

**패턴 B: 로컬 마켓플레이스 + 캐시 삭제 스크립트**
```
1. 소스 수정
2. rm -rf ~/.claude/plugins/cache/my-marketplace/my-plugin
3. Claude 세션 재시작
4. 테스트
5. 반복
```

**패턴 C: symlink 기반 라이브 개발 (가장 진보적)**
```
1. 캐시 디렉토리를 소스 디렉토리에 symlink
2. 소스 수정 → 즉시 반영 (세션 재시작만 필요)
3. 버전 범프 불필요
```

---

## 4. Symlink 관련 이슈와 사례

### 알려진 Symlink 문제점

| 이슈 | 상태 | 내용 |
|------|------|------|
| [#5433](https://github.com/anthropics/claude-code/issues/5433) | Closed (dup) | symlink 경로의 Hook 실행 실패 — 무한 대기 또는 무음 실패 |
| [#10573](https://github.com/anthropics/claude-code/issues/10573) | - | v2.0.28에서 symlink 슬래시 커맨드 지원 중단 |
| [#25367](https://github.com/anthropics/claude-code/issues/25367) | - | symlink된 `~/.claude/skills/` 디렉토리의 스킬 유효성 검사 실패 (실행은 성공) |
| [#764](https://github.com/anthropics/claude-code/issues/764) | - | symlink 디렉토리 탐색 실패 |
| [#23819](https://github.com/anthropics/claude-code/issues/23819) | Closed | 플러그인 설치 시 skills/에 symlink 생성 → 중복 표시 |

### Symlink 사용 시 주의사항

1. **Hook 경로**: symlink 경로 대신 절대 경로 직접 사용 권장 (`~/.claude/hooks/pre_tool_use.py` X → `/Users/user/projects/my-hooks/pre_tool_use.py` O)
2. **배포 시 불가**: GitHub에서 설치하는 사용자는 로컬 symlink 구조를 공유하지 않음. 배포용 플러그인은 자기 완결적이어야 함
3. **스킬 discovery**: symlink 해석이 discovery 단계에서 실패하고 execution 단계에서는 성공하는 비일관성 존재
4. **Windows**: NTFS junction/symlink는 관리자 권한 필요 또는 Developer Mode 필요

---

## 5. Plugin Architecture 한계에 대한 커뮤니티 피드백

### 주요 한계점

1. **캐시 무효화 부재** — 가장 많이 보고된 문제. 로컬 개발 시 파일 변경이 반영되지 않음
2. **Hot-Reload 미지원** — 플러그인 변경 시 전체 세션 재시작 필수
3. **경로 해석 버그** — `marketplace.json` 파일 경로를 디렉토리 경로로 사용하는 버그 ([#11278](https://github.com/anthropics/claude-code/issues/11278), Closed/Fixed)
4. **자기 완결성 강제** — `../` 경로 순회 차단으로 플러그인 간 코드 공유 불가
5. **스킬 중복 로딩** — 같은 스킬이 여러 경로에서 발견되면 중복 로딩하여 컨텍스트 낭비
6. **캐시 무한 성장** — 버전 범프마다 이전 캐시가 남아 디스크 공간 소모 ([#16453](https://github.com/anthropics/claude-code/issues/16453))
7. **autoUpdate 불완전** — `autoUpdate: true`가 git pull만 수행하고 캐시 갱신은 하지 않음

### 커뮤니티 제안 (미구현)

- 로컬 마켓플레이스는 캐시 없이 직접 읽기
- 파일 타임스탬프 기반 캐시 무효화
- `/plugin refresh` 명령 추가
- "dev mode" 플래그로 캐시 전면 우회
- 플러그인 간 shared dependency 매커니즘

---

## 6. 우리 프로젝트(my-claude-plugins)와의 관련성

### 현재 우리가 겪는 문제와의 매핑

| 커뮤니티 이슈 | 우리 프로젝트 상황 |
|---|---|
| 캐시 무효화 실패 | `marketplace update` + `plugin update` 2단계 필요. post-commit hook으로 자동화 중 |
| 소스 vs 설치 경로 이중성 | 소스 레포 DB vs 마켓플레이스 DB 분리 원칙으로 관리. `__dirname` 상대경로 사용 |
| self-contained 제약 | `ensure-commands.js`로 커맨드 복사하여 우회 |
| symlink 불안정성 | Windows 환경이라 symlink 대신 복사 방식 채택 (현명한 선택) |
| Hot-reload 부재 | 세션 재시작 기반 워크플로우 유지 |

### 개선 기회

1. **캐시 삭제 자동화**: post-commit hook에 캐시 삭제 단계 추가 고려
2. **`--plugin-dir` 활용**: 개발 중에는 `claude --plugin-dir ./my-session-dashboard` 등으로 캐시 우회
3. **refresh-plugin-cache 스킬**: LobeHub에 [refresh-plugin-cache](https://lobehub.com/skills/l3digital-net-claude-code-plugins-refresh-plugin-cache) 스킬 존재 — 참고 가능

---

## Sources

### GitHub Issues (anthropics/claude-code)
- [#17361 - Plugin cache never refreshes](https://github.com/anthropics/claude-code/issues/17361)
- [#28492 - Local plugin cache not invalidated](https://github.com/anthropics/claude-code/issues/28492)
- [#14061 - /plugin update does not invalidate cache](https://github.com/anthropics/claude-code/issues/14061)
- [#23819 - Symlinks causing duplicate slash commands](https://github.com/anthropics/claude-code/issues/23819)
- [#5433 - Symlink hook execution failure](https://github.com/anthropics/claude-code/issues/5433)
- [#25367 - Symlinked skills validation failure](https://github.com/anthropics/claude-code/issues/25367)
- [#11278 - Plugin path resolution bug](https://github.com/anthropics/claude-code/issues/11278)
- [#18174 - Plugin hot-reload request](https://github.com/anthropics/claude-code/issues/18174)
- [#6497 - Hot reload of agents and commands](https://github.com/anthropics/claude-code/issues/6497)
- [#15858 - Config hot-reload RFC](https://github.com/anthropics/claude-code/issues/15858)
- [#16453 - Plugin cache grows indefinitely](https://github.com/anthropics/claude-code/issues/16453)
- [#29074 - Cache not cleared on uninstall/reinstall](https://github.com/anthropics/claude-code/issues/29074)
- [#10573 - Symlink command support broken](https://github.com/anthropics/claude-code/issues/10573)

### 공식 문서
- [Create plugins - Claude Code Docs](https://code.claude.com/docs/en/plugins)
- [Plugins reference - Claude Code Docs](https://code.claude.com/docs/en/plugins-reference)
- [Discover plugins - Claude Code Docs](https://code.claude.com/docs/en/discover-plugins)
- [Skills - Claude Code Docs](https://code.claude.com/docs/en/skills)
- [claude-code/plugins/README.md](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)
- [plugin-dev toolkit](https://github.com/anthropics/claude-code/tree/main/plugins/plugin-dev)

### 블로그/튜토리얼
- [Creating Local Claude Code Plugins](https://somethinghitme.com/2026/01/31/creating-local-claude-code-plugins/) — 로컬 마켓플레이스 설정 실전 가이드
- [Claude Code Plugin Cache (DEV Community)](https://dev.to/wkusnierczyk/claude-code-plugin-cache-1dn) — 캐시 문제 진단·해결
- [How to Build Claude Code Plugins (DataCamp)](https://www.datacamp.com/tutorial/how-to-build-claude-code-plugins) — 단계별 가이드
- [Understanding Claude Code's Full Stack (alexop.dev)](https://alexop.dev/posts/understanding-claude-code-full-stack/) — Skills, Hooks, MCP 아키텍처 해설
- [A Mental Model for Claude Code (Level Up Coding)](https://levelup.gitconnected.com/a-mental-model-for-claude-code-skills-subagents-and-plugins-3dea9924bf05) — Skills, Subagents, Plugins 관계 정리

### 커뮤니티 리소스
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — 스킬, 훅, 커맨드, 플러그인 큐레이션
- [awesome-claude-code-plugins](https://github.com/ccplugins/awesome-claude-code-plugins) — 플러그인 전용 큐레이션
- [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — Anthropic 공식 플러그인 디렉토리
- [refresh-plugin-cache (LobeHub)](https://lobehub.com/skills/l3digital-net-claude-code-plugins-refresh-plugin-cache) — 캐시 새로고침 스킬
