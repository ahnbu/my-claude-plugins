---
name: task-master-stop
description: "Taskmaster 워크플로우 마무리. 전체 태스크 상태 요약 + handoff 안내. 트리거: /task-master-stop, taskmaster 종료, tm stop, 태스크마스터 종료, taskmaster stop"
---

# Task Master Stop

Taskmaster 세션을 마무리한다. 전체 태스크 상태를 수집하고 요약 리포트를 출력한다.

## 실행

```bash
cmd /c "D:/vibe-coding/taskmaster/task-master-stop.bat"
```

## 결과 처리

bat 출력을 사용자에게 전달한 후:

1. in-progress 상태 태스크가 있으면 → "pending으로 되돌릴까요?" 질문
2. 세션 handoff 작성 권장: `/wrap` 스킬로 handoff 파일에 Taskmaster 진행 상황 포함 제안
