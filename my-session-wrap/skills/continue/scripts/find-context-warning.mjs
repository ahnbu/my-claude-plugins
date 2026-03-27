#!/usr/bin/env node
/**
 * context-warning + handoff 통합 탐색 스크립트
 * ~/.claude/scripts/context-warning/ 에서 cp >= 85% 기록 파일과
 * --handoff-dir 로 지정된 디렉토리의 handoff_*.md 파일을 함께 탐색하여
 * 통합 세션 목록을 반환한다.
 *
 * 사용법:
 *   node find-context-warning.mjs [--session-id <sid>] [--handoff-dir <path>]
 *
 * 출력: {
 *   found: boolean,
 *   count?: number,
 *   sections?: {
 *     context_limit: [{session_id, cp, ts, display, resolved?, handoff_path?}],
 *     handoff_only:  [{session_id?, title, created, file_path, display}]
 *   }
 * }
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync, statSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

const SHARED_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../shared");

// --session-id 인자 파싱
const sidArgIdx = process.argv.indexOf("--session-id");
const currentSessionId = sidArgIdx !== -1 ? process.argv[sidArgIdx + 1] : null;

// --handoff-dir 인자 파싱
const handoffArgIdx = process.argv.indexOf("--handoff-dir");
const handoffDir = handoffArgIdx !== -1 ? process.argv[handoffArgIdx + 1] : null;

const TTL_WARNING_MS = 6 * 60 * 60 * 1000;    // context-warning JSON: 6시간
const TTL_PENDING_MS = 10 * 60 * 1000;         // .pending_* 파일: 10분
const TTL_HANDOFF_MS = 3 * 24 * 60 * 60 * 1000; // handoff: 3일

function resolveDbPath() {
  const candidates = [
    join(SHARED_DIR, "../../plugins/marketplaces/my-claude-plugins/output/session-dashboard/sessions.db"),
    join(SHARED_DIR, "../output/session-dashboard/sessions.db"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

function fetchSessionInfo(ids) {
  if (!ids.length) return {};
  const dbPath = resolveDbPath();
  if (!dbPath) return {};
  try {
    const db = new DatabaseSync(dbPath, { readonly: true });
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`SELECT session_id, title, last_message FROM sessions WHERE session_id IN (${placeholders})`).all(...ids);
    db.close();
    return Object.fromEntries(rows.map(r => [r.session_id, { title: r.title, last_message: r.last_message || "" }]));
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
  const prefix = entry.resolved ? "(완료) " : "";
  const suffix = entry.resolved_doc ? ` → ${entry.resolved_doc}` : "";
  const lastMsgSummary = entry.last_message
    ? entry.last_message.substring(0, 50).replace(/\n/g, " ")
    : "";
  const mid = lastMsgSummary ? ` | ${lastMsgSummary}` : "";
  return { display: `${prefix}${label}${mid} | ${entry.cp}% (${toKST(entry.ts)})${suffix}` };
}

/**
 * handoff_*.md 파일에서 frontmatter 파싱
 * 반환: [{ session_id?, title, created, file_path, display }]
 */
function scanHandoffs(dir) {
  if (!dir || !existsSync(dir)) return [];
  let files;
  try {
    files = readdirSync(dir).filter(f => f.startsWith("handoff_") && f.endsWith(".md"));
  } catch {
    return [];
  }
  // 파일명 역순 정렬 (최신순)
  files.sort((a, b) => b.localeCompare(a));

  const result = [];
  for (const f of files) {
    const filePath = join(dir, f);
    try {
      const content = readFileSync(filePath, "utf8");
      const normalized = content.replace(/\r\n/g, "\n");
      const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];
      const get = (key) => {
        const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
        return m ? m[1].trim() : null;
      };
      const session_id = get("session_id");
      const title = get("title") || f.replace(/^handoff_\d{8}_\d{2}_/, "").replace(/\.md$/, "");
      const created = get("created") || "";
      // 3일 TTL 필터 (created 필드 기준)
      if (created) {
        const createdMs = new Date(created).getTime();
        if (!isNaN(createdMs) && now - createdMs > TTL_HANDOFF_MS) continue;
      }
      result.push({
        session_id,
        title,
        created,
        file_path: filePath,
        display: `${title} (${created})`,
      });
    } catch {}
  }
  return result;
}

// ── context-warning 디렉토리 처리 ──────────────────────────────────────────

const warningDir = join(homedir(), ".claude", "scripts", "context-warning");
const docSaveDir = join(homedir(), ".claude", "scripts", "doc-save");

// TTL 정리 (warningDir 존재할 때만)
const now = Date.now();
if (existsSync(warningDir)) {
  for (const f of readdirSync(warningDir)) {
    const fPath = join(warningDir, f);
    try {
      if (f.startsWith(".pending_")) {
        const { mtimeMs } = statSync(fPath);
        if (now - mtimeMs > TTL_PENDING_MS) unlinkSync(fPath);
      } else if (f.endsWith(".json")) {
        const data = JSON.parse(readFileSync(fPath, "utf8"));
        if (data.ts && now - new Date(data.ts).getTime() > TTL_WARNING_MS) unlinkSync(fPath);
      }
    } catch {}
  }
}

// doc-save JSON TTL 정리 (6시간)
if (existsSync(docSaveDir)) {
  for (const f of readdirSync(docSaveDir)) {
    if (!f.endsWith(".json")) continue;
    const fPath = join(docSaveDir, f);
    try {
      const data = JSON.parse(readFileSync(fPath, "utf8"));
      if (data.ts && now - new Date(data.ts).getTime() > TTL_WARNING_MS) unlinkSync(fPath);
    } catch {}
  }
}

// context-warning entries 수집
const entries = [];
if (existsSync(warningDir)) {
  const files = readdirSync(warningDir).filter(f => f.endsWith(".json"));
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(join(warningDir, f), "utf8"));
      if (data.session_id && data.ts) entries.push(data);
    } catch {}
  }
}

// DB에서 title + last_message 일괄 조회
const sessionInfoMap = fetchSessionInfo(entries.map(e => e.session_id));
for (const e of entries) {
  const info = sessionInfoMap[e.session_id] || {};
  e.title = info.title || null;
  e.last_message = info.last_message || "";
  Object.assign(e, formatDisplay(e));
}

// ts 기준 최신순 정렬
entries.sort((a, b) => new Date(b.ts) - new Date(a.ts));

// ── handoff 스캔 ──────────────────────────────────────────────────────────

const handoffs = scanHandoffs(handoffDir);
const cwSessionIds = new Set(entries.map(e => e.session_id));
const handoffOnly = [];

for (const h of handoffs) {
  if (h.session_id && cwSessionIds.has(h.session_id)) {
    // context-warning 항목에 handoff_path 추가
    const cwEntry = entries.find(e => e.session_id === h.session_id);
    if (cwEntry) cwEntry.handoff_path = h.file_path;
  } else {
    handoffOnly.push(h);
  }
}

// ── 종합 판단 ──────────────────────────────────────────────────────────────

const totalCount = entries.length + handoffOnly.length;

if (totalCount === 0) {
  console.log(JSON.stringify({ found: false }));
  process.exit(0);
}

// .pending_<session_id> 파일 생성 (현재 세션 ID가 있을 때)
if (currentSessionId && existsSync(warningDir)) {
  try {
    const allSessionIds = [
      ...entries.map(e => e.session_id),
      ...handoffOnly.filter(h => h.session_id).map(h => h.session_id),
    ];
    writeFileSync(
      join(warningDir, `.pending_${currentSessionId}`),
      JSON.stringify(allSessionIds)
    );
  } catch {}
}

console.log(JSON.stringify({
  found: true,
  count: totalCount,
  sections: {
    context_limit: entries,
    handoff_only: handoffOnly,
  },
}));
