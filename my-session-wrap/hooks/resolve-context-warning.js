#!/usr/bin/env node
// resolve-context-warning.js — PostToolUse hook
// query-sessions.js get <uuid> 호출 감지 시, .pending_<session_id> 기반으로
// context-warning JSON에 resolved=true 마킹

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const WARNING_DIR = path.join(os.homedir(), ".claude", "scripts", "context-warning");
const DOC_SAVE_DIR = path.join(os.homedir(), ".claude", "scripts", "doc-save");

// UUID v4 패턴
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });

process.stdin.on("end", () => {
  if (!input) return;
  try {
    const data = JSON.parse(input);

    // Bash 도구만 처리
    if (data.tool_name !== "Bash") return;

    const command = data.tool_input?.command || "";
    const sessionId = data.session_id;
    if (!sessionId) return;

    // .pending_<session_id> 존재 확인 (평소 세션의 빠른 탈출 경로)
    const pendingPath = path.join(WARNING_DIR, `.pending_${sessionId}`);
    if (!fs.existsSync(pendingPath)) return;

    // query-sessions.js get <uuid> 패턴 매칭
    if (!command.includes("query-sessions.js") || !command.includes(" get ")) return;
    const uuidMatch = command.match(UUID_RE);
    if (!uuidMatch) return;
    const selectedId = uuidMatch[0];

    // .pending 목록에 포함 여부 확인
    let pendingIds;
    try {
      pendingIds = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
    } catch {
      return;
    }
    if (!Array.isArray(pendingIds) || !pendingIds.includes(selectedId)) return;

    // context-warning JSON 업데이트
    const warningFile = path.join(WARNING_DIR, `${selectedId}.json`);
    if (!fs.existsSync(warningFile)) return;

    let warningData;
    try {
      warningData = JSON.parse(fs.readFileSync(warningFile, "utf8"));
    } catch {
      return;
    }

    warningData.resolved = true;
    warningData.resolved_at = new Date().toISOString();

    // doc-save 경로 확인
    const docSaveFile = path.join(DOC_SAVE_DIR, `${selectedId}.json`);
    if (fs.existsSync(docSaveFile)) {
      try {
        const docData = JSON.parse(fs.readFileSync(docSaveFile, "utf8"));
        if (docData.doc_path) warningData.resolved_doc = docData.doc_path;
      } catch {}
    }

    // context-warning JSON 저장
    try {
      fs.writeFileSync(warningFile, JSON.stringify(warningData, null, 2));
    } catch {
      return;
    }

    // .pending에서 처리된 uuid 제거
    const remaining = pendingIds.filter(id => id !== selectedId);
    if (remaining.length === 0) {
      try { fs.unlinkSync(pendingPath); } catch {}
    } else {
      try { fs.writeFileSync(pendingPath, JSON.stringify(remaining)); } catch {}
    }

  } catch (_) {}
});
