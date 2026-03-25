#!/usr/bin/env node
/**
 * context-warning 탐색 스크립트
 * ~/.claude/scripts/context-warning/ 에서 cp >= 85% 기록 파일을 탐색하여
 * 세션 목록을 반환한다.
 *
 * 출력: { found: boolean, count?, sessions?: [{session_id, cp, ts, display_title, display_sub}] }
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const SHARED_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../shared");

function resolveDbPath() {
  const candidates = [
    join(SHARED_DIR, "../../plugins/marketplaces/my-claude-plugins/output/session-dashboard/sessions.db"),
    join(SHARED_DIR, "../output/session-dashboard/sessions.db"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

function fetchTitles(ids) {
  if (!ids.length) return {};
  const dbPath = resolveDbPath();
  if (!dbPath) return {};
  try {
    const db = new DatabaseSync(dbPath, { readonly: true });
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`SELECT session_id, title FROM sessions WHERE session_id IN (${placeholders})`).all(...ids);
    db.close();
    return Object.fromEntries(rows.map(r => [r.session_id, r.title]));
  } catch {
    return {};
  }
}

function toKST(ts) {
  const d = new Date(new Date(ts).getTime() + 9 * 3600 * 1000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function formatDisplay(entry) {
  const raw = entry.title || "(제목 없음)";
  const label = raw.replace(/^\d{8}_\d{4}_/, "");
  return { display: `${label} | ${entry.cp}% (${toKST(entry.ts)}) | ${entry.session_id}` };
}

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

// DB에서 title 일괄 조회
const titleMap = fetchTitles(entries.map(e => e.session_id));
for (const e of entries) {
  e.title = titleMap[e.session_id] || null;
  Object.assign(e, formatDisplay(e));
}

// ts 기준 최신 순 정렬
entries.sort((a, b) => new Date(b.ts) - new Date(a.ts));
console.log(JSON.stringify({ found: true, count: entries.length, sessions: entries }));
