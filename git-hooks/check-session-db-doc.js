"use strict";
/**
 * check-session-db-doc.js
 * pre-commit 검증: session-db.js / session-parser.js / query-sessions.js 변경 시
 * SESSION-DB.md 변경 이력 표(섹션 8)도 함께 staged 되어야 함.
 *
 * 통과 조건:
 *   - 위 소스 파일이 staged에 없으면 → 검사 생략
 *   - 위 소스 파일이 staged에 있고 SESSION-DB.md도 staged에 있으면 → 통과
 *   - 위 소스 파일이 staged에 있는데 SESSION-DB.md가 없으면 → 차단
 */

const { execSync } = require("child_process");

const SESSION_DB_SOURCES = [
  "shared/session-db.js",
  "shared/session-parser.js",
  "shared/query-sessions.js",
];

let staged;
try {
  staged = execSync("git diff --cached --name-only", { encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
} catch (err) {
  console.error(`[check-session-db-doc] git diff 실패: ${err.message}`);
  process.exit(1);
}

const changedSources = SESSION_DB_SOURCES.filter((f) => staged.includes(f));

if (changedSources.length === 0) {
  // 해당 파일 변경 없음 — 검사 불필요
  process.exit(0);
}

const sessionDbDocStaged = staged.includes("SESSION-DB.md");

if (sessionDbDocStaged) {
  process.exit(0);
}

console.error("");
console.error("✗ 커밋 차단: 세션 DB 소스가 변경되었는데 SESSION-DB.md가 포함되지 않았습니다.");
console.error("");
console.error("  변경된 파일:");
changedSources.forEach((f) => console.error(`    - ${f}`));
console.error("");
console.error("  규칙: 스키마·파일 맵·CLI 변경 시 SESSION-DB.md 섹션 8 변경 이력 표를 갱신하라.");
console.error("  조치: SESSION-DB.md 섹션 8에 변경 이력 추가 → git add SESSION-DB.md");
console.error("");
process.exit(1);
