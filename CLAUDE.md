# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 개요

개인용 Claude Code 플러그인 마켓플레이스. 각 플러그인은 독립 디렉토리로 관리되며 GitHub을 통해 배포.

## 아키텍처

### 플러그인 구조

```
<plugin-name>/
├── .claude-plugin/plugin.json    # 메타정보 (name, version, description)
├── hooks/
│   ├── hooks.json                # SessionStart 훅 정의
│   └── ensure-commands.js        # 커맨드 자동 등록 스크립트
├── commands/*.md                 # 슬래시 커맨드 정의
├── agents/*.md                   # 서브에이전트 정의
└── skills/<skill-name>/SKILL.md  # 스킬 정의
```

### 마켓플레이스 등록

이 레포의 `.claude-plugin/marketplace.json`이 마스터 메타파일. 개발자가 직접 편집하여 플러그인 목록(`source`, `version`)을 관리.

### 커맨드 자동 등록 (ensure-commands.js)

SessionStart 훅으로 매 세션 실행. 플러그인의 `commands/` 파일을 `~/.claude/commands/`에 복사.

**충돌 감지**: 커맨드 파일 frontmatter의 `plugin: <name>` 마커로 소유권 판정.
- 마커 없거나 다른 플러그인 → 경고 출력 후 스킵 (기존 보호)
- 같은 플러그인 마커 → 내용 비교 후 변경 시 자동 갱신
- 파일 없음 → 자동 설치

### 스킬 → 슬래시 커맨드 등록 규칙

신규 스킬 생성 시 반드시 `~/.claude/commands/<skill-name>.md`에 스킬래퍼 커맨드를 등록해야 `/skill-name`으로 슬래시 커맨드 사용이 가능하다. 스킬래퍼 형식:

```yaml
---
description: <한 줄 설명>
allowed-tools: <필요 도구>
plugin: <플러그인명>
---

Read and follow the skill definition at:
<SKILL.md 절대경로>
```

### Frontmatter 규칙

**Commands**: `plugin: <name>` 마커 필수 (충돌 감지용)
**Agents**: `tools`, `model`, `color` 지정
**Skills**: `description`은 한 줄 (멀티라인 불가)

### Hook 작성 규칙

- **hooks.json 이중 배열**: `"Event": [{ hooks: [{ type, command }] }]` — 내부 `hooks` 배열 누락 시 조용히 미실행
- **Node.js만 사용**: Windows에서 cmd.exe가 shebang 미해석 → bash/python hook 불가
- **이벤트명 PascalCase**: `SessionStart`, `UserPromptSubmit`, `Stop` 등. 대소문자 틀리면 무시
- **stdin 방어 필수**: `if (!input) return` + `try-catch` (빈 stdin crash 방지)
- **파일 저장은 stdin의 `cwd` 기준**: 글로벌 경로 사용 시 동시 세션 충돌
- **timeout 명시**: 권장 3000ms. hook 실패가 세션을 차단하면 안 됨

## 현재 플러그인

| 플러그인 | 설명 | 커맨드 |
|----------|------|--------|
| `my-session-wrap` | 세션 마무리 워크플로우 (handoff 저장 + git commit) | `/wrap` |
| `my-cowork` | doc-coauthoring 포크 (AskUserQuestion 의무화) | `/cowork` |
| `my-session-dashboard` | Claude Code 대화 세션 대시보드 (JSONL→JSON 전처리 + 브라우저 뷰어) | `/ss` |

## 배포 워크플로우

### 현행 운용 모드: Plugin 미설치 운용 (2026-03-10 전환)

본인 환경에서는 plugin을 설치하지 않고 소스 레포에서 직접 실행한다.
- hooks: `settings.json`에 소스 레포 경로를 직접 등록
- commands/skills: `~/.claude/commands/`, `~/.claude/skills/`에 직접 배치
- git push: post-commit hook(`auto-push-update.js`)이 자동 처리

### 타인 배포 시 (참고용)

```
이 레포 (개발 공간)                GitHub              Claude Code 런타임
──────────────────────────────────────────────────────────────────────
my-claude-plugins/          git push     claude plugin marketplace update
  .claude-plugin/              →                    →
    marketplace.json                     ~/.claude/plugins/marketplaces/
  my-session-wrap/                         my-claude-plugins/ (설치 결과)
  my-cowork/
  my-session-dashboard/
```

배포 CLI 명령:

```bash
# 1. 마켓플레이스 최신 코드 pull (GitHub → 설치 경로)
CLAUDECODE="" claude plugin marketplace update my-claude-plugins

# 2. 특정 플러그인 업데이트 (설치 경로 → 플러그인 캐시)
CLAUDECODE="" claude plugin update <plugin-name>@my-claude-plugins
```

### 세션 DB 경로 원칙

- **소스 레포 DB** (정본): `output/session-dashboard/sessions.db` — 모든 훅·커맨드·스킬이 런타임에 읽고 쓰는 대상
- DB 경로 결정: `__dirname` 기준 상대경로로 해결. 절대경로 하드코딩 금지.
- 스키마·파일 맵·CLI 변경 시 `SESSION-DB.md` 변경 이력 표 갱신 필수. (스키마 레퍼런스: `SESSION-DB.md`)

## 문서 파일 이름 규칙

### 비개발 문서 (조사, 분석, 계획, 의사결정 등)

```
YYYYMMDD_이슈명.md
```

- 날짜는 문서 최초 작성일 기준 (이후 수정으로 변경하지 않음)
- 이슈명은 한국어, 언더스코어(`_`) 구분
- 영어 제목 금지. 기술 용어는 혼용 허용 (예: `20260224_세션ID테스트_2차_Node전환.md`)
- 불필요한 태그 접미어 금지 (예: `_claude`, `_v1` 등은 버전관리 용도 외 사용 금지)

## Git Commit 규칙

### 형식

```
<타입>(<플러그인명>): <한 줄 요약>
```

### 타입

| 타입 | 사용 | 버전 영향 |
|------|------|-----------|
| `feat` | 새 기능 추가 | minor ↑ |
| `fix` | 버그 수정 | patch ↑ |
| `refactor` | 구조 정리 (기능 불변) | - |
| `docs` | 문서만 변경 | - |
| `chore` | 메타데이터 수정 | - |

### 규칙

- 커밋 메시지는 한국어 (타입·플러그인명은 영어)
- 한 커밋에 하나의 플러그인만 수정
- 모든 커밋을 CHANGELOG.md에 기록 (최신 항목을 테이블 최상단에 추가, 타입 열로 구분)
- `plugin.json`의 `version`을 Semantic Versioning으로 관리
- `marketplace.json`의 version과 `plugin.json`의 version을 반드시 일치시킬 것 (pre-commit hook이 검증)
