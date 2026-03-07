---
name: task-master-start
description: "Taskmaster 워크플로우 시작. 프로젝트 init 체크 + 태스크 대시보드 표시. 트리거: /task-master-start, taskmaster 시작, tm start, 태스크마스터 시작, taskmaster start"
---

# Task Master Start

Taskmaster 세션을 시작한다. `.taskmaster/` 존재 확인 → 없으면 init → 모델 설정 표시 → 현재 태스크 목록 표시.

## 실행

현재 작업 디렉토리에서 bat을 실행한다:

```bash
cmd /c "D:/vibe-coding/taskmaster/task-master-start.bat"
```

## 결과 처리

bat 출력을 그대로 사용자에게 전달한다. 추가로:

- init이 실행된 경우: `.taskmaster/config.json` 모델 설정을 `claude-code` provider로 변경하는 방법 안내
- 태스크가 0개인 경우: PRD 파일 위치를 물어보고 `/tm-parse-prd` 실행 제안
- in-progress 태스크가 있는 경우: "이어서 작업하시겠습니까?" 질문
