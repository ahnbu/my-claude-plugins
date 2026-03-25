#!/usr/bin/env node
// migrate-handoff-to-yaml.mjs
// 최근 N일 이내 BQ 형식 handoff 파일을 YAML frontmatter로 일괄 변환
//
// Usage:
//   node migrate-handoff-to-yaml.mjs              # dry-run (기본)
//   node migrate-handoff-to-yaml.mjs --apply      # 실제 변환
//   node migrate-handoff-to-yaml.mjs --days 14    # 탐색 기간 변경 (기본 7일)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- CLI args ---
const APPLY = process.argv.includes("--apply");
const daysIdx = process.argv.indexOf("--days");
const DAYS = daysIdx !== -1 ? parseInt(process.argv[daysIdx + 1], 10) || 7 : 7;
const CUTOFF = Date.now() - DAYS * 24 * 60 * 60 * 1000;

const SEARCH_ROOTS = [
  "C:/Users/ahnbu/.claude",
  "D:/CloudSync",
  "D:/vibe-coding",
];

// --- Find handoff_*.md files modified within DAYS ---
function findHandoffs(roots) {
  const results = [];
  function walk(dir, depth = 0) {
    if (depth > 7) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full, depth + 1);
      } else if (st.isFile() && /^handoff_.*\.md$/.test(entry) && st.mtimeMs >= CUTOFF) {
        results.push(full);
      }
    }
  }
  for (const root of roots) {
    if (existsSync(root)) walk(root);
  }
  return results;
}

// --- Classify format ---
// yaml: starts with "---"
// bq:   has lines starting with "> (key):"
// bullet: has lines like "- **key**:"
// table: has lines with "| 항목 | 값 |" pattern
// unknown: 분류 불가
function classify(content) {
  const firstLine = content.split("\n")[0].trim();
  if (firstLine === "---") return "yaml";

  const lines = content.split("\n");
  const BQ_RE = /^>\s*(날짜|세션\s*ID|세션\s*경로|세션|경로|토큰|도구\s*호출|상태|일시|모델)\s*:/;
  if (lines.some((l) => BQ_RE.test(l.trim()))) return "bq";

  const BULLET_RE = /^-\s+\*\*(날짜|세션|session|session_id|경로|session path)\b/i;
  if (lines.some((l) => BULLET_RE.test(l.trim()))) return "bullet";

  const TABLE_RE = /^\|.*(항목|session|세션).*\|/i;
  if (lines.some((l) => TABLE_RE.test(l))) return "table";

  return "unknown";
}

// --- Parse BQ block from content, return { title, sessionNum, fields, bqStartIdx, bqEndIdx } ---
function parseBQContent(content) {
  const lines = content.split("\n");

  // Extract title from first heading line
  let title = "";
  let sessionNum = "";
  const headingLine = lines[0] || "";
  const headingMatch = headingLine.match(
    /^#\s+Handoff\s*[—\-:]\s+(.+?)(?:\s+\(세션\s+(\d+)\))?\s*$/
  );
  if (headingMatch) {
    title = headingMatch[1].trim();
    sessionNum = headingMatch[2] || "";
  }

  // Parse BQ fields
  const fields = { title, session_id: "", session_path: "", date: "", tokens_in: "", tokens_out: "", tools: "", status: "" };
  let bqStartIdx = -1;
  let bqEndIdx = -1;

  const cleanVal = (v) => v.replace(/^[`'"]+|[`'"]+$/g, "").trim();

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!/^>/.test(raw)) {
      // BQ block ended
      if (bqStartIdx !== -1 && raw.trim() !== "") break;
      continue;
    }

    if (bqStartIdx === -1) bqStartIdx = i;
    bqEndIdx = i;

    const bq = raw.replace(/^>\s*/, "").trim();
    let m;

    if ((m = bq.match(/^(?:날짜|일시)\s*:\s*(.+)/))) {
      // "2026-03-24 09:22 ~ 12:13" → just YYYY-MM-DD
      fields.date = cleanVal(m[1]).substring(0, 10);
    } else if ((m = bq.match(/^세션\s*ID\s*:\s*(.+)/))) {
      fields.session_id = cleanVal(m[1]);
    } else if ((m = bq.match(/^세션\s*:\s*(.+)/))) {
      fields.session_id = cleanVal(m[1]);
    } else if ((m = bq.match(/^세션\s*경로\s*:\s*(.+)/))) {
      fields.session_path = cleanVal(m[1]);
    } else if ((m = bq.match(/^경로\s*:\s*(.+)/))) {
      fields.session_path = cleanVal(m[1]);
    } else if ((m = bq.match(/^토큰\s*:\s*(?:입력|input)\s*([\d,]+K?)\s*\/\s*(?:출력|output)\s*([\d,]+K?)/i))) {
      fields.tokens_in = m[1].trim();
      fields.tokens_out = m[2].trim();
    } else if ((m = bq.match(/^도구\s*호출\s*:\s*(.+)/))) {
      fields.tools = cleanVal(m[1]);
    } else if ((m = bq.match(/^상태\s*:\s*(.+)/))) {
      fields.status = cleanVal(m[1]);
    }
    // 모델: skip (not in template)
  }

  return { title, sessionNum, fields, bqStartIdx, bqEndIdx };
}

// --- Build YAML frontmatter block ---
function buildFrontmatter(fields) {
  const KEYS = ["title", "date", "session_id", "session_path", "tokens_in", "tokens_out", "tools", "status"];
  const needsQuote = (v) => /[:#\[\]{},&*?|>!%@`]/.test(v) || v.includes('"');
  const lines = ["---"];
  for (const key of KEYS) {
    const val = String(fields[key] || "");
    if (val) {
      lines.push(needsQuote(val) ? `${key}: "${val.replace(/"/g, '\\"')}"` : `${key}: ${val}`);
    } else {
      lines.push(`${key}:`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

// --- Convert BQ content → YAML frontmatter content ---
function convertBQ(content) {
  const lines = content.split("\n");
  const { title, sessionNum, fields, bqStartIdx, bqEndIdx } = parseBQContent(content);

  if (bqStartIdx === -1) throw new Error("BQ 블록을 찾지 못함");

  // New heading (preserve session number if present)
  const newHeading = sessionNum
    ? `# ${title} (세션 ${sessionNum.padStart(2, "0")})`
    : `# ${title}`;

  // Keep lines after BQ block (trim leading blank lines)
  let restLines = lines.slice(bqEndIdx + 1);
  while (restLines.length > 0 && restLines[0].trim() === "") restLines.shift();

  const frontmatter = buildFrontmatter(fields);
  const newContent = `${frontmatter}\n\n${newHeading}\n\n${restLines.join("\n")}`;

  if (!newContent.startsWith("---")) throw new Error("변환 결과가 ---로 시작하지 않음");
  return newContent;
}

// ============================================================
// Main
// ============================================================
console.log(`🔍 최근 ${DAYS}일 handoff 파일 탐색 중...`);
const files = findHandoffs(SEARCH_ROOTS);
console.log(`   발견: ${files.length}건\n`);

const buckets = { yaml: [], bq: [], bullet: [], table: [], unknown: [] };
for (const f of files) {
  let content;
  try { content = readFileSync(f, "utf8"); } catch { continue; }
  buckets[classify(content)].push(f);
}

console.log("📊 포맷 분류:");
console.log(`   YAML  (skip)    : ${buckets.yaml.length}건`);
console.log(`   BQ    (변환 대상): ${buckets.bq.length}건`);
console.log(`   Bullet (경고)   : ${buckets.bullet.length}건`);
console.log(`   Table  (경고)   : ${buckets.table.length}건`);
console.log(`   Unknown(경고)   : ${buckets.unknown.length}건\n`);

// --- BQ conversion ---
if (buckets.bq.length > 0) {
  const mode = APPLY ? "✅ 실제 변환" : "🧪 dry-run";
  console.log(`🔄 BQ → YAML ${mode}:`);
  let ok = 0, fail = 0;

  for (const f of buckets.bq) {
    const content = readFileSync(f, "utf8");
    try {
      const newContent = convertBQ(content);
      const preview = newContent.split("\n").slice(0, 3).join(" | ");

      if (APPLY) {
        writeFileSync(f, newContent, "utf8");
        console.log(`   ✅ ${f}`);
      } else {
        console.log(`   → ${f}`);
        console.log(`      ${preview}`);
      }
      ok++;
    } catch (err) {
      console.log(`   ❌ FAIL: ${f}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  console.log(`\n   ${APPLY ? "변환 완료" : "변환 예정"}: ${ok}건 | 실패: ${fail}건`);
}

// --- Warnings ---
const warned = [
  ...buckets.bullet.map((f) => ({ type: "bullet ", f })),
  ...buckets.table.map((f) => ({ type: "table  ", f })),
  ...buckets.unknown.map((f) => ({ type: "unknown", f })),
];
if (warned.length > 0) {
  console.log("\n⚠️  수동 처리 필요 (미변환):");
  for (const { type, f } of warned) {
    console.log(`   [${type}] ${f}`);
  }
}

if (!APPLY && buckets.bq.length > 0) {
  console.log("\n💡 실제 변환 실행:");
  console.log("   node migrate-handoff-to-yaml.mjs --apply");
}
