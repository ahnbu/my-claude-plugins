---
name: tm-parse-prd
description: "PRD 파일을 Taskmaster 태스크 목록으로 파싱. 트리거: /tm-parse-prd, PRD 파싱, parse prd, prd 파일 파싱, taskmaster parse"
---

# TM Parse PRD

PRD(Product Requirements Document) 파일을 읽어 태스크 목록을 자동 생성한다.

## 실행

PRD 파일 경로를 사용자에게 물어본 후:

```bash
cmd /c "D:/vibe-coding/taskmaster/tm-parse-prd.bat <prd-file-path>"
```

명령에 경로가 포함된 경우 (예: `/tm-parse-prd scripts/prd.txt`): 즉시 실행.

## 결과 처리

파싱 완료 후 `/tm-list`로 생성된 태스크 목록 표시 제안.
