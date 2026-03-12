#!/usr/bin/env node
// check-handoff.js — 세션 시작 시 24시간 이내 handoff가 있으면 /continue 안내
const fs = require("fs");
const path = require("path");

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { cwd } = data;
    if (!cwd) return;

    const handoffDir = path.join(cwd, "_handoff");
    if (!fs.existsSync(handoffDir)) return;

    const files = fs.readdirSync(handoffDir)
      .filter((f) => /^handoff_\d{8}_\d{2}_.+\.md$/.test(f))
      .sort()
      .reverse();

    if (files.length === 0) return;

    const latest = files[0];
    const stat = fs.statSync(path.join(handoffDir, latest));
    const hoursSince = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);

    if (hoursSince <= 24) {
      console.log(`📋 최근 handoff 감지: ${latest} (${Math.round(hoursSince)}시간 전)`);
      console.log(`   이전 세션을 이어가려면 /continue 를 사용하세요.`);
    }
  } catch (_) {}
});
