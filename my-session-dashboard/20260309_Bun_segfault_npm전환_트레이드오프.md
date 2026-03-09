# Bun Segfault 해결: npm 전환 트레이드오프 분석

> 저장일: 2026-03-09 | 원본: `C:/Users/ahnbu/.claude/plans/quizzical-splashing-walrus.md`
> 세션 경로: `C:/Users/ahnbu/.claude/projects/C--Users-ahnbu--claude-my-claude-plugins-my-session-dashboard/11a0f0bd-3e98-49f8-94c4-8d5351630d19.jsonl`

## 발단: 사용자 요청

기존 분석 문서(`20260309_Bun_segfault_반복중단_원인분석_및_재발방지계획_by_클로드_2차.md`)에서 "npm 설치 전환이 최우선 권고"라는 결론이 있었음. 사용자가 두 가지를 질문:

1. **"WSL이 아니라 npm 방식으로 전환하는데, 트레이드오프가 없는가?"**
2. Perplexity 자료를 제시하며 팩트체크 요청 + 비교표 스킬 활용 요청

Perplexity 자료 요지: "PowerShell Native가 대부분 워크플로우에 최적, WSL은 풀스택·Docker 한정, 내부 스크립트가 cross-platform으로 재작성되어 Unix 명령어 에러 없이 동작"

---

## Context

Bun v1.3.10 Windows N-API vtable corruption(oven-sh/bun#27471)으로 동일 작업 5회 반복 크래시 발생. 기존 분석 문서에서 "npm 전환"을 최우선 권고했으나, **2026년 2월 npm 설치 deprecated + 내부 코드 Bun 전제 전환**이라는 새 사실이 확인되어 트레이드오프를 재평가한다.

---

## 1. Perplexity 주장 팩트체크

| # | 주장 | 판정 | 핵심 근거 |
|---|------|------|-----------|
| 1 | 내부 스크립트 cross-platform 재작성 (grep→glob, sed→node 등) | ❌ **부정확** | Git Bash를 내부 셸로 사용. 스크립트 재작성 근거 없음 |
| 2 | zenn.dev "모든 스크립트 수정됨" 인용 | ❌ **부정확** | 해당 기사에 그런 내용 없음. 트러블슈팅 가이드일 뿐 |
| 3 | PowerShell Native가 공식 1순위 | ⚠️ **부분적** | 설치 진입점으로는 1순위, 내부 런타임은 Git Bash |
| 4 | WSL npm install 20초 vs Native 2분 | ⚠️ **방향만 맞음** | ext4 vs NTFS 차이 실재하나, 구체 수치는 미검증 |
| 5 | Bun native binary 기본 설치 | ✅ **정확** | Anthropic이 Bun 인수(2025.12), native installer가 공식 |
| 6 | `irm install.ps1 \| iex` 공식 방법 | ✅ **정확** | 공식 문서에 명시 |
| 7 | Antigravity WSL 불안정 | ⚠️ **부분적** | Google IDE. WSL 설치 이슈 실재하나 설정으로 해결 가능 |

---

## 2. npm 전환의 숨겨진 트레이드오프 (기존 분석에서 누락)

### 핵심 발견: npm 설치는 2026년 2월부로 deprecated

| 항목 | 내용 | 심각도 |
|------|------|--------|
| **`Bun is not defined` 에러** | npm 설치 시 Node.js로 실행되지만, 내부 코드가 `Bun` 전역 객체를 호출. 세션 중 반복 에러 발생 (Issue #21931) | ❌ **높음** |
| **deprecated 상태** | 2026.02부터 npm 설치 비권장. 패키지는 게시되지만 Bun 전용 코드 경로 증가 중 | ❌ **높음** |
| **업데이트 수동** | native는 백그라운드 자동 업데이트, npm은 `npm update -g` 수동 실행 필요 | ⚠️ 중간 |
| **이중 설치 충돌** | native + npm 동시 존재 시 PATH 충돌 (Issue #10280) | ⚠️ 중간 |

### 이전 분석의 "트레이드오프 거의 없다"는 판단 → 수정 필요

```
이전: "npm 전환에 실질적 트레이드오프는 거의 없다"
수정: npm은 deprecated이며 Bun 전용 코드 호환성 문제 존재.
      segfault는 피하지만 새로운 불안정성을 도입할 수 있다.
```

---

## 3. 실행 가능한 4가지 옵션 비교

| 항목 | ① Native 유지 (현상태) | ② npm 전환 | ③ WSL 홈 | ④ Bun 업데이트 대기 |
|------|----------------------|-----------|---------|-------------------|
| segfault 해결 | ❌ 미해결 | ✅ Bun 우회 | ✅ Linux binary | ❌ 미정 |
| 안정성 | ░░░░░░ segfault | ██░░░░ `Bun is not defined` | ██████ Linux 안정 | ░░░░░░ 현재 동일 |
| 설정 호환 | ██████ 변경 없음 | ████░░ PATH 조정 필요 | ██░░░░ 경로 재매핑 | ██████ 변경 없음 |
| MCP/플러그인 호환 | ██████ | ████░░ | ░░░░░░ 재설정 필요 | ██████ |
| 전환 비용 | ██████ 없음 | ████░░ 5분 | ░░░░░░ 30분+ | ██████ 없음 |
| 장기 지속 가능성 | ████░░ 패치 대기 | ░░░░░░ deprecated | ████░░ 유지보수 비용 | ██████ 근본 해결 시 |
| 자동 업데이트 | ✅ 지원 | ❌ 수동 | ⚠️ 별도 관리 | ✅ 지원 |
| Chrome/Antigravity | ✅ 완벽 | ✅ 완벽 | ❌ 미지원 | ✅ 완벽 |

---

## 4. 권고안

### 단기 (지금 당장): ② npm 전환 — 단, 리스크 인지하고 진행

- segfault가 **작업 불가 수준**이므로 npm 전환이 현실적 선택
- `Bun is not defined` 에러는 **크래시 유발이 아닌 경고 수준**일 가능성 높음 (실사용 검증 필요)
- 전환 후 1~2세션 안정성 모니터링

### 중기: Bun 패치 릴리스 시 native로 복귀

- oven-sh/bun#27471 fix가 릴리스되면 즉시 native로 복귀
- npm은 deprecated이므로 장기 유지 부적절

### WSL은 비권장

- 파일시스템 성능 이점은 있지만, MCP 서버·플러그인·Chrome 통합·Antigravity 등 현재 워크플로우와 충돌 과다
- 풀스택·Docker 워크플로우가 아닌 이상 전환 비용 대비 이점 부족

---

## 5. 실행 절차 (npm 전환 선택 시)

```powershell
# 1. 기존 native binary 비활성화
Rename-Item "$env:USERPROFILE\.local\bin\claude.exe" "claude.exe.bak"

# 2. npm으로 설치
npm install -g @anthropic-ai/claude-code

# 3. 경로 확인 (npm 경로가 나와야 함)
where claude

# 4. 버전 확인
claude --version

# 5. 안정성 테스트 — 기존 segfault 재현 시나리오 실행
```

### 검증 항목

- [ ] `where claude`가 npm 경로를 가리키는지
- [ ] 세션 시작 시 `Bun is not defined` 에러 발생 여부 및 빈도
- [ ] 기존 MCP 서버·플러그인 정상 동작 확인
- [ ] 30분 이상 세션 유지 시 크래시 없는지
- [ ] 자동 업데이터가 `claude.exe`를 복원하지 않는지

---

## Sources

- [oven-sh/bun#27471 — N-API vtable corruption](https://github.com/oven-sh/bun/issues/27471)
- [anthropics/claude-code#21931 — "Bun is not defined" on npm install](https://github.com/anthropics/claude-code/issues/21931)
- [Claude Code 공식 설치 문서](https://code.claude.com/docs/en/setup)
- [Bun is joining Anthropic](https://bun.com/blog/bun-joins-anthropic)
- [npm deprecation](https://github.com/anthropics/claude-code-security-review/issues/58)

---

## 검증계획과 실행결과

| 검증 항목 | 검증 방법 | 결과 | 비고 |
|-----------|-----------|------|------|
| npm 경로 우선 | `where claude` → npm 경로 확인 | ⏳ 미실행 | |
| `Bun is not defined` 에러 여부 | 세션 시작 후 stderr 모니터링 | ⏳ 미실행 | 경고 vs 크래시 구분 필요 |
| MCP 서버 정상 동작 | 기존 MCP 서버 각각 호출 확인 | ⏳ 미실행 | |
| 30분+ 세션 안정성 | 기존 segfault 재현 작업 반복 | ⏳ 미실행 | 핵심 검증 항목 |
| 자동 업데이터 복원 여부 | claude 업데이트 후 `where claude` 재확인 | ⏳ 미실행 | 문서에 언급된 함정 |
| PATH 충돌 없음 | native + npm 동시 존재 시 충돌 확인 | ⏳ 미실행 | rename 후 해결되어야 함 |

---

## 보충: 대화 중 검토 내용

### 비교 검토: npm vs WSL — 이전 판단 vs 팩트체크 후

> 이 섹션은 plan 파일 작성 전 대화에서 논의된 초기 분석 내용입니다.

#### 1차 분석 (팩트체크 전)

세션 초반에 "npm 전환에 실질적 트레이드오프 거의 없다"는 결론이 내려졌고, WSL 대비 npm의 이점이 강조됨:

| 항목 | npm (Windows native) | WSL2 |
|------|---------------------|------|
| 전환 비용 | 5분 | WSL 미설치 시 30분+, 재부팅 필요 |
| 파일시스템 접근 | Windows 경로 그대로 | `/mnt/c/` 변환 필요, cross-FS 성능 저하 |
| 기존 설정 호환 | `~/.claude/` 그대로 유지 | 별도 Linux home에 설정 재구성 |
| MCP 서버·플러그인 | 현재 경로 모두 유지 | 경로 재매핑 or 재설치 필요 |
| IDE 통합 | 변경 없음 | VS Code Remote-WSL 등 추가 설정 |

#### 2차 분석 (팩트체크 후) — 결론 수정

Perplexity 주장 팩트체크 + 웹 리서치를 통해 다음 새 사실 발견:
- **npm 설치는 2026.02 deprecated** — Anthropic의 Bun 인수(2025.12) 이후 native installer가 공식화
- **`Bun is not defined` 에러** — npm으로 설치 시 Node.js 런타임에서 실행되나, 코드 내부가 `Bun` 전역 객체를 호출 (Issue #21931)
- **Claude Code 내부 스크립트 "cross-platform 재작성" 주장은 허위** — 실제로는 Git Bash를 내부 셸로 사용

### 의사결정 근거: npm 전환 선택 이유

`Bun is not defined` 에러는 있지만, 현재 상황(작업 불가 수준의 segfault)과 비교하면:
- segfault = 세션 1~36분 내 강제 종료, 작업 손실
- `Bun is not defined` = 세션 지속 가능, 에러 로그만 발생(추정)

**임시 우회책으로서의 npm 전환은 정당**하지만, deprecated 경로이므로 장기 유지는 부적절. Bun 패치(bun#27471) 후 native 복귀가 최종 목표.

### 검토하고 제외한 대안

| 대안 | 제외 이유 |
|------|-----------|
| **WSL 홈** | MCP 서버·플러그인·Chrome 통합·Antigravity 모두 재설정 필요. 전환 비용 과다. npm install 속도 이점은 Claude Code 사용 패턴(API 대기 중심)에서 무의미 |
| **Native 유지** | segfault가 미패치 상태(2026.03 현재). 5회 반복 크래시로 작업 불가 수준 |
| **Bun 버전 다운그레이드** | N-API vtable corruption은 Bun 버전이 아닌 Claude Code의 Windows TUI + child process I/O 동시 실행 메커니즘과의 상호작용이 원인. 버전 다운으로 해결된다는 근거 없음 |
| **orphaned process 정리** | RAM 고갈 방지에는 효과적이나 크래시 자체를 막지 못함. 임시방편에 불과 |
