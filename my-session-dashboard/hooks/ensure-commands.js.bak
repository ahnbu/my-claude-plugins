#!/usr/bin/env node
// ensure-commands.js — my-session-dashboard 플러그인 커맨드 자동 등록 및 갱신
const fs = require("fs");
const path = require("path");

const PLUGIN_NAME = "my-session-dashboard";
const PLUGIN_MARKER = `plugin: ${PLUGIN_NAME}`;

const PLUGIN_ROOT = path.resolve(__dirname, "..");
const COMMANDS_SRC = path.join(PLUGIN_ROOT, "commands");
const COMMANDS_DEST = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude",
  "commands"
);

if (!fs.existsSync(COMMANDS_SRC)) {
  process.exit(0);
}

fs.mkdirSync(COMMANDS_DEST, { recursive: true });

const created = [];
const skipped = [];

for (const file of fs.readdirSync(COMMANDS_SRC)) {
  if (!file.endsWith(".md")) continue;
  const src = path.join(COMMANDS_SRC, file);
  const dest = path.join(COMMANDS_DEST, file);
  const commandName = "/" + file.replace(".md", "");
  const srcContent = fs.readFileSync(src, "utf8");

  if (!fs.existsSync(dest)) {
    // 파일 없음 → 설치
    fs.copyFileSync(src, dest);
    created.push(commandName);
  } else {
    const destContent = fs.readFileSync(dest, "utf8");
    if (destContent.includes(PLUGIN_MARKER)) {
      // 내 플러그인이 설치한 파일 → 내용 비교 후 자동 갱신
      if (srcContent !== destContent) {
        fs.copyFileSync(src, dest);
        created.push(`${commandName} (updated)`);
      }
    } else {
      // 다른 플러그인/사용자 설정 → 경고 출력, 스킵
      skipped.push(commandName);
    }
  }
}

if (created.length > 0) {
  console.log(`[${PLUGIN_NAME}] 커맨드 자동 등록: ${created.join(", ")}`);
}

if (skipped.length > 0) {
  console.log("");
  console.log(`⚠️  [${PLUGIN_NAME}] 커맨드 충돌 감지 — 기존 파일 유지됨`);
  console.log("─".repeat(60));
  for (const commandName of skipped) {
    console.log(`충돌 커맨드: ${commandName}`);
    console.log(`  현재 파일이 다른 플러그인/사용자 설정으로 등록되어 있습니다.`);
    console.log(`  ${PLUGIN_NAME} 버전으로 교체하려면:`);
    console.log(`    해당 파일을 삭제 후 Claude Code를 재시작하세요.`);
    console.log(`    파일 경로: ${path.join(COMMANDS_DEST, commandName.slice(1) + ".md")}`);
  }
  console.log("─".repeat(60));
}
