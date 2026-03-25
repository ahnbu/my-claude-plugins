---
title: isMeta 스킬 본문 대화내역 제외
date: 2026-03-19
session_id: 6d7f64cf-8870-4c34-9acd-5c2971ac97dd
session_path:
tokens_in:
tokens_out:
tools:
status:
---

# isMeta 스킬 본문 대화내역 제외

## 완료된 작업

### `shared/session-parser.js` — isMeta 스킬 본문 필터링 (1줄 추가)

- **변경**: L271-272에 `if (entry.isMeta) continue;` 추가
- **효과**: Skill 발동 시 주입되는 SKILL.md 전체 본문(`isMeta: true` user 메시지)이 DB·HTML·TOC·copyDoc 모두에서 제외됨
- **근거**: Skill 사용 사실은 assistant 턴의 `tool_use { name: "Skill" }`로 이미 추적되므로 본문 저장 불필요
- **검증**: `node my-session-dashboard/build.js` 빌드 정상 완료 (1865개 항목)

## 미완료 / 후속 작업

- L273의 `entry.isMeta ? "meta"` subtype 분기가 dead code가 됨 → 향후 정리 시 제거 가능 (기능 영향 없음)
- 대시보드 브라우저에서 Skill 사용 세션 육안 확인 미실시 (빌드 검증만 완료)

## 파일 변경 목록

| 파일 | 변경 |
|------|------|
| `shared/session-parser.js` | L271-272 `if (entry.isMeta) continue;` 추가 |
