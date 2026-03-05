#!/usr/bin/env node
// capture-session-id.js — 세션 ID를 .claude/.current-session-id에 기록
// [DEBUG] CLAUDE_ENV_FILE 가용성 확인용 — 검증 후 제거 예정
const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || process.env.USERPROFILE;
const debugLog = path.join(HOME, "session-id-debug.log");

function appendLog(msg) {
  try { fs.appendFileSync(debugLog, msg + "\n"); } catch (_) {}
}

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  // [DEBUG] CLAUDE_ENV_FILE 및 CLAUDE 관련 환경변수 전체 기록
  const envFile = process.env.CLAUDE_ENV_FILE || "(없음)";
  const claudeEnvVars = Object.keys(process.env)
    .filter(k => k.startsWith("CLAUDE"))
    .map(k => `  ${k}=${process.env[k]}`)
    .join("\n") || "  (없음)";

  appendLog([
    `=== ${new Date().toISOString()} ===`,
    `CLAUDE_ENV_FILE=${envFile}`,
    `CLAUDE-related env vars:`,
    claudeEnvVars,
    `stdin=${input.length} bytes`,
    `---`,
    ""
  ].join("\n"));

  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id, cwd } = data;

    appendLog(`session_id=${session_id || "(없음)"}\ncwd=${cwd || "(없음)"}\n---\n`);

    if (session_id && cwd) {
      const dest = path.join(cwd, ".claude", ".current-session-id");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, session_id);
    }
  } catch (e) {
    appendLog(`ERROR: ${e.message}\n---\n`);
  }
});
