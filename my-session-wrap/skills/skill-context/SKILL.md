---
name: skill-context
description: "스킬별 컨텍스트 소모량 리포트. 각 스킬 호출이 cp%를 얼마나 소모하는지 집계. Triggers: 'skill-context', 'skill context', '스킬 컨텍스트', '스킬 소모', '컨텍스트 비용'"
---

# Skill Context Report

스킬 호출 전후 cp% 델타를 집계하여 스킬별 컨텍스트 소모량을 리포트한다.

## 실행

```bash
node ~/.claude/my-claude-plugins/my-session-wrap/skills/continue/scripts/analyze-skill-context.mjs [옵션]
```

### 옵션

- 인자 없음: 전체 스킬 집계 리포트
- `--skill <name>`: 특정 스킬 상세 (개별 호출 이력 포함)
- `--session <sid>`: 특정 세션 상세

## 출력 형식

### 전체 집계 (기본)

```
스킬 컨텍스트 소모 분석 (세션 N개, 호출 M회)
스킬명        호출  측정  평균Δcp%  최소Δcp%  최대Δcp%
wrap           2    1    +4.00%    +4.00%    +4.00%
...
```

- **측정**: cp_before 실측 기준 정확값만 집계 (추정값 제외)
- **측정 < 호출**: cp_before 미확보 케이스 존재 (세션 첫 호출 등)

### 스킬 상세 (`--skill <name>`)

개별 호출별 시각(KST), before/after cp%, delta 테이블 출력

## 실행 후

결과를 마크다운 표로 변환하여 사용자에게 직접 출력한다.
