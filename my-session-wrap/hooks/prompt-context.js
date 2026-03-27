#!/usr/bin/env node
// prompt-context.js — UserPromptSubmit: 세션 ID + /wrap 시 handoff 스크립트 경로 제공

const path = require("path");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { session_id, prompt } = data;
    if (session_id) console.log(`[session_id=${session_id}]`);
  } catch (_) {}
});
