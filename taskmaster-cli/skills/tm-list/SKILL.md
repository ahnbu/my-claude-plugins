---
name: tm-list
description: "Taskmaster 태스크 목록 조회. 트리거: /tm-list, 태스크 목록, task list, taskmaster list, tm list, 태스크 보여줘"
---

# TM List

현재 프로젝트의 태스크 목록을 조회한다.

## 실행

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-list.bat"
```

필터 인자가 있으면 포함:
- "pending만" → `--status=pending`
- "진행중" → `--status=in-progress`
- "완료된것" → `--status=done`

## 결과 처리

출력을 표 형태로 정리하여 사용자에게 표시한다.
