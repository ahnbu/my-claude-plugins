#!/usr/bin/env node
// skill-context-logger.js — PostToolUse hook
// 스킬 호출을 2가지 경로로 감지하여 skill-context/<session_id>.jsonl에 기록.
//   1. Skill 도구: AI가 능동적으로 Skill tool 호출 시 (tool_input.skill에서 스킬명)
//   2. Read 도구: 슬래시 커맨드가 SKILL.md를 읽을 때 (파일 경로에서 스킬명 추출)
// cp_before: 기록 시점에 <session_id>.latest.json 파일에서 읽어 함께 저장.
// Statusline이 동일 JSONL에 cp% 레코드를 append → 전후 델타로 컨텍스트 소모 측정.

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const SKILL_CONTEXT_DIR = path.join(os.homedir(), ".claude", "scripts", "skill-context");

// SKILL.md 경로에서 스킬명 추출: .../skills/<skill-name>/SKILL.md
function extractSkillNameFromPath(filePath) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/\/skills\/([^/]+)\/SKILL\.md$/i);
  return match ? match[1] : null;
}

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;
    if (!sessionId) return;

    let skillName = null;

    if (data.tool_name === "Skill") {
      skillName = data.tool_input?.skill;
    } else if (data.tool_name === "Read") {
      skillName = extractSkillNameFromPath(data.tool_input?.file_path);
    }

    if (!skillName) return;

    fs.mkdirSync(SKILL_CONTEXT_DIR, { recursive: true });

    // 3일 초과 파일 정리 (.jsonl, .latest.json 모두)
    const cutoff = Date.now() - 3 * 86400000;
    try {
      for (const f of fs.readdirSync(SKILL_CONTEXT_DIR)) {
        const fp = path.join(SKILL_CONTEXT_DIR, f);
        try { if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp); } catch {}
      }
    } catch {}

    // cp_before: statusline이 기록한 최신 cp% 읽기
    let cpBefore = null;
    const latestFile = path.join(SKILL_CONTEXT_DIR, `${sessionId}.latest.json`);
    try {
      const latest = JSON.parse(fs.readFileSync(latestFile, "utf8"));
      cpBefore = latest.cp ?? null;
    } catch {}

    // skill 이벤트 기록
    const record = JSON.stringify({
      type: "skill",
      skill: skillName,
      source: data.tool_name === "Skill" ? "tool" : "slash",
      ts: new Date().toISOString(),
      session_id: sessionId,
      cp_before: cpBefore,
    });
    fs.appendFileSync(
      path.join(SKILL_CONTEXT_DIR, `${sessionId}.jsonl`),
      record + "\n"
    );
  } catch (_) {}
});
