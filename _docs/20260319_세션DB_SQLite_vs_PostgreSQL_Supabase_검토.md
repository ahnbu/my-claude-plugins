---
date: 2026-03-19
scope: current-session
session: "ff8a68d1-ccf5-4d83-8159-c0aa9b03fbb1"
session_path: "C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins/ff8a68d1-ccf5-4d83-8159-c0aa9b03fbb1.jsonl"
plan: "C:/Users/ahnbu/.claude/plans/jiggly-cuddling-candle.md"
source_video: "https://youtube.com/watch?v=OAqhSronDvs"
source_summary: "D:/CloudSync/40_AI/ai-outputs/yt-summary-save/20260315_가장_쉬운_AI_활용_개발_with_Boaz_Supabase_공식_스킬_요약결과.md"
---

# 세션 DB: SQLite vs PostgreSQL/Supabase 전환 검토

## 발단: 사용자 요청

YouTube 영상 "[Supabase 공식 스킬 설치하면, Claude Code가 쓴 SQL이 100배 빨라집니다](https://youtube.com/watch?v=OAqhSronDvs)" (가장 쉬운 AI 활용 개발 with Boaz, 2026.03.15) 요약 결과를 바탕으로, 현재 세션 대시보드 프로젝트의 DB 전환 여부와 Supabase 스킬의 가치를 검토.

세 가지 질문:
1. 현재 `node:sqlite` 기반 DB를 PostgreSQL로 전환하는 것이 좋은가?
2. Supabase 스킬이 독자적 가치가 있는가? 순수 PostgreSQL 대비 이점은? 플랫폼 의존성은?
3. 향후 유사 작업에서 Node.js SQLite vs PostgreSQL 등 DB 옵션 선택 가이드

## 영상 핵심 내용

- **Supabase Postgres Best Practices 스킬**: 2026.01.21 출시, Claude Code/Codex/Cursor에서 SQL 최적화 규칙 31개를 자동 적용
- **"100배 성능 향상"**: Supabase 측 제시 수치. 대형 테이블 인덱스 누락 시 성능 격차 기준
- **MCP vs 스킬 비유**: MCP = "핸들(실행 도구)", 스킬 = "운전 교습(가이드라인)"
- **8개 카테고리, 31개 룰**: Critical 임팩트 — Query Performance, Connection Management, Security
- **on-demand 룰 로딩**: 모든 규칙을 한꺼번에 로드하지 않고 카테고리별 개별 파일로 분리, 필요한 룰만 Read하여 컨텍스트 절약

### 영상 주의사항

- "100배"는 대형 테이블 + 인덱스 완전 누락이라는 극단적 시나리오의 수치
- "스킬 활용해서"라는 명시적 프롬프트가 필요 (자동 트리거 불완전)
- 31개 룰 중 Supabase 특화(RLS, Edge Functions 등) 룰이 섞여 있어 범용 PG 튜닝 커버리지 한계

저장된 요약/자막 파일:
| 파일 | 경로 |
|------|------|
| 요약결과 | `D:\CloudSync\40_AI\ai-outputs\yt-summary-save\20260315_가장_쉬운_AI_활용_개발_with_Boaz_Supabase_공식_스킬_요약결과.md` |
| 자막원본(txt) | `D:\CloudSync\40_AI\ai-outputs\yt-summary-save\자막원본\20260315_가장_쉬운_AI_활용_개발_with_Boaz_Supabase_공식_스킬_자막원본.txt` |
| 자막원본(vtt) | `D:\CloudSync\40_AI\ai-outputs\yt-summary-save\자막원본\20260315_가장_쉬운_AI_활용_개발_with_Boaz_Supabase_공식_스킬_자막원본vtt.vtt` |

## 현재 아키텍처 (검토 전제)

| 항목 | 값 |
|------|-----|
| 기술 | `node:sqlite` 내장 모듈 (Node.js 22.5+) |
| 저널 모드 | WAL |
| DB 경로 | `output/session-dashboard/sessions.db` |
| 스키마 | sessions, messages, events, plan_contents (4테이블) |
| 데이터 소스 | Claude/Plan/Codex/Gemini JSONL/JSON → 파싱 → SQLite |
| 조회 방식 | CLI (`query-sessions.js`) + HTML 대시보드 |
| 레퍼런스 | `SESSION-DB.md` (스키마·파일 맵·동기화 메커니즘) |

## 작업 상세내역

### Q1. SQLite → PostgreSQL 전환이 좋은가?

**결론: 전환 불필요. 현재 SQLite가 최적.**

| 기준 | SQLite (현재) | PostgreSQL |
|------|--------------|------------|
| 사용 적합성 | ✅ 로컬 1인 사용, 읽기 중심 | ❌ 과잉 — 서버 프로세스 필요 |
| 배포 복잡도 | ✅ 제로 — `node:sqlite` 내장 | ❌ PG 서버 설치·관리 필요 |
| 성능 | ✅ 수천 세션에 충분 | 이 규모에선 차이 없음 |
| 동시 접속 | 1인 사용이므로 무관 | ✅ 다중 접속 시 유리 |
| 이식성 | ✅ DB 파일 하나 = 백업·이동 | ❌ dump/restore 필요 |
| 비용 효율 | ██████ | ░░░░░░ |
| 코드 변경량 | ✅ 변경 없음 | ❌ 전면 리라이트 |

*정렬 기준: 1인 로컬 도구에서의 운용 부담과 실질 이점 차이*

전환이 불필요한 이유:
- **문제-해결 미스매치**: PostgreSQL의 강점(동시 쓰기, 복잡한 조인, RBAC, 레플리카)은 현재 프로젝트에서 필요하지 않음
- **현재 아키텍처가 이미 정답**: JSONL → 파싱 → 로컬 SQLite → CLI/HTML 조회라는 파이프라인은 1인 개발 도구로서 최소 복잡도
- **WAL 모드 + 증분 sync**로 이미 충분한 성능 확보
- PostgreSQL 전환 시 서버 프로세스 관리, 연결 풀링, 인증 설정 등 **운영 부담만 증가**

### Q2. Supabase 스킬의 독자적 가치

**결론: 스킬 자체는 유용하지만, 현재 프로젝트와 무관. 플랫폼 의존성은 없음.**

영상에서 소개된 "Supabase Postgres Best Practices 스킬"은:
- **PostgreSQL 베스트 프랙티스 가이드라인** (31개 룰)을 Claude Code가 on-demand로 참조하는 구조
- 실행 도구(MCP)가 아닌 **지식 주입(스킬)** — "운전 교습"에 해당
- 스킬 설치 자체로는 Supabase 플랫폼 의존성이 생기지 않음

| 질문 | 답변 |
|------|------|
| 순수 PostgreSQL에도 적용되나? | ⚠️ 대부분 적용 가능하나, RLS·Edge Functions 등 Supabase 특화 룰 포함 |
| 플랫폼 의존성이 생기나? | ✅ 아니오 — 스킬은 텍스트 가이드라인일 뿐, SDK/API 연동 없음 |
| 범용 PG 튜닝을 대체하나? | ❌ 파티셔닝, vacuum 전략, 쿼리 플래너 등 고급 튜닝은 미포함 |
| 현재 프로젝트에 필요한가? | ❌ SQLite 사용 중이므로 PG 스킬 자체가 적용 대상 아님 |

**on-demand 룰 로딩 구조의 참고 가치**: 31개 룰을 카테고리별 **개별 파일**로 분리하여, 메인 `SKILL.md`에는 인덱스만 두고 Claude가 작업 맥락에 따라 해당 카테고리 파일만 Read하여 컨텍스트 토큰을 절약하는 설계. 현재 플러그인 스킬(`SKILL.md` 단일 파일)이 비대해질 경우 적용 가능한 패턴.

### Q3. 향후 DB 선택 가이드

| 기준 | SQLite | PostgreSQL (자체 호스팅) | Supabase (호스팅 PG) |
|------|--------|------------------------|---------------------|
| 적합 시나리오 | ✅ 로컬 도구, 1인 사용, 임베디드 | 다중 사용자, 서버 앱 | ✅ 빠른 프로토타이핑, 풀스택 앱 |
| 접근성 | ██████ | ██░░░░ | ████░░ |
| 동시 접속 | ░░░░░░ | ██████ | ██████ |
| 운영 부담 (효율) | ██████ | ░░░░░░ | ████░░ |
| 비용 효율 | ██████ | ██░░░░ | ████░░ (Free tier 있음) |
| 확장성 | ██░░░░ | ██████ | ██████ |
| 생태계 (Auth, Storage 등) | ░░░░░░ | ██░░░░ | ██████ |

*정렬 기준: 1인 개발자가 사이드 프로젝트에서 의사결정할 때의 우선순위 — 접근성 > 운영 부담 > 비용*

#### 선택 의사결정 트리

```
프로젝트 유형 판단
├── 로컬 CLI 도구 / 1인 사용 / 임베디드
│   └── → SQLite (node:sqlite, better-sqlite3)
│
├── 웹 앱 / 다중 사용자 / API 서버
│   ├── Auth·Storage·Realtime 필요?
│   │   ├── Yes → Supabase (호스팅 PG + BaaS)
│   │   └── No → PostgreSQL 직접 운용 or 경량 BaaS
│   │
│   └── 규모?
│       ├── 프로토타입·MVP → Supabase Free tier
│       └── 프로덕션·대규모 → 자체 PG or 클라우드 PG
│
└── 키-값 캐시 / 임시 데이터
    └── → JSON 파일 or Redis (DB 불필요)
```

#### 핵심 원칙

1. **"서버가 필요 없으면 SQLite"** — 가장 자주 맞는 답
2. **다중 사용자가 쓰기 시작하면 PostgreSQL** — SQLite의 유일한 약점은 동시 쓰기
3. **Supabase는 "PostgreSQL + BaaS"** — Auth, Storage, Edge Functions가 필요할 때 가치 발생. DB만 쓸 거면 오버킬

## 의사결정 기록

- 결정: **현재 세션 대시보드 프로젝트는 SQLite 유지**
- 근거: 1인 로컬 도구에서 PostgreSQL의 강점이 발현되지 않으며, 전환 시 운영 복잡도만 증가
- 트레이드오프: 향후 다중 사용자/웹 서비스 전환 시 DB 마이그레이션 필요하지만, 현재 규모에서는 해당 시나리오 가능성 극히 낮음

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| 현재 SQLite 성능 병목 여부 | 세션 수 증가 시 쿼리 응답시간 측정 | ⏳ 미실행 | 수천 세션까지는 문제 없을 것으로 예상 |
| Supabase 스킬 룰 범용성 | 31개 룰 중 Supabase 특화 vs 범용 PG 룰 비율 확인 | ⏳ 미실행 | 영상 자막만으로는 구체 비율 확인 불가 |
| on-demand 룰 로딩 패턴 적용 가능성 | 현재 스킬 중 비대한 SKILL.md 식별 | ⏳ 미실행 | 현재 스킬 대부분 단일 파일로 충분한 크기 |

## 리스크 및 미해결 이슈

- 현재 `node:sqlite`는 Node.js Experimental 기능 — 향후 API 변경 가능성 (낮음, 이미 안정적 사용 중)
- Supabase 스킬의 31개 룰 중 범용 PG에 적용 가능한 룰 비율은 미확인 (향후 PG 프로젝트 시작 시 확인)

## 다음 액션

- 현재 프로젝트: 추가 액션 없음 (SQLite 유지)
- 향후 PG 기반 웹 앱 개발 시: 위 의사결정 트리 참조하여 DB 선택
- 스킬 비대화 시: Supabase 스킬의 on-demand 룰 로딩 패턴 참고 검토

## 참고: Plan 원문

> 원본: C:/Users/ahnbu/.claude/plans/jiggly-cuddling-candle.md

# 세션 DB: SQLite vs PostgreSQL/Supabase 전환 검토

## Context

현재 세션 대시보드는 **`node:sqlite` (Node.js 22.5+ 내장)** 기반으로, JSONL/JSON 소스 파일을 파싱해 로컬 SQLite DB에 저장하고 CLI/HTML 대시보드로 조회하는 구조. 영상에서 소개된 Supabase Postgres Best Practices 스킬이 현재 프로젝트에 적용 가능한지, PostgreSQL 전환이 필요한지를 검토한다.

---

## 1. SQLite → PostgreSQL 전환이 좋은가?

### 결론: **전환 불필요. 현재 SQLite가 최적.**

| 기준 | SQLite (현재) | PostgreSQL |
|------|--------------|------------|
| 사용 적합성 | ✅ 로컬 1인 사용, 읽기 중심 | ❌ 과잉 — 서버 프로세스 필요 |
| 배포 복잡도 | ✅ 제로 — `node:sqlite` 내장 | ❌ PG 서버 설치·관리 필요 |
| 성능 | ✅ 수천 세션에 충분 | 이 규모에선 차이 없음 |
| 동시 접속 | 1인 사용이므로 무관 | ✅ 다중 접속 시 유리 |
| 이식성 | ✅ DB 파일 하나 = 백업·이동 | ❌ dump/restore 필요 |
| 비용 효율 | ██████ | ░░░░░░ |
| 코드 변경량 | ✅ 변경 없음 | ❌ 전면 리라이트 |

*정렬 기준: 1인 로컬 도구에서의 운용 부담과 실질 이점 차이*

### 왜 전환이 불필요한가

- **문제-해결 미스매치**: PostgreSQL의 강점(동시 쓰기, 복잡한 조인, RBAC, 레플리카)은 현재 프로젝트에서 필요하지 않음
- **현재 아키텍처가 이미 정답**: JSONL → 파싱 → 로컬 SQLite → CLI/HTML 조회라는 파이프라인은 1인 개발 도구로서 최소 복잡도
- **WAL 모드 + 증분 sync**로 이미 충분한 성능 확보
- PostgreSQL 전환 시 서버 프로세스 관리, 연결 풀링, 인증 설정 등 **운영 부담만 증가**

---

## 2. Supabase 스킬의 독자적 가치

### 결론: **스킬 자체는 유용하지만, 현재 프로젝트와 무관. 플랫폼 의존성은 없음.**

### 스킬의 본질

영상에서 소개된 "Supabase Postgres Best Practices 스킬"은:
- **PostgreSQL 베스트 프랙티스 가이드라인** (31개 룰)을 Claude Code가 on-demand로 참조하는 구조
- 실행 도구(MCP)가 아닌 **지식 주입(스킬)** — "운전 교습"에 해당
- 스킬 설치 자체로는 Supabase 플랫폼 의존성이 생기지 않음

### 가치 판단

| 질문 | 답변 |
|------|------|
| 순수 PostgreSQL에도 적용되나? | ⚠️ 대부분 적용 가능하나, RLS·Edge Functions 등 Supabase 특화 룰 포함 |
| 플랫폼 의존성이 생기나? | ✅ 아니오 — 스킬은 텍스트 가이드라인일 뿐, SDK/API 연동 없음 |
| 범용 PG 튜닝을 대체하나? | ❌ 파티셔닝, vacuum 전략, 쿼리 플래너 등 고급 튜닝은 미포함 |
| 현재 프로젝트에 필요한가? | ❌ SQLite 사용 중이므로 PG 스킬 자체가 적용 대상 아님 |

### 스킬 구조의 참고 가치

스킬의 **on-demand 룰 로딩 구조**는 현재 플러그인 스킬 설계(`SKILL.md` 기반)와 동일한 패턴. 31개 룰을 카테고리별로 분리해 필요 시만 로드하는 설계는 컨텍스트 절약 패턴으로 참고할 만함.

---

## 3. 향후 DB 선택 가이드

| 기준 | SQLite | PostgreSQL (자체 호스팅) | Supabase (호스팅 PG) |
|------|--------|------------------------|---------------------|
| 적합 시나리오 | ✅ 로컬 도구, 1인 사용, 임베디드 | 다중 사용자, 서버 앱 | ✅ 빠른 프로토타이핑, 풀스택 앱 |
| 접근성 | ██████ | ██░░░░ | ████░░ |
| 동시 접속 | ░░░░░░ | ██████ | ██████ |
| 운영 부담 (적을수록 유리→효율) | ██████ | ░░░░░░ | ████░░ |
| 비용 효율 | ██████ | ██░░░░ | ████░░ (Free tier 있음) |
| 확장성 | ██░░░░ | ██████ | ██████ |
| 생태계 (Auth, Storage 등) | ░░░░░░ | ██░░░░ | ██████ |

*정렬 기준: 1인 개발자가 사이드 프로젝트에서 의사결정할 때의 우선순위 — 접근성 > 운영 부담 > 비용*

### 선택 의사결정 트리

```
프로젝트 유형 판단
├── 로컬 CLI 도구 / 1인 사용 / 임베디드
│   └── → SQLite (node:sqlite, better-sqlite3)
│
├── 웹 앱 / 다중 사용자 / API 서버
│   ├── Auth·Storage·Realtime 필요?
│   │   ├── Yes → Supabase (호스팅 PG + BaaS)
│   │   └── No → PostgreSQL 직접 운용 or 경량 BaaS
│   │
│   └── 규모?
│       ├── 프로토타입·MVP → Supabase Free tier
│       └── 프로덕션·대규모 → 자체 PG or 클라우드 PG
│
└── 키-값 캐시 / 임시 데이터
    └── → JSON 파일 or Redis (DB 불필요)
```

### 핵심 원칙

1. **"서버가 필요 없으면 SQLite"** — 가장 자주 맞는 답
2. **다중 사용자가 쓰기 시작하면 PostgreSQL** — SQLite의 유일한 약점은 동시 쓰기
3. **Supabase는 "PostgreSQL + BaaS"** — Auth, Storage, Edge Functions가 필요할 때 가치 발생. DB만 쓸 거면 오버킬

---

## 종합 권고

현재 세션 대시보드 프로젝트는 **SQLite 유지가 정답**. 전환 시 얻는 이점이 없고 운영 복잡도만 증가한다.

Supabase 스킬은 **PostgreSQL을 사용하는 프로젝트에서** 유용하며, 스킬 설치 자체로 플랫폼 lock-in은 없다. 다만 현재 프로젝트에는 적용 대상이 아니다.

향후 웹 앱이나 다중 사용자 서비스를 만들 때 PostgreSQL/Supabase를 검토하면 된다.
