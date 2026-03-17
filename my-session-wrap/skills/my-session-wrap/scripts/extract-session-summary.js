"use strict";
// my-session-wrap/scripts/extract-session-summary.js
// wrap Step 2-1.5 용 세션 요약 스크립트
// DB에서 메타데이터 + 핵심 이벤트 + gap 후보를 JSON으로 출력
//
// 사용법: node extract-session-summary.js <sessionId>
// 출력:   JSON { meta, keyEvents, gaps }

const path = require("node:path");
const os = require("node:os");
const { SessionDB } = require(path.join(
  os.homedir(),
  ".claude",
  "my-claude-plugins",
  "shared",
  "session-db.js"
));

const MAX_KEY_EVENTS = 30;
const MAX_GAPS = 10;
const MAX_SNIPPET_CHARS = 200;

const GAP_PATTERNS = [
  {
    name: "decision",
    label: "의사결정 누락 가능",
    regex: /채택|기각|트레이드오프|대안.*비교|선택.*이유|결정:/,
  },
  {
    name: "unresolved",
    label: "미해결·후속",
    regex: /TODO|FIXME|남은.*작업|미해결|제약사항|에러|블로커/,
  },
  {
    name: "lesson",
    label: "교훈·발견",
    regex: /교훈|발견|주의|삽질|실수|깨달|알게\s*됐/,
  },
];

function formatTokens(n) {
  if (!n || n === 0) return "0";
  if (n < 1000) return String(n);
  return Math.round(n / 1000) + "K";
}

function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("Usage: node extract-session-summary.js <sessionId>");
    process.exit(1);
  }

  const dbPath = path.join(
    os.homedir(),
    ".claude", "my-claude-plugins",
    "output", "session-dashboard", "sessions.db"
  );

  const db = new SessionDB(dbPath);

  try {
    // 1. 메타데이터 조회
    const row = db.db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .get(sessionId);

    if (!row) {
      // DB에 없으면 on-demand sync 시도 (실패해도 graceful)
      try {
        db.syncSingleSession(sessionId, { force: true });
      } catch {
        console.log(JSON.stringify({ error: "session not found", meta: null, keyEvents: [], gaps: [] }));
        return;
      }
      const retryRow = db.db
        .prepare("SELECT * FROM sessions WHERE session_id = ?")
        .get(sessionId);
      if (!retryRow) {
        console.log(JSON.stringify({ error: "session not found", meta: null, keyEvents: [], gaps: [] }));
        return;
      }
    }

    const r = row || db.db.prepare("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);

    const meta = {
      session_id: r.session_id,
      file_path: r.file_path || "",
      timestamp: r.timestamp,
      last_timestamp: r.last_timestamp || "",
      total_input_tokens: r.total_input_tokens || 0,
      total_output_tokens: r.total_output_tokens || 0,
      total_input_tokens_display: formatTokens(r.total_input_tokens),
      total_output_tokens_display: formatTokens(r.total_output_tokens),
      tool_names: JSON.parse(r.tool_names || "{}"),
      models: JSON.parse(r.models || "[]"),
      user_text_message_count: r.user_text_message_count || 0,
      keywords: JSON.parse(r.keywords || "[]"),
      project: r.project || "",
    };

    // 2. 이벤트 로드
    db.syncSingleSession(sessionId);
    const events = db.getEvents(sessionId);

    // 3. keyEvents 추출 — tool_use 중 Write/Edit/Bash만 + user_text
    const keyEvents = [];
    for (const e of events) {
      if (keyEvents.length >= MAX_KEY_EVENTS) break;

      if (e.kind === "tool_use") {
        const name = e.toolName || e.name || "";
        if (["Write", "Edit", "Bash", "Skill"].includes(name)) {
          const input = e.toolInput || e.input || {};
          let summary = "";
          if (name === "Write" && input.file_path) {
            summary = `Write: ${path.basename(input.file_path)}`;
          } else if (name === "Edit" && input.file_path) {
            summary = `Edit: ${path.basename(input.file_path)}`;
          } else if (name === "Bash") {
            const cmd = (input.command || "").slice(0, 80);
            summary = `Bash: ${cmd}`;
          } else if (name === "Skill") {
            summary = `Skill: ${input.skill || ""}`;
          }
          keyEvents.push({
            kind: "tool_use",
            name,
            summary,
            timestamp: e.timestamp || "",
          });
        }
      } else if (e.kind === "user_text") {
        const text = (e.text || "").slice(0, 120);
        if (text) {
          keyEvents.push({
            kind: "user_text",
            name: "user",
            summary: text,
            timestamp: e.timestamp || "",
          });
        }
      }
    }

    // 4. gaps 추출 — assistant_text / tool_result에서 패턴 매칭
    const gaps = [];
    const relevant = events.filter(
      (e) => e.kind === "assistant_text" || e.kind === "tool_result"
    );

    for (const event of relevant) {
      if (gaps.length >= MAX_GAPS) break;

      const text = event.text || event.rawText || "";
      if (!text) continue;

      for (const pattern of GAP_PATTERNS) {
        if (!pattern.regex.test(text)) continue;

        gaps.push({
          kind: pattern.name,
          label: pattern.label,
          text: text.slice(0, MAX_SNIPPET_CHARS).trim(),
        });
        break;
      }
    }

    console.log(JSON.stringify({ meta, keyEvents, gaps }));
  } finally {
    db.close();
  }
}

main();
