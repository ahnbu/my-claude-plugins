# My Claude Code Plugins

개인용 Claude Code 플러그인 저장소. GitHub에서 관리되며 `/plugin update`로 업데이트.

## 구조

```
my-claude-plugins/
├── CLAUDE.md                     # 개발 가이드 및 git commit 규칙
├── .claude-plugin/
│   └── marketplace.json          # 마켓플레이스 등록 정보
├── my-session-wrap/              # 세션 마무리 워크플로우 (handoff + git commit)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── commands/
│   │   └── wrap.md
│   ├── hooks/
│   │   ├── hooks.json
│   │   ├── ensure-commands.js
│   │   └── capture-session-id.js
│   └── skills/
│       ├── my-session-wrap/
│       │   ├── SKILL.md
│       │   ├── references/template.md
│       │   └── scripts/next-handoff.sh
│       ├── session-analyzer/
│       │   ├── SKILL.md
│       │   ├── references/
│       │   └── scripts/
│       └── history-insight/
│           ├── SKILL.md
│           ├── references/
│           └── scripts/
├── my-cowork/                    # 문서 공동 작성 스킬 (doc-coauthoring 포크)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── commands/
│   │   └── cowork.md
│   ├── hooks/
│   │   ├── hooks.json
│   │   └── ensure-commands.js
│   └── skills/
│       └── cowork/
│           └── SKILL.md
├── my-session-dashboard/         # 세션 대시보드 (JSONL→JSON + 브라우저 뷰어)
│   ├── .claude-plugin/
│   │   └── plugin.json
│   ├── build.js                  # JSONL 전처리 + HTML 생성
│   ├── index.html                # self-contained 대시보드 템플릿
│   ├── commands/
│   │   └── ss.md
│   ├── hooks/
│   │   ├── hooks.json
│   │   └── ensure-commands.js
│   └── skills/
│       └── session-dashboard/
│           └── SKILL.md
└── my-session-id/                # 세션 ID 캡처 및 훅 이벤트별 비교
    ├── .claude-plugin/
    │   └── plugin.json
    ├── hooks/
    │   ├── hooks.json
    │   └── capture-session-id.js
    └── skills/
        └── session-id/
            └── SKILL.md
```

---

## 마켓플레이스 등록

### GitHub 레포로 등록 (권장)

```bash
claude plugin marketplace add ahnbu/my-claude-plugins
```

push 후 `claude plugin update <plugin-name>`으로 갱신 가능.

### 로컬 경로로 등록 (오프라인)

```bash
claude plugin marketplace add "C:/Users/ahnbu/.claude/my-claude-plugins"
```

### 플러그인 설치

```bash
claude plugin install my-session-wrap
claude plugin install my-cowork
claude plugin install my-session-dashboard
claude plugin install my-session-id
```

---

## 플러그인: `my-session-wrap`

세션 마무리 시 실행하는 경량 워크플로우. `/wrap` 커맨드로 실행.

### 목적

1. **컨텍스트 복원** — `_handoff/handoff_YYYYMMDD_NN_한줄요약.md` 저장으로 다음 세션에서 즉시 재개
2. **변경사항 반영** — (git 있을 시) commit으로 작업 이력 기록

### 실행 방법

```
/wrap           # 인터랙티브 세션 마무리 (권장)
/wrap [message] # 빠른 커밋 메시지 지정
```

### 워크플로우

```
Step 1. Git 감지
Step 2. handoff 파일 생성 (세션 ID 획득 → 파일 경로 생성 → 작성)
Step 3. git commit (선택)
```

### 세션 ID 자동 캡처

SessionStart hook(`capture-session-id.js`)이 stdin에서 `session_id`를 읽어 프로젝트의 `.claude/.current-session-id`에 저장한다.
이후 `$CLAUDE_SESSION_ID` 환경변수로 현재 세션 ID에 접근 가능.

- **handoff 문서**: 헤더에 `세션 ID:` 필드로 자동 기입
- **세션 검증**: `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` 조회로 사후 검증 가능
- **동시 세션 안전**: hook stdin에서 직접 받으므로 동시 세션 환경에서도 정확

### 포함된 스킬

| 스킬 | 설명 | 트리거 |
|------|------|--------|
| `my-session-wrap` | 메인 세션 마무리 스킬 | `wrap`, `마무리`, `세션 정리` |
| `session-analyzer` | SKILL.md 명세 대비 세션 사후 검증 | `analyze session`, `세션 분석` |
| `history-insight` | 세션 히스토리 조회·분석 | `capture session`, `세션 히스토리` |

---

## 플러그인: `my-cowork`

`example-skills:doc-coauthoring`을 포크한 문서 공동 작성 스킬.
원본 대비 **사용자 질문 시 `AskUserQuestion` 도구 의무화** 규칙이 추가됨.

### 변경 사항 (원본 대비)

- 모든 사용자 질문 → `AskUserQuestion` 도구 필수
- 질문 최대 4개로 압축 (핵심 우선)
- 개방형 답변은 "Other" 옵션으로 수용

### 실행 방법

```
/cowork
```

---

## 플러그인: `my-session-dashboard`

Claude Code 대화 세션을 시각적으로 탐색하는 대시보드. `/ss` 커맨드로 실행.

### 기능

- `~/.claude/projects/` 하위 JSONL 세션 파일 전처리 (키워드 추출, 토큰 통계)
- `~/.claude/plans/` 하위 플랜 파일 검색·조회
- GitHub 스타일 다크 테마 2-panel 대시보드 (세션 목록 + 대화 뷰어)
- 프로젝트별 필터, 실시간 검색 (Ctrl+K), 도구 호출 접기/펼치기
- 증분 빌드 (`.build-cache.json` 사용)

### 실행 방법

```
/ss
```

빌드 결과는 `output/session-dashboard/`에 출력됩니다.

---

## 플러그인: `my-session-id`

세션 ID를 3개 훅 이벤트(SessionStart, UserPromptSubmit, Stop)에서 캡처하여 이벤트별 비교·검증하는 플러그인.

### 기능

- 각 훅 이벤트에서 세션 ID를 프로젝트 `.claude/` 하위에 별도 파일로 저장
- 세션 ID 일치 여부로 크로스세션 오염 감지
- 커맨드 없음 — `session-id` 스킬로 검증 실행

### 훅 이벤트

| 이벤트 | 저장 파일 |
|--------|----------|
| `SessionStart` | `.claude/.session-id-start` |
| `UserPromptSubmit` | `.claude/.session-id-prompt` |
| `Stop` | `.claude/.session-id-stop` |

---

## 커맨드 자동 등록 동작 방식

각 플러그인은 SessionStart 시 `hooks/ensure-commands.js`를 실행하여 커맨드 파일을 `~/.claude/commands/`에 자동 등록합니다.

충돌 감지는 커맨드 파일 frontmatter의 `plugin:` 마커를 기준으로 처리합니다.

| 상황 | 처리 |
|------|------|
| 커맨드 파일 없음 | 자동 설치 |
| 파일 있음 + 동일 플러그인 마커 (`plugin: my-cowork` 등) | 내용 비교 후 변경 시 자동 갱신 |
| 파일 있음 + 다른 마커 or 마커 없음 | ⚠️ 경고 출력 후 스킵 — 기존 설정 보호 |

**충돌 시 교체 방법:** 해당 파일 삭제 후 Claude Code 재시작

---

## 설치 범위

플러그인 설치 시 레포 전체가 아닌 **각 플러그인 디렉토리만** 사용자 캐시에 복사됩니다.

| 경로 | 설치 포함 | 설명 |
|------|-----------|------|
| `my-session-wrap/`, `my-cowork/`, `my-session-dashboard/`, `my-session-id/` | O | `marketplace.json`의 `source` 필드가 가리키는 디렉토리 |
| `_handoff/`, `docs/`, `temp/`, `output/` | X | 개발용 문서·빌드 결과. 플러그인 설치에 미포함 |
| `CLAUDE.md`, `README.md`, `.gitignore` | X | 레포 관리 파일. 설치에 미포함 |

`marketplace.json`의 `source` 필드(예: `"./my-session-wrap"`)가 설치 범위를 결정합니다.

---

## 업데이트 구조

```
이 레포 (개발 공간)                GitHub              Claude Code 런타임
──────────────────────────────────────────────────────────────────────
my-claude-plugins/          git push          /plugin update
  .claude-plugin/              →                    →
    marketplace.json                     ~/.claude/plugins/marketplaces/
  my-session-wrap/                         my-claude-plugins/ (설치 결과)
  my-cowork/
  my-session-dashboard/
  my-session-id/
```

| 경로 | 역할 | 관리 방식 |
|------|------|-----------|
| 이 레포 (`my-claude-plugins/`) | 소스 코드 + `marketplace.json` (플러그인 목록) | 개발자가 직접 편집 |
| `~/.claude/plugins/marketplaces/` | Claude Code가 실제로 로드하는 설치 경로 | `/plugin update`가 자동 생성. **직접 수정 금지** |

```bash
# GitHub push 후 실행
/plugin update my-session-wrap
/plugin update my-cowork
/plugin update my-session-dashboard
/plugin update my-session-id
```

---

## 플러그인 릴리스 워크플로우

플러그인 코드를 수정한 후 릴리스할 때의 절차.

### 절차

1. 플러그인 코드 수정
2. `<plugin>/.claude-plugin/plugin.json`의 `version` 올림 (semver)
3. `.claude-plugin/marketplace.json`의 해당 플러그인 `version` 동일하게 올림
4. `CHANGELOG.md`에 항목 추가 (최신을 최상단에)
5. `git commit` — pre-commit hook이 버전 일치 자동 검증
6. `git push`
7. Claude Code에서 `/plugin update <plugin-name>` 실행

### pre-commit hook (버전 동기화 검증)

`git-hooks/check-version-sync.js`가 커밋 시 자동 실행되어, `marketplace.json`과 각 `plugin.json`의 version이 불일치하면 커밋을 차단합니다.

```bash
# 초기 설정 (clone 후 1회)
git config core.hooksPath git-hooks
```

---

## 관련 설정

- **글로벌 CLAUDE.md**: `~/.claude/CLAUDE.md`
- **커맨드**: `~/.claude/commands/wrap.md`, `~/.claude/commands/cowork.md`, `~/.claude/commands/ss.md`

---

## Changelog

[CHANGELOG.md](./CHANGELOG.md) 참조.
