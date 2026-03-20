#!/usr/bin/env node
// build.js — Claude Code JSONL 세션을 self-contained 대시보드 HTML로 변환
// Phase 3: SQLite DB 기반 증분 빌드 (session-db.js 사용)
const fs = require("fs");
const path = require("path");

const CLAUDE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude"
);
const DIST_DIR = path.join(__dirname, "..", "output", "session-dashboard");
const DB_PATH = path.join(DIST_DIR, "sessions.db");

const { SessionDB } = require("../shared/session-db.js");

function main() {
  console.log("Claude Session Dashboard — 빌드 시작\n");

  const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(
      `❌ Claude 프로젝트 디렉토리를 찾을 수 없습니다: ${PROJECTS_DIR}`
    );
    process.exit(1);
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const htmlSrc = path.join(__dirname, "index.html");
  const htmlDest = path.join(DIST_DIR, "index.html");

  // DB 동기화
  const db = new SessionDB(DB_PATH);
  const stats = db.sync({ verbose: true });
  // Antigravity는 sync() 기본 제외 → 별도 동기화
  const agStats = db.syncAntigravity({ verbose: false });
  stats.antigravityNew = agStats.antigravityNew || 0;
  stats.antigravityCached = agStats.antigravityCached || 0;

  // 변경 없고 HTML 이미 존재하면 rebuild 생략
  const totalNew = stats.claudeNew + stats.planNew + stats.codexNew + (stats.geminiNew || 0) + (stats.antigravityNew || 0);
  if (totalNew === 0 && fs.existsSync(htmlDest)) {
    db.close();
    console.log("✅ 변경 없음 — 기존 HTML 유지");
    console.log(`📁 출력: ${htmlDest}`);
    console.log(`\n🌐 브라우저에서 열기: ${htmlDest}`);
    return;
  }

  // 메타 + 데이터 조회
  const allMeta = db.getAllMeta();

  const sessionsData = {};
  for (const meta of allMeta) {
    if (meta.type === "plan") {
      sessionsData[meta.sessionId] = db.getPlanContent(meta.sessionId);
    } else {
      sessionsData[meta.sessionId] = db.getMessages(meta.sessionId);
    }
  }

  // Build self-contained HTML
  const metaJson = JSON.stringify(allMeta).replace(/<\//g, "<\\/");
  const dataJson = JSON.stringify(sessionsData).replace(/<\//g, "<\\/");
  let html = fs.readFileSync(htmlSrc, "utf8");
  const dataScript = `<script>
window.__SESSIONS_META__ = ${metaJson};
window.__SESSIONS_DATA__ = ${dataJson};
</script>`;
  // indexOf + substring 사용 ($ 특수문자 안전 처리)
  const placeholder = "<!-- __SESSION_DATA__ -->";
  const phIdx = html.indexOf(placeholder);
  html = html.substring(0, phIdx) + dataScript + html.substring(phIdx + placeholder.length);
  fs.writeFileSync(htmlDest, html);

  db.close();

  let logLine = `✅ Claude ${stats.claudeNew}개 신규 | ${stats.claudeCached}개 캐시 | 플랜 ${stats.planNew}개 신규 | Codex ${stats.codexNew}개 신규 | Gemini ${stats.geminiNew || 0}개 신규`;
  if (stats.antigravityNew || stats.antigravityCached) logLine += ` | Antigravity ${stats.antigravityNew || 0}개 신규`;
  console.log(logLine);
  console.log(`📊 총 ${allMeta.length}개 항목`);
  console.log(`📁 출력: ${htmlDest}`);
  console.log(`\n🌐 브라우저에서 열기: ${htmlDest}`);
}

main();
