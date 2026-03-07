---
name: tm-progress
description: "Taskmaster 태스크를 in-progress 상태로 변경. 트리거: /tm-progress, 태스크 시작, 작업 시작, in-progress, taskmaster progress"
---

# TM Progress

태스크를 `in-progress` 상태로 변경한다.

## 실행

태스크 ID를 사용자에게 물어본 후:

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-set-status.bat <task-id> in-progress"
```

명령에 ID가 포함된 경우 (예: `/tm-progress 3`): 즉시 실행.

## 결과 처리

성공 메시지 확인 후 해당 태스크의 상세 내용을 `/tm-show`로 보여줄지 제안.
