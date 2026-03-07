---
description: 경량 commit-push — 변경사항 분석 → 커밋 → 푸쉬 (remote 있을 때만)
allowed-tools: Bash(git *), Read, Edit, Glob
plugin: my-session-wrap
---

# Commit & Push (/cp)

변경사항을 분석하여 커밋 메시지를 자동 생성하고 commit + push를 수행하는 경량 커맨드.
**각 파일이 속한 git 레포 루트를 감지하여 레포별로 개별 commit + CHANGELOG 업데이트를 수행한다.**

## Usage

- `/cp` — 변경사항 분석 후 자동 커밋메시지 생성, commit (+ push if remote exists)
- `/cp [message]` — 지정된 메시지로 commit (+ push if remote exists)

## Execution Steps

### Step 1: 레포 감지 및 그룹핑

현재 세션에서 변경된 파일들의 git 레포 루트를 감지한다.

```bash
# 각 변경 파일에 대해 레포 루트 감지
git -C "<파일이 있는 디렉토리>" rev-parse --show-toplevel 2>/dev/null
```

1. 세션 컨텍스트에서 변경된 파일 목록을 수집
2. 각 파일에 대해 `git rev-parse --show-toplevel`로 레포 루트 감지
3. 레포 루트별로 파일 그룹핑
4. git 레포에 속하지 않는 파일은 안내 후 스킵

그룹핑 결과를 사용자에게 표시:
```
📂 감지된 레포 (N개):
- <레포루트A> (M files)
- <레포루트B> (K files)
```

변경사항이 전혀 없으면 "커밋할 내용이 없습니다." 출력 후 종료.

### Step 2: 레포별 처리 (각 레포에 대해 반복)

각 레포 루트(`<REPO>`)에 대해 아래 2-1~2-5를 순차 실행한다.

#### 2-1. 상태 확인

```bash
git -C "<REPO>" status --short
git -C "<REPO>" diff --stat
git -C "<REPO>" diff --cached --stat
```

#### 2-2. Staging

- 이미 staged된 파일이 있으면 그대로 사용
- staged 파일이 없으면: 해당 레포에 속한 변경 파일만 `git -C "<REPO>" add <파일명...>`
- **주의**: `git add -A` 사용 금지. 파일명을 명시하여 add. 민감파일(.env, credentials 등) 제외

#### 2-3. 커밋 메시지 생성

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

#### 2-4. CHANGELOG 업데이트

해당 레포 루트에 `CHANGELOG.md`가 존재하면:
- 이력 테이블 최상단에 새 행 추가
- 형식: `| 날짜 | 타입 | 버전 | 변경 내용 |`
- 버전 열: plugin.json 버전이 변경된 경우만 기재, 아니면 `-`
- CHANGELOG 변경도 같은 커밋에 포함

```bash
ls "<REPO>/CHANGELOG.md" 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

#### 2-5. Commit + Push

```bash
git -C "<REPO>" commit -m "$(cat <<'EOF'
type(scope): 요약

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

커밋 후 remote 확인:
- remote가 **있으면**: `git -C "<REPO>" push` 실행. 실패 시 에러 메시지를 보여주고 다음 레포로 계속.
- remote가 **없으면**: push를 건너뛰고 "로컬 전용 레포 — push 생략" 안내.

### Step 3: 에러 처리

- 특정 레포에서 커밋/푸시 실패 시: 에러를 출력하고 다음 레포로 계속 진행
- 모든 레포 처리 완료 후 최종 결과에서 성공/실패 레포를 구분하여 표시

### Step 4: 결과 출력

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
