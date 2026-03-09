#!/usr/bin/env node
// inject-plugin-guidelines.js — my-claude-plugins 폴더에서 세션 시작 시
// 배포 절차를 강조 주입하여 준수 유도.

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const { cwd } = data;
    if (!cwd) return;
    if (!cwd.replace(/\\/g, "/").includes("my-claude-plugins")) return;

    console.log(`
⚠️  [플러그인 개발 폴더 감지] 작업 전 아래 절차를 반드시 확인하라.

━━━ 배포 절차 ━━━
1. git push
2. CLAUDECODE="" claude plugin marketplace update my-claude-plugins
3. CLAUDECODE="" claude plugin update <plugin-name>@my-claude-plugins

⚠️  순서 위반 금지. 임의 판단으로 단계 스킵 금지.
⚠️  ~/.claude/plugins/marketplaces/ 직접 수정 금지.
    `);
  } catch (_) {}
});
