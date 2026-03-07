---
name: my-session-wrap
description: "Session wrap-up: saves a structured handoff document and creates a git commit (when git is available). Use at session end. Triggers: 'wrap', 'wrap up', 'end session', 'handoff', 'session summary', '마무리', '세션 정리', '인수인계', '오늘은 여기까지', '정리해줘', '세션 완료'"
---

# My Session Wrap

세션 마무리 시 실행하는 경량 워크플로우.

1. **컨텍스트 복원** — `_handoff/handoff_YYYYMMDD_01_한줄요약.md` 저장으로 다음 세션에서 즉시 재개
2. **변경사항 반영** — (git 있을 시) commit으로 작업 이력 기록

## 실행 흐름

```
Step 1. Git 감지
Step 1.5. 프로젝트 CLAUDE.md Wrap 체크리스트 확인
Step 2. handoff 파일 생성
Step 3. git commit (선택)
Step 4. 규칙 후보 확인 + 재개 안내
```

---

## Step 1: Git 감지 + 멀티 레포 그룹핑

```bash
git status --short 2>/dev/null && echo "GIT_AVAILABLE" || echo "NO_GIT"
```

Git이 감지되면, 이번 세션에서 변경된 파일들의 레포 루트를 수집하여 그룹핑한다:

```bash
# 변경된 파일 목록 수집 (미커밋 + 스테이지 + 언트랙)
{
  git diff --name-only HEAD 2>/dev/null
  git diff --name-only --cached 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
} | sort -u | while read f; do
  # 각 파일의 레포 루트 감지
  repo=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null)
  [ -n "$repo" ] && echo "$repo"
done | sort -u
```

- 결과가 **1개**이면 단일 레포 — 기존 흐름과 동일하게 진행
- 결과가 **2개 이상**이면 멀티 레포 — 각 레포를 `REPOS` 목록으로 기억하고, 이후 Step 3에서 레포별로 순회

```
📋 감지된 레포 목록:
  📂 /d/project-a   (파일 N개)
  📂 /c/Users/.claude/my-claude-plugins/my-plugin   (파일 M개)
```

---

## Step 1.5: 프로젝트 CLAUDE.md Wrap 체크리스트 확인

프로젝트 CLAUDE.md(또는 `.claude/CLAUDE.md`)를 읽어라:

```bash
# 프로젝트 CLAUDE.md 위치 탐색 (우선순위: .claude/CLAUDE.md > CLAUDE.md)
cat .claude/CLAUDE.md 2>/dev/null || cat CLAUDE.md 2>/dev/null || echo "NO_PROJECT_CLAUDE_MD"
```

```bash
# 이번 세션 변경 파일 목록
git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null
```

### 1.5-A: 기존 체크리스트 항목 확인

`## Wrap 체크리스트` 섹션이 **있으면**: 각 항목을 파일 존재 여부·git diff 등으로 실제 확인하고, 미완료 항목이 있으면 사용자에게 보고 후 처리한다. handoff 작성 전에 완료하라.

### 1.5-B: 체크리스트 후보 탐지 (신규 제안)

프로젝트 CLAUDE.md에서 **관리 대상으로 명시된 파일·섹션** (예: `## 관리 문서`, `## 관리 대상` 등)을 파악한다.

- 관리 대상 파일 중 이번 세션에서 변경된 것을 찾는다 (git diff와 교차)
- 그 중 `## Wrap 체크리스트`에 **이미 등록되지 않은** 항목만 추린다
- 해당 항목이 있으면 목록을 출력하고 자동으로 다음 단계로 진행:

```
⚠️ Wrap 체크리스트 후보 탐지:
  - <항목 1>
  - <항목 2>
추가하려면 wrap 완료 후 "체크리스트에 추가해줘"로 요청.
```

- 프로젝트 CLAUDE.md에 관리 대상 파일 명시가 없거나, 체크리스트 후보가 없으면: 이 단계 스킵.

---

## Step 2: handoff 파일 생성

### 2-1. 세션 ID 획득 (절대 생략 불가)

아래 순서로 획득하라:

**1차: system-reminder에서 직접 탐색 (멀티세션 안전)**

현재 대화 컨텍스트의 system-reminder 메시지에 `[session_id=XXXX]` 패턴이 포함되어 있다.
이 값을 직접 읽어라. (UserPromptSubmit hook이 매 프롬프트 직전 주입)

**2차: 파일 fallback (system-reminder에서 찾지 못한 경우)**

```bash
cat .claude/.current-session-id 2>/dev/null || echo "(획득 실패)"
```

- 획득한 값을 handoff 문서 헤더의 `세션 ID:` 필드에 기입
- 세션 경로를 `C:/Users/ahnbu/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` 형식으로 구성하여 `세션 경로:` 필드에 기재 (`~` 단축형 금지)
- 둘 다 비어있으면 `세션 ID: (획득 실패)`, `세션 경로: (확인 불가)` 로 기재하고 사용자에게 안내

### 2-2. 파일 경로 생성 (절대 생략 불가)

세션 작업 내용을 3-4단어로 요약한다 (예: `출력경로변경`, `세션ID-훅수정`).

`scripts/next-handoff.sh`를 사용하여 경로를 결정한다:

```bash
SCRIPT=$(ls "$HOME/.claude/my-claude-plugins/my-session-wrap/skills/my-session-wrap/scripts/next-handoff.sh" "$HOME/.claude/plugins/cache/my-claude-plugins/my-session-wrap"/*/skills/my-session-wrap/scripts/next-handoff.sh 2>/dev/null | head -1)
bash "$SCRIPT" "" "<요약>"
```

스크립트는 ProjectRoot를 다음 우선순위로 자동 결정한다:
1. 첫 번째 인자 (명시적 경로) — 비워두면 자동 탐색
2. `git rev-parse --show-toplevel`
3. 마커 스캔 — CWD 포함 상위 최대 3단계, `CHANGELOG.md`·`AGENTS.md`·`CLAUDE.md`·`GEMINI.md` 중 **보유 개수 최다 폴더** (동점 시 가장 가까운 조상)
4. 미탐지 시 오류 종료 + git root 후보 안내

handoff는 항상 `<ProjectRoot>/_handoff/handoff_YYYYMMDD_NN_요약.md`에 저장된다.

- `<요약>` 자리에 실제 요약어를 채워 실행 (예: `"Junction자동화-dotfiles통합완료"`)
- stdout으로 출력된 절대경로를 Write 도구의 대상으로 사용
- **exit 1 시**: 사용자에게 오류 보고 후 중단. 직접 파일명을 결정하거나 기존 파일에 쓰는 것은 절대 금지

### 2-3. handoff 파일 작성

템플릿은 `references/template.md` 참조. 메인 에이전트가 세션 컨텍스트에서 직접 작성한다.

- 각 항목은 실제 내용이 있을 때만 포함하고, 해당 없는 항목은 생략
- §3 피드백 루프는 AI 초안 작성 후 "검토·수정해 주세요" 안내
- §3 레슨 중 이전 handoff에서도 언급된 패턴(2회+)이면 `[규칙 후보]` 태그 추가
- §6 환경 스냅샷은 알려진 이슈가 있을 때만 포함 (플러그인 상태, 알려진 제약, 워크어라운드)

---

## Step 3: git commit

### Git 없는 경우

handoff 파일 저장 후 완료.

### Git 있는 경우

#### 3-1. CHANGELOG.md 위치 확인 (레포별)

Step 1에서 감지한 **각 레포 루트**마다 CHANGELOG.md 존재 여부를 개별 확인한다.

> 단일 레포인 경우: 해당 레포 루트 1개에만 적용 (기존과 동일)
> 멀티 레포인 경우: 감지된 모든 레포 루트에 대해 아래를 반복

```bash
# REPO_ROOT = 각 레포의 루트 경로 (Step 1에서 감지)
ls "$REPO_ROOT/CHANGELOG.md" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

- **EXISTS**: 기존 파일의 양식을 Read로 확인해 둔다.
- **NOT_FOUND**: `C:\Users\ahnbu\CHANGELOG_TEMPLATE.md`를 Read하여 형식을 확인한 후 `<REPO_ROOT>/CHANGELOG.md`로 새로 생성.
- **CWD 상대경로(`ls CHANGELOG.md`)로 탐색 금지** — 실행 위치에 따라 잘못된 파일을 찾거나 서브폴더에 새 파일을 생성하는 문제가 발생한다.

#### 3-2. 관심사별 CHANGELOG 추가 + 커밋 (레포별 순회)

미커밋 작업물을 **레포별로 그룹핑**한 뒤, 레포마다 관심사별로 분류하여 **관심사 1건마다 아래 사이클을 반복**한다:

1. 해당 레포의 CHANGELOG.md에 **관심사 1줄만** 추가 (Edit)
2. `git -C <레포루트> add <해당 관심사 작업물> CHANGELOG.md`
3. `git -C <레포루트> commit`

> ⚠️ **CHANGELOG를 한꺼번에 여러 줄 추가한 뒤 커밋을 분리하면 pre-commit hook에 차단된다.**
> 반드시 "1줄 추가 → 커밋" 사이클을 관심사 수만큼 반복하라.

```bash
# ══ 📂 레포 A (/d/project-a) ══

# ── 관심사 A-1 ──
# 1) 레포 A의 CHANGELOG에 관심사 A-1 항목 1줄 추가 (Edit 도구)
git -C /d/project-a add <관심사A-1 파일들> CHANGELOG.md
git -C /d/project-a commit -m "<type>(<scope>): <한 줄 요약>"

# ── 관심사 A-2 ──
# 1) 레포 A의 CHANGELOG에 관심사 A-2 항목 1줄 추가 (Edit 도구)
git -C /d/project-a add <관심사A-2 파일들> CHANGELOG.md
git -C /d/project-a commit -m "<type>(<scope>): <한 줄 요약>"

# ══ 📂 레포 B (/c/Users/.claude/my-plugin) ══

# ── 관심사 B-1 ──
# 1) 레포 B의 CHANGELOG에 관심사 B-1 항목 1줄 추가 (Edit 도구)
git -C /c/Users/.claude/my-plugin add <관심사B-1 파일들> CHANGELOG.md
git -C /c/Users/.claude/my-plugin commit -m "<type>(<scope>): <한 줄 요약>"
```

- 같은 관심사(같은 맥락·목적)의 파일은 하나의 커밋으로 묶는다.
- 맥락이 다른 파일은 별도 커밋으로 분리한다.
- 단일 레포인 경우 `git -C <레포루트>` 없이 기존처럼 `git add / git commit`으로 진행해도 동일.
- Scope는 실제 변경 범위로 작성 (포괄값 금지).

> **handoff 파일은 커밋하지 않는다.** `_handoff/`는 `.gitignore`에 등록된 세션 메타데이터이므로 git이 추적하지 않는다.

---

## Step 4: 규칙 후보 확인 + 재개 안내

### 4-1. 규칙 후보 확인

handoff의 `[규칙 후보]` 태그가 1개 이상이면 재개 안내에 포함시켜 출력:

```
⚠️ [규칙 후보] N건 — handoff §3 참조. 반영하려면 "규칙 후보 반영해줘"로 요청.
```

### 4-2. 재개 안내 출력

생성된 handoff 경로를 포함한 재개 프롬프트 출력:

```
---
✅ Handoff 저장 완료: <handoff 파일 경로>

다음 세션에서 이어가려면:
  이전 세션에 이어서 작업합니다. /continue
---
```

---

> **주의:** MEMORY.md(auto memory)는 이 워크플로우의 범위가 아니다. auto memory는 작업 중 자연스럽게 갱신되는 별도 기능이다.
