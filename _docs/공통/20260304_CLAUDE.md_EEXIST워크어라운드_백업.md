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
| `my-session-id` | 세션 ID 캡처 및 훅 이벤트별 비교 | - |

## 배포 워크플로우

```
이 레포 (개발 공간)                GitHub              Claude Code 런타임
──────────────────────────────────────────────────────────────────────
my-claude-plugins/          git push          /plugin update
  .claude-plugin/              →                    →
    marketplace.json                     ~/.claude/plugins/marketplaces/
  my-session-wrap/                         my-claude-plugins/ (설치 결과)
  my-cowork/
  my-session-dashboard/
```

- **이 레포**: 개발자가 직접 편집하는 소스. `marketplace.json` 포함.
- **`~/.claude/plugins/marketplaces/`**: `/plugin update`가 자동 생성하는 설치 경로. Claude Code가 여기서 hooks/commands/skills를 로드. **직접 수정 금지** (다음 update 시 덮어씌워짐).

### EEXIST 버그 워크어라운드 (버그 해결 전까지 임시)

> **임시 절차**: `/plugin update` 및 `/plugin` UI 설치의 EEXIST 버그(#27791) 해결 시 이 섹션 전체 삭제.

#### A. 기존 플러그인 업데이트 (코드 변경 후 캐시 반영)

```bash
# 1. 개발 레포에서 push
git push

# 2. 마켓플레이스 클론에서 pull
cd ~/.claude/plugins/marketplaces/my-claude-plugins && git pull

# 3. 캐시에 복사 (버전 디렉토리 없으면 mkdir -p로 생성)
#    주의: /* 대신 /. 사용 — .claude-plugin/ 같은 숨김 디렉토리 포함
cp -r ~/.claude/plugins/marketplaces/my-claude-plugins/<plugin-name>/. \
      ~/.claude/plugins/cache/my-claude-plugins/<plugin-name>/<version>/

# 4. installed_plugins.json의 version, installPath, gitCommitSha 업데이트
# 5. diff로 검증
diff -r <개발레포>/<plugin-name>/ ~/.claude/plugins/cache/my-claude-plugins/<plugin-name>/<version>/
```

#### B. 신규 플러그인 설치 (마켓플레이스에 있으나 미설치 상태)

```bash
# 1. 마켓플레이스 클론에서 최신화
cd ~/.claude/plugins/marketplaces/my-claude-plugins && git pull

# 2. 캐시 디렉토리 생성 및 파일 복사 (.claude-plugin/ 숨김 폴더 포함)
VERSION=$(cat ~/.claude/plugins/marketplaces/my-claude-plugins/<plugin-name>/.claude-plugin/plugin.json | python3 -c "import sys,json; print(json.load(sys.stdin)['version'])")
mkdir -p ~/.claude/plugins/cache/my-claude-plugins/<plugin-name>/$VERSION
cp -r ~/.claude/plugins/marketplaces/my-claude-plugins/<plugin-name>/. \
      ~/.claude/plugins/cache/my-claude-plugins/<plugin-name>/$VERSION/

# 3. installed_plugins.json에 항목 추가
#    키 형식: "<plugin-name>@my-claude-plugins"
#    gitCommitSha: cd ~/.claude/plugins/marketplaces/my-claude-plugins && git rev-parse HEAD

# 4. settings.json의 enabledPlugins에 추가
#    "<plugin-name>@my-claude-plugins": true

# 5. diff로 검증
diff -r ~/.claude/plugins/marketplaces/my-claude-plugins/<plugin-name>/ \
        ~/.claude/plugins/cache/my-claude-plugins/<plugin-name>/$VERSION/
```

**수정할 파일 2개**:
- `~/.claude/plugins/installed_plugins.json` — 설치 기록 (scope, installPath, version, installedAt, lastUpdated, gitCommitSha)
- `~/.claude/settings.json` → `enabledPlugins` — UI 표시 및 활성화 여부

**새 세션 필요**: 캐시 동기화 후 hooks/skills/commands 반영은 새 세션에서만 적용.

## 문서 파일 이름 규칙

### 비개발 문서 (조사, 분석, 계획, 의사결정 등)

```
YYYYMMDD_이슈명.md
```

- 날짜는 문서 최초 작성일 기준 (이후 수정으로 변경하지 않음)
- 이슈명은 한국어, 언더스코어(`_`) 구분
- 영어 제목 금지. 기술 용어는 혼용 허용 (예: `20260224_세션ID테스트_2차_Node전환.md`)
- 불필요한 태그 접미어 금지 (예: `_claude`, `_v1` 등은 버전관리 용도 외 사용 금지)

### Handoff 문서

```
docs/<plugin-name>/handoff/handoff_YYYYMMDD_NN_한줄요약.md
```

- `NN`: 당일 순번 01부터
- 한줄요약: 한국어, 하이픈(`-`) 구분 허용
- 반드시 `handoff/` 서브폴더에 위치

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
