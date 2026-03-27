"use strict";
// shared/query-sessions.js — 세션DB 공용 CLI 쿼리 스크립트
// 사용법: node query-sessions.js <command> [args] [options]
// 인자 없이 실행 시 사용법 출력 (stderr)
// 출력: JSON (stdout), 에러·사용법은 stderr

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  processSession,
  processCodexSession,
  processGeminiSession,
  processAntigravitySession,
} = require("./session-parser.js");

// DB 경로 해결: marketplace(정본) → my-claude-plugins(폴백)
function resolveDbPath() {
  const candidates = [
    // 정본: marketplace 경로 (__dirname 기준)
    path.join(__dirname, "../../plugins/marketplaces/my-claude-plugins/output/session-dashboard/sessions.db"),
    // 폴백: 소스 레포 경로
    path.join(__dirname, "../output/session-dashboard/sessions.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function printUsage() {
  process.stderr.write(`Usage: node query-sessions.js <command> [args] [options]

Commands:
  search <keyword>     키워드 검색 (title, keywords, tool_names, first_message)
  get <session_id>     세션 메타데이터 단건 조회 (alias: session)
  recent [N]           최근 N개 세션 (기본 10)
  by-tool <tool>       특정 도구/스킬 사용 세션
  by-project <name>    특정 프로젝트 세션
  doc <session_id>     세션 대화 내용 마크다운 출력

Options:
  --scope <claude|codex|plan|gemini|antigravity>  AI 소스 필터 (기본: 전체)
  --limit <N>                  반환 세션 수 제한 (기본: 10) / doc: 출력 메시지 수 제한 (기본: 전체)
  --detailed                   doc 전용: tool input JSON 포함
  --no-sync                    doc 전용: DB 갱신 생략 (완료 세션에서만 안전, ~0.7s 절감)
  --help                       이 도움말 표시

Output: JSON array to stdout (search/get/recent/by-tool/by-project). Markdown to stdout (doc). Error/usage to stderr.

Examples:
  node query-sessions.js search "doc-save" --scope claude --limit 5
  node query-sessions.js recent 10 --scope codex
  node query-sessions.js get abc123
  node query-sessions.js by-tool "session-find"
  node query-sessions.js by-project "global-rule-improve"
  node query-sessions.js doc abc123
  node query-sessions.js doc abc123 --limit 20
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { command: null, positional: [], scope: null, limit: 10, limitExplicit: false, detailed: false, noSync: false };

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      printUsage();
      process.exit(0);
    } else if (a === "--scope" && args[i + 1]) {
      opts.scope = args[++i];
    } else if (a === "--limit" && args[i + 1]) {
      opts.limit = parseInt(args[++i], 10) || 10;
      opts.limitExplicit = true;
    } else if (a === "--detailed") {
      opts.detailed = true;
    } else if (a === "--no-sync") {
      opts.noSync = true;
    } else if (!opts.command) {
      opts.command = a;
    } else {
      opts.positional.push(a);
    }
    i++;
  }
  return opts;
}

function buildScopeFilter(scope) {
  if (!scope) return "";
  if (scope === "claude") return "AND type = 'session'";
  if (scope === "codex") return "AND type = 'codex'";
  if (scope === "plan") return "AND type = 'plan'";
  if (scope === "gemini") return "AND type = 'gemini'";
  if (scope === "antigravity") return "AND type = 'antigravity'";
  return "";
}

function rowToResult(row) {
  return {
    session_id: row.session_id,
    type: row.type,
    title: row.title || "",
    keywords: (() => { try { return JSON.parse(row.keywords || "[]"); } catch { return []; } })(),
    timestamp: row.timestamp,
    last_timestamp: row.last_timestamp || null,
    project: row.project || "",
    tool_names: (() => { try { return JSON.parse(row.tool_names || "{}"); } catch { return {}; } })(),
    first_message: row.first_message || "",
    last_message: row.last_message || "",
    file_path: row.file_path || "",
    plan_slug: row.plan_slug || null,
  };
}

function cmdSearch(db, keyword, opts) {
  const scopeFilter = buildScopeFilter(opts.scope);
  const like = `%${keyword}%`;
  const rows = db.prepare(`
    SELECT * FROM sessions
    WHERE (title LIKE ? OR keywords LIKE ? OR tool_names LIKE ? OR first_message LIKE ? OR last_message LIKE ?)
    ${scopeFilter}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(like, like, like, like, like, opts.limit);
  return rows.map(rowToResult);
}

function cmdGet(db, sessionId) {
  const row = db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
  if (!row) return null;
  return rowToResult(row);
}

function cmdRecent(db, n, opts) {
  const scopeFilter = buildScopeFilter(opts.scope);
  const rows = db.prepare(`
    SELECT * FROM sessions
    WHERE 1=1 ${scopeFilter}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(n || opts.limit);
  return rows.map(rowToResult);
}

function cmdByTool(db, tool, opts) {
  const scopeFilter = buildScopeFilter(opts.scope);
  const like = `%${tool}%`;
  const rows = db.prepare(`
    SELECT * FROM sessions
    WHERE tool_names LIKE ?
    ${scopeFilter}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(like, opts.limit);
  return rows.map(rowToResult);
}

// ── doc 커맨드 헬퍼 ──

function syncSingleMessages(db, sessionId, filePath, sessionType) {
  let result = null;
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    if (sessionType === "session") {
      result = processSession(filePath);
    } else if (sessionType === "codex") {
      result = processCodexSession(filePath);
    } else if (sessionType === "gemini") {
      // projectRoot: chats의 상위 디렉토리
      const projectRoot = path.dirname(path.dirname(filePath));
      result = processGeminiSession(filePath, projectRoot);
    } else {
      // plan, antigravity: on-demand sync 미지원, DB 캐시 사용
      return false;
    }
  } catch (err) {
    process.stderr.write(`Warning: messages sync 실패 (${sessionType}) — ${err.message}\n`);
    return false;
  }
  if (!result) return false;

  db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
  const stmt = db.prepare(
    "INSERT INTO messages (session_id, seq, role, subtype, text, timestamp, tools) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (let i = 0; i < result.messages.length; i++) {
    const msg = result.messages[i];
    stmt.run(
      sessionId, i, msg.role,
      msg.subtype || null,
      msg.text || null,
      msg.timestamp || null,
      msg.tools ? JSON.stringify(msg.tools) : null
    );
  }
  return true;
}

function formatTokensShort(n) {
  if (!n) return "0";
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}K`;
  return String(n);
}

function messagesToMarkdown(metaRow, messages, detailed) {
  const lines = [];
  const title = metaRow.title || metaRow.session_id;
  const project = metaRow.project || "—";
  const totalTokens = (metaRow.total_input_tokens || 0) + (metaRow.total_output_tokens || 0);

  // 소요 시간 계산
  let durationStr = "";
  if (metaRow.timestamp && metaRow.last_timestamp) {
    const diffMs = new Date(metaRow.last_timestamp) - new Date(metaRow.timestamp);
    if (diffMs > 0) {
      const diffMin = Math.round(diffMs / 60000);
      durationStr = diffMin >= 60
        ? `${(diffMin / 60).toFixed(1)}h`
        : `${diffMin}min`;
    }
  }

  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`- **프로젝트:** ${project}`);
  if (durationStr) lines.push(`- **소요시간:** ${durationStr}`);
  lines.push(`- **토큰:** ${formatTokensShort(totalTokens)}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.subtype === "tool_result") continue;
      lines.push("## User");
      lines.push("");
      if (msg.text) lines.push(msg.text.trimEnd());
    } else if (msg.role === "assistant") {
      lines.push("## Assistant");
      lines.push("");
      if (msg.text) lines.push(msg.text.trimEnd());
      if (msg.tools && msg.tools.length > 0) {
        lines.push("");
        for (const tool of msg.tools) {
          if (detailed && tool.input) {
            const inputStr = JSON.stringify(tool.input);
            const truncated = inputStr.length > 300 ? inputStr.slice(0, 300) + "…" : inputStr;
            lines.push(`> 🔧 **${tool.name}**: \`${truncated}\``);
          } else {
            lines.push(`> 🔧 ${tool.name}`);
          }
        }
      }
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function cmdDoc(db, sessionId, opts) {
  const row = db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
  if (!row) return null;

  // on-demand messages sync
  if (!opts.noSync && row.file_path) {
    syncSingleMessages(db, sessionId, row.file_path, row.type);
  }

  // messages 조회
  const useLimit = opts.limitExplicit ? opts.limit : 0;
  let msgRows;
  if (useLimit > 0) {
    msgRows = db.prepare(
      "SELECT role, subtype, text, timestamp, tools FROM messages WHERE session_id = ? ORDER BY seq DESC LIMIT ?"
    ).all(sessionId, useLimit);
    msgRows.reverse();
  } else {
    msgRows = db.prepare(
      "SELECT role, subtype, text, timestamp, tools FROM messages WHERE session_id = ? ORDER BY seq"
    ).all(sessionId);
  }

  const messages = msgRows.map(r => {
    const m = { role: r.role };
    if (r.subtype) m.subtype = r.subtype;
    if (r.text) m.text = r.text;
    if (r.timestamp) m.timestamp = r.timestamp;
    if (r.tools) m.tools = JSON.parse(r.tools);
    return m;
  });

  return messagesToMarkdown(row, messages, opts.detailed);
}

function cmdByProject(db, projectName, opts) {
  const scopeFilter = buildScopeFilter(opts.scope);
  const like = `%${projectName}%`;
  const rows = db.prepare(`
    SELECT * FROM sessions
    WHERE project LIKE ?
    ${scopeFilter}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(like, opts.limit);
  return rows.map(rowToResult);
}

function main() {
  const opts = parseArgs(process.argv);

  if (!opts.command) {
    printUsage();
    process.exit(0);
  }

  const dbPath = resolveDbPath();
  if (!dbPath) {
    process.stderr.write("Error: sessions.db not found. DB가 아직 생성되지 않았거나 경로가 변경되었습니다.\n");
    process.exit(1);
  }

  let db;
  try {
    db = new DatabaseSync(dbPath, { open: true });
  } catch (err) {
    process.stderr.write(`Error: DB 열기 실패 — ${err.message}\n`);
    process.exit(1);
  }

  // 스키마 마이그레이션 (컬럼 미존재 시 추가)
  try { db.exec("ALTER TABLE sessions ADD COLUMN last_message TEXT"); } catch (_) {}

  try {
    let result;

    switch (opts.command) {
      case "search": {
        const keyword = opts.positional[0];
        if (!keyword) {
          process.stderr.write("Error: search <keyword> — 키워드를 지정하세요.\n");
          process.exit(1);
        }
        result = cmdSearch(db, keyword, opts);
        break;
      }
      case "session":
      case "get": {
        const sessionId = opts.positional[0];
        if (!sessionId) {
          process.stderr.write("Error: get <session_id> — session_id를 지정하세요.\n");
          process.exit(1);
        }
        result = cmdGet(db, sessionId);
        if (result === null) {
          process.stdout.write(JSON.stringify({ found: false, session_id: sessionId }) + "\n");
          return;
        }
        break;
      }
      case "recent": {
        const n = parseInt(opts.positional[0], 10) || opts.limit;
        result = cmdRecent(db, n, opts);
        break;
      }
      case "by-tool": {
        const tool = opts.positional[0];
        if (!tool) {
          process.stderr.write("Error: by-tool <tool> — 도구명을 지정하세요.\n");
          process.exit(1);
        }
        result = cmdByTool(db, tool, opts);
        break;
      }
      case "by-project": {
        const projectName = opts.positional[0];
        if (!projectName) {
          process.stderr.write("Error: by-project <name> — 프로젝트명을 지정하세요.\n");
          process.exit(1);
        }
        result = cmdByProject(db, projectName, opts);
        break;
      }
      case "doc": {
        const sessionId = opts.positional[0];
        if (!sessionId) {
          process.stderr.write("Error: doc <session_id> — session_id를 지정하세요.\n");
          process.exit(1);
        }
        const markdown = cmdDoc(db, sessionId, opts);
        if (markdown === null) {
          process.stderr.write(`Error: 세션을 찾을 수 없습니다 — ${sessionId}\n`);
          process.exit(1);
        }
        process.stdout.write(markdown + "\n");
        return;
      }
      default:
        process.stderr.write(`Error: 알 수 없는 커맨드 "${opts.command}"\n`);
        printUsage();
        process.exit(1);
    }

    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (err) {
    process.stderr.write(`Error: 쿼리 실패 — ${err.message}\n`);
    process.exit(1);
  } finally {
    try { db.close(); } catch {}
  }
}

main();
