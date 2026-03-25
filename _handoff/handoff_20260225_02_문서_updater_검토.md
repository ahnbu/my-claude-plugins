---
title:
created:
tags:
session_id:
session_path:
plan:
---

# 

## 1. 배경

### 문제

`/wrap` 실행 시 handoff 생성 + git commit만 수행. 프로젝트 CLAUDE.md에 "기능 변경 시 README.md changelog 함께 업데이트" 규칙이 있지만, wrap 워크플로우가 이를 자동으로 안내하지 않아 **changelog 업데이트가 빈번히 누락**됨.

### 출발점

- [team-attention/plugins-for-claude-natives](https://github.com/team-attention/plugins-for-claude-natives/tree/main/plugins/session-wrap)의 doc-updater 접근방식을 조사
- 이를 현재 my-session-wrap 플러그인의 경량 철학에 맞게 적용하는 방안 검토

---

## 2. team-attention doc-updater 분석

### 아키텍처

```
/wrap 커맨드
  ↓
session-wrap 스킬 (SKILL.md)
  ├─ Phase 1 (병렬 실행)
  │   ├─ doc-updater       ← CLAUDE.md/context.md 업데이트 분석
  │   ├─ automation-scout  ← 반복 패턴 → 자동화 기회 감지
  │   ├─ learning-extractor ← 레슨·실수·발견 추출
  │   └─ followup-suggester ← 미완료 작업·우선순위 제안
  ├─ Phase 2 (순차 실행)
  │   └─ duplicate-checker  ← 제안 검증 및 중복 제거
  └─ Phase 3 (통합 및 실행)
      └─ 사용자 선택 → 커밋/문서 업데이트 실행
```

### doc-updater 에이전트 상세

| 항목 | 내용 |
|------|------|
| 모델 | Claude Sonnet |
| 역할 | 문서 업데이트 필요 항목 분석 |
| 입력 | 세션 요약 (수정 파일, 작업 내용, 결정사항) |
| 출력 | CLAUDE.md/context.md 업데이트 제안 (정확한 마크다운 포함) |

### 문서 이원화 모델

**CLAUDE.md — 시스템 수준 지식**
- 새 커맨드/스킬/에이전트, 환경 설정, 프로젝트 구조 변경
- "미래 세션에서 Claude가 알아야 할 정보"

**context.md — 프로젝트 고유 지식**
- 비즈니스 제약 ("이 API는 rate limit 100/분")
- 기술적 우회방법 ("X 라이브러리 버그 때문에 Y 방식으로 처리")
- 역사적 결정사항 ("A 대신 B를 선택한 이유는...")
- 반복되는 문제
- "프로젝트 고유 컨텍스트 (다른 프로젝트에 적용 불가)"

### doc-updater 4단계 워크플로우

1. **기존 문서 읽기** — CLAUDE.md, context.md 파일 로드
2. **업데이트 후보 식별** — 새 커맨드/스킬? 환경 설정 변경? 구조 변경? 주요 의사결정?
3. **중복 교차 검증** — 기존 내용과 충돌 확인
4. **정확한 마크다운 제안** — 애매한 제안 금지, 실제 추가할 텍스트 제공

### duplicate-checker 검증 체계

| 검증 단계 | 검색 대상 |
|----------|---------|
| Exact Match | 동일한 이름/구절 |
| Keyword Match | 중요 용어 |
| Section Headers | 유사 구조 패턴 |
| Functional Overlap | 기존 내용과의 상호작용 |

결과 분류: Approved / Merge(병합 권장) / Skip(완전 중복) / Replace(교체)

### 품질 기준

- **수용**: 구체성 > 일반론, 정확한 텍스트, 충분한 컨텍스트, 문서화 가치 있음
- **거부**: 일회성 실험, 미완성 작업, 민감한 데이터

---

## 3. 레슨: 채택 vs 배제

### 채택할 원칙

| 원칙 | 적용 방법 |
|------|----------|
| 정확한 텍스트만 제안 | 실제 삽입할 마크다운 행을 생성해서 보여줌 |
| 기존 문서 구조 존중 | 테이블 컬럼 구조를 파싱해 동적으로 따라감 |
| 품질 게이트 | 일회성 실험·미완성·민감 데이터 제외 기준 명시 |
| 사용자 확인 필수 | 제안 → 확인 → 적용 흐름 |

### 배제한 것과 이유

| 요소 | 배제 이유 |
|------|----------|
| 5개 에이전트 병렬 아키텍처 | 경량 플러그인에 과도한 복잡성 |
| CLAUDE.md/context.md 자동 업데이트 | 잘못된 규칙이 전역(매 세션)에 영향. 기존 "재발방지책·교훈 저장" 규칙이 이미 수동 확인 흐름 제공 |
| duplicate-checker | changelog 행 하나 추가에 중복 검증 에이전트는 과잉 |
| changelog 신규 생성 | 없으면 건너뜀. 생성 강제는 wrap의 책임 아님 |

### 핵심 인사이트

> 세션 wrap에서 가장 빈번하게 누락되는 건 **changelog 한 줄 추가**.
> 80%의 가치를 20%의 복잡도로: changelog 탐지 + 행 생성 + 사용자 확인이면 충분.

---

## 4. 1단계 구현 계획 (changelog 자동 안내)

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `my-session-wrap/skills/my-session-wrap/SKILL.md` | Step 2.5 "문서 업데이트" 추가 |
| `~/.claude/CLAUDE.md` (글로벌) | 프로젝트 초기화 시 README + changelog 의무화 |
| `my-session-wrap/.claude-plugin/plugin.json` | 2.0.0 → 2.1.0 |
| `README.md` | changelog 컬럼 "플러그인"→"범위" + 신규 항목 |
| `CLAUDE.md` (프로젝트) | changelog 용어 통일 |

### Step 2.5 동작

1. 프로젝트 루트에서 `README.md`, `CHANGELOG.md` 순서로 changelog 테이블 탐지
   - 헤더에 "날짜"/"date" + "변경"/"change" 키워드로 판별
   - 못 찾으면 → 조용히 건너뜀
2. 이번 세션 변경 기반으로 새 행 후보 생성 (기존 컬럼 구조를 동적으로 따름)
3. AskUserQuestion: "changelog 업데이트 적용" / "내용 수정" / "건너뛰기"
4. 테이블 헤더 구분선 바로 아래에 새 행 삽입

### 결정 사항

- changelog 컬럼명: "플러그인" → "범위"로 통일
- 글로벌 changelog 기본 형식: `| 날짜 | 범위 | 변경 내용 |` (3컬럼)
- 이 레포는 버전 관리 프로젝트이므로 버전 컬럼 유지: `| 날짜 | 버전 | 범위 | 변경 내용 |`

---

## 5. 후속 작업 (2단계: 문서 관리 철학 정립)

### 왜 보류했는가

changelog 구현 검토 중 더 근본적인 질문이 떠올랐다:

- team-attention의 **context.md** 개념이 유용해 보이는데, 현재 우리 환경의 handoff, CLAUDE.md, auto memory와 어떻게 구분되는가?
- **CLAUDE.md 자동 업데이트**는 위험하다고 배제했지만, 문서화·이력 추적을 중시하는 워크플로우에서 context 축적은 필요하다
- changelog, handoff, context.md, README, CLAUDE.md — 각 문서의 **역할 경계**가 명확하지 않으면 중복이 생기거나 누락이 반복됨

### 2단계 아젠다

1. **문서 관리 철학**: 컨텍스트 관리, 프로젝트 관리, 문서 관리 관점에서 통합 원칙 수립
2. **문서 역할 지도**: 각 문서(README, CLAUDE.md, context.md, handoff, changelog, auto memory)의 목적·수명·독자·갱신 주기 정의
3. **context.md 도입 여부**: team-attention 모델의 장점을 현재 환경에 맞게 변형할지 결정
4. **doc-updater 확장**: 철학이 정해진 후, changelog 외 문서 업데이트 범위 재검토
5. **계획 문서 관리 개선**: `~/.claude/plans/`의 구조적 문제 해결
   - **보존성 불안**: 임시 폴더 성격이라 언제 삭제될지 불명확
   - **검색 불가**: 영어 랜덤 제목(`sequential-cooking-teapot.md` 등)으로 프로젝트·날짜·내용 식별 불가
   - **참조 단절**: 이전 계획을 찾으려면 파일을 하나씩 열어봐야 함
   - 검토 방향: 계획 문서를 프로젝트 폴더에 저장하는 규칙, 파일명 컨벤션(한글 요약 + 날짜), 또는 wrap 시 자동 이관

### 검토할 문서 간 관계 (미정리)

```
README.md      — 외부 독자용, 프로젝트 소개 + changelog
CLAUDE.md      — AI 에이전트용, 시스템 규칙 + 프로젝트 구조
context.md     — (미도입) 프로젝트 고유 지식 축적
handoff/*.md   — 세션 간 인수인계, 단기 컨텍스트
auto memory    — AI 자동 학습, 세션 간 패턴 축적
changelog      — 변경 이력 추적
```

이 문서들의 경계와 역할을 정리하는 것이 2단계의 핵심 과제다.

---

## 6. Changelog의 가치에 대한 검토 (2026-02-25)

### 질문

> CHANGELOG.md는 결국 git 히스토리(커밋 메시지 + 날짜)와 거의 동일한 정보 아닌가? 유지하는 의미가 있나?

### 결론: 유지할 가치 있음

**git log에 없는 정보 = 버전 열**
- 어떤 커밋에서 플러그인 버전이 올라갔는지 git log만으로는 파악 불가
- marketplace.json/plugin.json 버전 변경 이력이 한눈에 보임

**접근성**
- `git log`보다 IDE에서 파일 열어 보는 게 빠름
- 마크다운 테이블이라 검색·필터링 용이

**pre-commit hook 연계**
- 커밋할 때마다 기록을 강제하는 체계와 결합
- 버전 동기화 검증(check-version-sync.js)과 함께 릴리스 품질 보장

### 형식 변천

1. 초기: README.md 내 changelog 테이블 (4열: 날짜, 버전, 플러그인, 변경 내용)
2. 플러그인 열 중복 제거 (버전 열에 이미 플러그인명 포함)
3. CHANGELOG.md로 분리 (README 비대화 방지, 유지보수 포인트 단일화)
4. 최종: 4열 (날짜, 타입, 버전, 변경 내용) — 모든 커밋 포함, 타입으로 구분
