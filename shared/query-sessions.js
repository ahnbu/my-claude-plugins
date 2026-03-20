"use strict";
// shared/query-sessions.js — 세션DB 공용 CLI 쿼리 스크립트
// 사용법: node query-sessions.js <command> [args] [options]
// 인자 없이 실행 시 사용법 출력 (stderr)
// 출력: JSON (stdout), 에러·사용법은 stderr

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

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

Options:
  --scope <claude|codex|plan|gemini|antigravity>  타입 필터 (기본: all)
  --limit <N>                  결과 수 제한 (기본: 10)
  --help                       이 도움말 표시

Output: JSON array to stdout. Error/usage to stderr.

Examples:
  node query-sessions.js search "doc-save" --scope claude --limit 5
  node query-sessions.js recent 10 --scope codex
  node query-sessions.js get abc123
  node query-sessions.js by-tool "session-find"
  node query-sessions.js by-project "global-rule-improve"
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { command: null, positional: [], scope: null, limit: 10 };

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
    file_path: row.file_path || "",
    plan_slug: row.plan_slug || null,
  };
}

function cmdSearch(db, keyword, opts) {
  const scopeFilter = buildScopeFilter(opts.scope);
  const like = `%${keyword}%`;
  const rows = db.prepare(`
    SELECT * FROM sessions
    WHERE (title LIKE ? OR keywords LIKE ? OR tool_names LIKE ? OR first_message LIKE ?)
    ${scopeFilter}
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(like, like, like, like, opts.limit);
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
