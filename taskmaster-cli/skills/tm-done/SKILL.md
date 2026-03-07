---
name: tm-done
description: "Taskmaster 태스크를 done 상태로 완료 처리. 트리거: /tm-done, 태스크 완료, 완료 처리, done, taskmaster done"
---

# TM Done

태스크를 `done` 상태로 완료 처리한다.

## 실행

태스크 ID를 사용자에게 물어본 후:

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-set-status.bat <task-id> done"
```

명령에 ID가 포함된 경우 (예: `/tm-done 3`): 즉시 실행.

## 결과 처리

완료 확인 후 `/tm-next` 실행 제안 ("다음 태스크로 넘어갈까요?").
