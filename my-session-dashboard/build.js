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

  // 메시지를 세션별 개별 JSON 파일로 증분 출력
  const dataDir = path.join(DIST_DIR, "data");
  fs.mkdirSync(dataDir, { recursive: true });

  // DB sessionId → safeId + DB mtime 맵 구축
  const dbSessionMap = new Map(); // safeId → { meta, dbMtime }
  for (const meta of allMeta) {
    const safeId = meta.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    dbSessionMap.set(safeId, meta);
  }

  // data/ 기존 파일 목록
  const existingFiles = new Set();
  try {
    for (const f of fs.readdirSync(dataDir)) {
      if (f.endsWith(".json")) existingFiles.add(f.replace(/\.json$/, ""));
    }
  } catch {}

  let dataCreated = 0, dataUpdated = 0, dataDeleted = 0, dataSkipped = 0;

  // DB mtime를 별도 조회 (getAllMeta는 mtime을 포함하지 않으므로)
  const dbMtimeMap = new Map();
  const mtimeRows = db.db.prepare("SELECT session_id, mtime FROM sessions WHERE type != 'gemini_excluded'").all();
  for (const row of mtimeRows) {
    const safeId = row.session_id.replace(/[^a-zA-Z0-9_-]/g, "_");
    dbMtimeMap.set(safeId, row.mtime);
  }

  for (const [safeId, meta] of dbSessionMap) {
    const filePath = path.join(dataDir, `${safeId}.json`);
    const dbMtime = dbMtimeMap.get(safeId) || 0;

    if (existingFiles.has(safeId)) {
      // 파일 존재 → mtime 비교
      try {
        const fileMtime = fs.statSync(filePath).mtimeMs;
        // 파일 mtime이 DB mtime과 일치하면 스킵 (1초 이내 오차 허용)
        if (dbMtime && Math.abs(fileMtime - dbMtime) < 1000) {
          dataSkipped++;
          existingFiles.delete(safeId);
          continue;
        }
      } catch {}
      // mtime 불일치 → 갱신
      const data = meta.type === "plan" ? db.getPlanContent(meta.sessionId) : db.getMessages(meta.sessionId);
      fs.writeFileSync(filePath, JSON.stringify(data));
      // 파일 mtime을 DB mtime에 맞춰 다음 빌드에서 캐시 히트
      if (dbMtime) { const t = dbMtime / 1000; fs.utimesSync(filePath, t, t); }
      dataUpdated++;
    } else {
      // 파일 미존재 → 생성
      const data = meta.type === "plan" ? db.getPlanContent(meta.sessionId) : db.getMessages(meta.sessionId);
      fs.writeFileSync(filePath, JSON.stringify(data));
      if (dbMtime) { const t = dbMtime / 1000; fs.utimesSync(filePath, t, t); }
      dataCreated++;
    }
    existingFiles.delete(safeId);
  }

  // 고아 파일 삭제 (DB에 없는 data/*.json)
  for (const orphanId of existingFiles) {
    fs.unlinkSync(path.join(dataDir, `${orphanId}.json`));
    dataDeleted++;
  }

  console.log(`📦 data/: 생성 ${dataCreated}, 갱신 ${dataUpdated}, 스킵 ${dataSkipped}, 삭제 ${dataDeleted}`);

  // 검색 인덱스 생성 (메타 필드 + 대화 텍스트 첫 2,000자)
  const searchIndex = {};
  for (const meta of allMeta) {
    const fields = [
      meta.title, meta.firstMessage,
      ...(meta.keywords || []),
      meta.projectDisplay, meta.gitBranch, meta.sessionId,
    ];
    if (meta.toolNames) fields.push(...Object.keys(meta.toolNames));
    // 대화 내용 텍스트 추출 (전문 검색 지원)
    const safeId = meta.sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dataFile = path.join(dataDir, `${safeId}.json`);
    try {
      const content = JSON.parse(fs.readFileSync(dataFile, "utf8"));
      if (typeof content === "string") {
        fields.push(content.substring(0, 2000));
      } else if (Array.isArray(content)) {
        const texts = content.filter(m => m.text).map(m => m.text).join(" ");
        fields.push(texts.substring(0, 2000));
      }
    } catch {}
    searchIndex[meta.sessionId] = fields.filter(Boolean).join(" ").toLowerCase();
  }

  // Build HTML — 메타만 인라인, 메시지는 lazy load
  const metaJson = JSON.stringify(allMeta).replace(/<\//g, "<\\/");
  const searchIndexJson = JSON.stringify(searchIndex).replace(/<\//g, "<\\/");
  let html = fs.readFileSync(htmlSrc, "utf8");
  const dataScript = `<script>
window.__SESSIONS_META__ = ${metaJson};
window.__SEARCH_INDEX__ = ${searchIndexJson};
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
