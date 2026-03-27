---
name: cp
description: "경량 commit-push — 변경사항 분석 → 커밋 → 푸쉬 (remote 있을 때만). Triggers: 'cp', 'commit and push', '커밋', '푸시', 'commit push', '변경사항 커밋'"
---

# Commit & Push

변경사항을 분석하여 커밋 메시지를 자동 생성하고 commit + push를 수행하는 경량 커맨드.
**각 파일이 속한 git 레포 루트를 감지하여 레포별로 개별 commit + CHANGELOG 업데이트를 수행한다.**

## Usage

- `/cp` — 변경사항 분석 후 자동 커밋메시지 생성, commit (+ push if remote exists)
- `/cp [message]` — 지정된 메시지로 commit (+ push if remote exists)

## Execution Steps

### Step 1: 레포 감지 + 상태 파악

스크립트 1회 호출로 세션 변경 파일 → 레포 감지 → 그룹핑을 한 번에 수행한다:

```bash
node ~/.claude/my-claude-plugins/shared/find_save_target.js <sessionId>
```

- `sessionId`: system-reminder의 `[session_id=XXXX]` 값
- 출력 JSON: `{ modified_files, git_repos: [{root, files, file_count}], non_repo_files, recommended_repo }`
- `git_repos[]` → 커밋 대상 레포 목록으로 사용
- `non_repo_files[]` → "git 레포 아님 — 스킵" 안내

각 레포의 실제 변경 상태를 파악한다:

```bash
git -C "<REPO>" status --short
git -C "<REPO>" diff --stat
git -C "<REPO>" diff --cached --stat
```

그룹핑 결과를 사용자에게 표시:
```
📂 감지된 레포 (N개):
- <레포루트A> (M files)
- <레포루트B> (K files)
```

모든 레포에 변경사항이 없으면 "커밋할 내용이 없습니다." 출력 후 종료.

### Step 2: 레포별 처리 (각 레포에 대해 반복)

각 레포 루트(`<REPO>`)에 대해 아래 2-1~2-4를 순차 실행한다. 변경사항이 없는 레포는 스킵.

#### 2-1. Staging

- 이미 staged된 파일이 있으면 그대로 사용
- staged 파일이 없으면: Step 1 스크립트 출력의 `git_repos[i].files[]`를 그대로 사용하여 add:
  ```bash
  git -C "<REPO>" add <git_repos[i].files 목록>
  ```
- **주의**: `git add -A` 사용 금지. 민감파일(.env, credentials 등) 제외

#### 2-2. 커밋 메시지 생성

사용자가 메시지를 제공한 경우 그대로 사용.

제공하지 않은 경우 자동 생성:
- `git -C "<REPO>" diff --cached`를 분석하여 변경 내용 파악
- 프로젝트 CLAUDE.md의 커밋 규칙을 따름: `type(scope): 한 줄 요약`
- type: feat|fix|refactor|docs|chore
- scope: 플러그인명 또는 변경 영역
- 요약은 한국어

**멀티 레포 맥락 반영 가이드**:
- 이 레포의 diff만이 아니라, 세션 전체 작업 맥락을 반영
- 다른 레포 변경과 연관된 경우, 커밋 메시지에 관련 맥락 기술
- 예: "글로벌 CLAUDE.md cp 규칙 변경에 따른 플러그인 스킬 업데이트"

#### 2-3. CHANGELOG 업데이트

스크립트로 CHANGELOG 행을 삽입한다 (없으면 자동 생성):

```bash
node ~/.claude/my-claude-plugins/shared/changelog-add-row.mjs \
  --repo "<REPO>" \
  --type <type> \
  --scope "<scope>" \
  --desc "<변경 내용>" \
  [--version <semver>]
```

- `--version`: plugin.json 버전이 변경된 경우만 지정, 없으면 생략 (`-` 자동)
- 스크립트 성공 시 stdout에 삽입된 행 출력, 실패(exit 1) 시 사용자에게 보고
- CHANGELOG 변경도 같은 커밋에 포함

> ⚠️ **여러 커밋으로 분리할 때 필수 순서**
> ```
> 커밋1: CHANGELOG에 커밋1 내용만 기록 → git add CHANGELOG.md + 소스 → git commit
> 커밋2: CHANGELOG에 커밋2 내용만 추가 기록 → git add CHANGELOG.md + 소스 → git commit
> ※ CHANGELOG를 여러 커밋분 한꺼번에 수정하면 이 hook에서 차단된다.
> ```

#### 2-4. Commit + Push

```bash
COAUTHOR=$(node "$HOME/.claude/skills/session-find/scripts/detect-runtime.mjs" --coauthor)
git -C "<REPO>" commit -m "$([ -n "$COAUTHOR" ] && printf 'type(scope): 요약\n\n%s' "$COAUTHOR" || echo 'type(scope): 요약')"
```

커밋 후 remote 확인:
- remote가 **있으면**: `git -C "<REPO>" push` 실행. 실패 시 에러 메시지를 보여주고 다음 레포로 계속.
- remote가 **없으면**: push를 건너뛰고 "로컬 전용 레포 — push 생략" 안내.

### Step 3: 결과 출력

모든 레포 처리 완료 후 성공/실패를 구분하여 표시. 실패한 레포가 있어도 다른 레포는 계속 진행한다.

```
📂 C:/Users/ahnbu/.claude/my-claude-plugins
  ✓ [abc1234] docs(cp): 멀티 레포 지원 추가
  ✓ pushed to origin/main

📂 C:/Users/ahnbu/project-x
  ✓ [def5678] feat(config): 설정 파일 업데이트
  ℹ 로컬 전용 레포 — push 생략

📂 C:/Users/ahnbu/other-project
  ❌ 커밋 실패: <에러 메시지>
```
