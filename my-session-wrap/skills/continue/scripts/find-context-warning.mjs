#!/usr/bin/env node
/**
 * context-warning 탐색 스크립트
 * ~/.claude/scripts/context-warning/ 에서 cp >= 90% 기록 파일을 탐색하여
 * 가장 최근 세션을 반환한다.
 *
 * 출력: { found: boolean, session_id?, cp?, remaining?, ts? }
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const warningDir = join(homedir(), ".claude", "scripts", "context-warning");

if (!existsSync(warningDir)) {
  console.log(JSON.stringify({ found: false }));
  process.exit(0);
}

const files = readdirSync(warningDir).filter(f => f.endsWith(".json"));

if (files.length === 0) {
  console.log(JSON.stringify({ found: false }));
  process.exit(0);
}

const entries = [];
for (const f of files) {
  try {
    const data = JSON.parse(readFileSync(join(warningDir, f), "utf8"));
    if (data.session_id && data.ts) entries.push(data);
  } catch {}
}

if (entries.length === 0) {
  console.log(JSON.stringify({ found: false }));
  process.exit(0);
}

// ts 기준 최신 순 정렬
entries.sort((a, b) => new Date(b.ts) - new Date(a.ts));
console.log(JSON.stringify({ found: true, count: entries.length, sessions: entries }));
