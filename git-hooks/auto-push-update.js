#!/usr/bin/env node
/**
 * post-commit hook: 플러그인 변경 커밋 시 자동 push + plugin update
 *
 * 문서 전용 커밋(_docs/, _handoff/, 루트 .md)은 스킵.
 * shared/ 변경 시 모든 플러그인 업데이트.
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");

// 변경 파일 목록 취득
let changedFiles;
try {
  changedFiles = execSync("git diff --name-only HEAD~1 HEAD", { cwd: repoRoot })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
} catch (_) {
  // 최초 커밋 등 HEAD~1이 없는 경우
  changedFiles = execSync("git diff --name-only --cached", { cwd: repoRoot })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
}

if (changedFiles.length === 0) process.exit(0);

// 문서 전용 커밋 판정 (스킵 대상)
const SKIP_PREFIXES = ["_docs/", "_handoff/", ".claude/"];
const isDocOnly = changedFiles.every((f) => {
  if (SKIP_PREFIXES.some((p) => f.startsWith(p))) return true;
  // 루트 레벨 .md 파일
  if (!f.includes("/") && f.endsWith(".md")) return true;
  return false;
});

if (isDocOnly) {
  console.log("[post-commit] 문서 전용 커밋 — push/update 스킵");
  process.exit(0);
}

// marketplace.json 읽기
let marketplace;
try {
  marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
} catch (err) {
  console.error("[post-commit] marketplace.json 읽기 실패:", err.message);
  process.exit(0);
}

const allPlugins = marketplace.plugins.map((p) => ({
  name: p.name,
  dir: p.source.replace(/^\.?\//, ""), // "./my-session-wrap" → "my-session-wrap"
}));

// 변경된 플러그인 판정
const sharedChanged = changedFiles.some((f) => f.startsWith("shared/"));
let pluginsToUpdate;

if (sharedChanged) {
  pluginsToUpdate = allPlugins.map((p) => p.name);
} else {
  const matched = new Set();
  for (const file of changedFiles) {
    for (const plugin of allPlugins) {
      if (file.startsWith(plugin.dir + "/") || file === plugin.dir) {
        matched.add(plugin.name);
      }
    }
  }
  pluginsToUpdate = [...matched];
}

if (pluginsToUpdate.length === 0) {
  console.log("[post-commit] 플러그인 변경 없음 — push/update 스킵");
  process.exit(0);
}

console.log("[post-commit] 플러그인 변경 감지:", pluginsToUpdate.join(", "));

function run(cmd, opts = {}) {
  console.log("[post-commit] >", cmd);
  const result = spawnSync(cmd, { shell: true, stdio: "inherit", ...opts });
  if (result.status !== 0) {
    console.error("[post-commit] 실패 (exit", result.status + ")");
    return false;
  }
  return true;
}

// 1. git push
if (!run("git push")) {
  console.error("[post-commit] push 실패 — plugin update 스킵");
  process.exit(0);
}

// 2. marketplace update
run('CLAUDECODE="" claude plugin marketplace update my-claude-plugins');

// 3. 플러그인별 update
for (const name of pluginsToUpdate) {
  run(`CLAUDECODE="" claude plugin update ${name}@my-claude-plugins`);
}

console.log("[post-commit] 완료");
process.exit(0);
