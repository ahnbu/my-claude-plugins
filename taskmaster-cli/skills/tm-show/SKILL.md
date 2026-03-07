---
name: tm-show
description: "특정 Taskmaster 태스크 상세 조회. 트리거: /tm-show, 태스크 상세, task detail, show task, taskmaster show"
---

# TM Show

특정 태스크의 상세 정보(설명, 서브태스크, 의존성 등)를 조회한다.

## 실행

태스크 ID를 사용자에게 물어본 후:

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-show.bat <task-id>"
```

명령에 ID가 포함된 경우 (예: `/tm-show 3`): 즉시 실행.

## 결과 처리

상세 정보를 그대로 사용자에게 표시한다.
