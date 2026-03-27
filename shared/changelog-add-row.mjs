#!/usr/bin/env node
/**
 * shared/changelog-add-row.mjs
 * CHANGELOG.md의 테이블 최상단에 새 행을 삽입한다.
 *
 * 사용법:
 *   node changelog-add-row.mjs --repo <path> --type <type> --scope <scope> --desc "<desc>" [--version <v>]
 *   node changelog-add-row.mjs --file <CHANGELOG.md 절대경로> --row "| 2026-03-25 | feat | - | 설명 |"
 *
 * Options:
 *   --repo     레포 루트 경로 (CHANGELOG.md를 자동 탐색)
 *   --file     CHANGELOG.md 절대경로 (--repo 대신 직접 지정)
 *   --type     커밋 타입 (feat|fix|docs|refactor|chore|add 등)
 *   --scope    변경 범위 (스킬명, 플러그인명 등)
 *   --desc     변경 내용 설명
 *   --version  플러그인 버전 (생략 시 "-")
 *   --row      raw 행 문자열 (이 옵션만 있으면 --type/--scope/--desc 불필요)
 *   --dry-run  실제 파일 수정 없이 삽입될 행만 출력
 *
 * 출력: 삽입된 행 (stdout), 오류 (stderr + exit 1)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
        args[key] = argv[i + 1];
        i++;
      } else {
        args[key] = true; // boolean flag
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

// CHANGELOG.md 경로 결정
let changelogPath;
if (args.file) {
  changelogPath = args.file;
} else if (args.repo) {
  changelogPath = join(args.repo, "CHANGELOG.md");
} else {
  process.stderr.write(
    "Error: --repo 또는 --file 중 하나를 지정해야 합니다.\n"
  );
  process.stderr.write(
    "Usage: changelog-add-row.mjs --repo <path> --type <type> --scope <scope> --desc <desc> [--version <v>]\n"
  );
  process.exit(1);
}

if (!existsSync(changelogPath)) {
  // CHANGELOG.md 없으면 템플릿으로 자동 생성
  const templatePath = "C:/Users/ahnbu/CHANGELOG_TEMPLATE.md";
  if (existsSync(templatePath)) {
    writeFileSync(changelogPath, readFileSync(templatePath, "utf8"), "utf8");
  } else {
    writeFileSync(
      changelogPath,
      "# CHANGELOG\n\n| 변경시점 | 구분 | 버전 | 변경 내용 | 변경사유/목적 |\n|---------|------|------|---------|-------------|\n",
      "utf8"
    );
  }
  process.stderr.write(`✔ CHANGELOG.md 자동 생성: ${changelogPath}\n`);
}

// 삽입할 행 결정
let newRow;
if (args.row) {
  newRow = args.row;
} else {
  if (!args.type || !args.scope || !args.desc) {
    process.stderr.write(
      "Error: --type, --scope, --desc 가 모두 필요합니다 (--row를 사용하지 않는 경우).\n"
    );
    process.exit(1);
  }
  const today = new Date().toISOString().split("T")[0];
  const version = args.version || "-";
  newRow = `| ${today} | ${args.type} | ${version} | ${args.desc} |`;
}

if (args["dry-run"]) {
  process.stdout.write(newRow + "\n");
  process.exit(0);
}

// CHANGELOG.md 읽기 및 삽입 위치 탐색
const content = readFileSync(changelogPath, "utf8");
const lines = content.split("\n");

// separator 행(|---|) 찾기 → 그 다음 줄에 삽입
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (trimmed.startsWith("|") && trimmed.includes("---")) {
    insertIdx = i + 1;
    break;
  }
}

if (insertIdx === -1) {
  process.stderr.write(
    `CHANGELOG.md에서 테이블 구분선(|---|...)을 찾을 수 없습니다: ${changelogPath}\n`
  );
  process.exit(1);
}

lines.splice(insertIdx, 0, newRow);
writeFileSync(changelogPath, lines.join("\n"), "utf8");

process.stdout.write(newRow + "\n");
