#!/usr/bin/env node
// capture-session-id.js — UserPromptSubmit: stdout → AI 시스템 메시지 (멀티세션 안전)

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id } = data;
    if (!session_id) return;
    console.log(`[session_id=${session_id}]`);
  } catch (_) {}
});
