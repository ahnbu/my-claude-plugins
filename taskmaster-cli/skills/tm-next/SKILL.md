---
name: tm-next
description: "다음에 작업할 Taskmaster 태스크 추천. 트리거: /tm-next, 다음 태스크, next task, 뭐 할까, taskmaster next"
---

# TM Next

의존성, 우선순위, 현재 상태를 고려하여 다음 작업 태스크를 추천한다.

## 실행

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-next.bat"
```

## 결과 처리

추천 태스크를 사용자에게 표시하고:
- "이 태스크를 시작할까요?" 질문
- 시작 시 `/tm-progress <id>` 실행 제안
