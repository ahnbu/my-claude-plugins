#!/usr/bin/env node
// capture-session-id.js
// - UserPromptSubmit: stdout → AI 시스템 메시지로 주입 (멀티세션 안전)
// - SessionStart: .claude/.current-session-id 파일 기록 (단일세션 fallback)
const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id, cwd, hook_event_name } = data;
    if (!session_id) return;

    // UserPromptSubmit: stdout → AI 시스템 메시지 (멀티세션 안전)
    if (hook_event_name === "UserPromptSubmit") {
      console.log(`[session_id=${session_id}]`);
    }

    // SessionStart: 파일 기록 (단일세션 fallback)
    if (hook_event_name === "SessionStart" && cwd) {
      const dest = path.join(cwd, ".claude", ".current-session-id");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, session_id);
    }
  } catch (_) {}
});
