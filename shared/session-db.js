"use strict";
// shared/session-db.js — SQLite 기반 세션 통합 DB (node:sqlite 내장 모듈 사용)
// 세션/플랜/Codex 파싱 결과를 캐싱·조회하는 중심 스토어

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  processSession,
  processCodexSession,
  processGeminiSession,
  processAntigravitySession,
  parsePlan,
  normalizeAntigravityEntries,
  normalizeCodexEntries,
  normalizeEntries,
  normalizeGeminiEntries,
  readJsonl,
} = require("./session-parser.js");

const HOME = process.env.HOME || process.env.USERPROFILE;
const DEFAULT_PROJECTS_DIR = path.join(HOME, ".claude", "projects");
const DEFAULT_PLANS_DIR = path.join(HOME, ".claude", "plans");
const DEFAULT_CODEX_DIR = path.join(HOME, ".codex", "sessions");
const DEFAULT_GEMINI_DIR = path.join(HOME, ".gemini", "tmp");
const DEFAULT_ANTIGRAVITY_EXPORT = path.join(HOME, ".antigravity", "export", "conversations_export.json");
const SESSION_CONFIG_PATH = path.join(HOME, ".claude", "session-config.json");

function loadSessionConfig() {
  try {
    if (fs.existsSync(SESSION_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(SESSION_CONFIG_PATH, "utf8"));
    }
  } catch { /* ignore */ }
  return {};
}

class SessionDB {
  /**
   * @param {string} dbPath - sessions.db 파일 경로
   * @param {object} [options]
   * @param {string} [options.projectsDir]
   * @param {string} [options.plansDir]
   * @param {string} [options.codexDir]
   * @param {string} [options.antigravityExportPath]
   * @param {boolean} [options.includeAntigravity]
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.projectsDir = options.projectsDir || DEFAULT_PROJECTS_DIR;
    this.plansDir = options.plansDir || DEFAULT_PLANS_DIR;
    this.codexDir = options.codexDir || DEFAULT_CODEX_DIR;
    this.geminiDir = options.geminiDir || DEFAULT_GEMINI_DIR;
    const config = loadSessionConfig();
    this.antigravityExportPath = options.antigravityExportPath
      || config.antigravityExportPath
      || DEFAULT_ANTIGRAVITY_EXPORT;
    this.includeAntigravity = options.includeAntigravity
      ?? config.includeAntigravity
      ?? false;

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this._init();
  }

  _init() {
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id        TEXT PRIMARY KEY,
        type              TEXT NOT NULL DEFAULT 'session',
        title             TEXT,
        keywords          TEXT,
        timestamp         TEXT NOT NULL,
        last_timestamp    TEXT,
        project           TEXT,
        git_branch        TEXT,
        models            TEXT,
        user_entry_count            INTEGER DEFAULT 0,
        user_text_message_count     INTEGER DEFAULT 0,
        tool_result_count           INTEGER DEFAULT 0,
        tool_use_count    INTEGER DEFAULT 0,
        total_input_tokens  INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        tool_names        TEXT,
        first_message     TEXT,
        file_path         TEXT,
        mtime             REAL,
        -- plan 전용
        slug              TEXT,
        is_completed      INTEGER DEFAULT 0,
        char_count        INTEGER DEFAULT 0,
        linked_session_id TEXT,
        -- plan slug (session JSONL에서 읽힌 plan 참조)
        plan_slug         TEXT,
        -- codex 전용
        originator        TEXT
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        session_id  TEXT NOT NULL,
        seq         INTEGER NOT NULL,
        role        TEXT NOT NULL,
        subtype     TEXT,
        text        TEXT,
        timestamp   TEXT,
        tools       TEXT,
        PRIMARY KEY (session_id, seq)
      )
    `);
    try {
      this.db.exec("ALTER TABLE messages ADD COLUMN subtype TEXT");
    } catch (_) { /* 이미 존재 */ }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plan_contents (
        session_id TEXT PRIMARY KEY,
        content    TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        session_id   TEXT NOT NULL,
        seq          INTEGER NOT NULL,
        agent_id     TEXT NOT NULL DEFAULT '',
        kind         TEXT NOT NULL,
        source       TEXT DEFAULT 'main',
        timestamp    TEXT,
        timestamp_ms INTEGER,
        data         TEXT,
        PRIMARY KEY (session_id, agent_id, seq)
      )
    `);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON sessions(timestamp)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_plan_slug ON sessions(plan_slug)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_file_path ON sessions(file_path)");

    // 마이그레이션: message_count → user_entry_count + 신규 컬럼 추가
    const cols = this.db.prepare("PRAGMA table_info(sessions)").all().map(c => c.name);
    if (cols.includes("message_count")) {
      // 기존 DB: 컬럼 리네이밍 + 신규 컬럼 추가 + 강제 재동기화
      this.db.exec("ALTER TABLE sessions RENAME COLUMN message_count TO user_entry_count");
      this.db.exec("ALTER TABLE sessions ADD COLUMN user_text_message_count INTEGER DEFAULT 0");
      this.db.exec("ALTER TABLE sessions ADD COLUMN tool_result_count INTEGER DEFAULT 0");
      this.db.exec("UPDATE sessions SET mtime = 0");
    } else if (!cols.includes("user_text_message_count")) {
      // 신규 DB(CREATE TABLE에 이미 user_entry_count 있음): 신규 2개만 추가
      this.db.exec("ALTER TABLE sessions ADD COLUMN user_text_message_count INTEGER DEFAULT 0");
      this.db.exec("ALTER TABLE sessions ADD COLUMN tool_result_count INTEGER DEFAULT 0");
    }
  }

  /**
   * 전체 증분 동기화 — 소스 파일 변경 분만 DB에 upsert
   * @param {object} [options]
   * @param {boolean} [options.verbose=true]
   * @returns {{ claudeNew, claudeCached, planNew, planCached, codexNew, codexCached, geminiNew, geminiCached }}
   */
  sync(options = {}) {
    const verbose = options.verbose !== false;

    // 현재 DB의 mtime 맵
    const dbMtimes = new Map();
    for (const row of this.db.prepare("SELECT session_id, mtime FROM sessions").all()) {
      dbMtimes.set(row.session_id, row.mtime);
    }

    let claudeNew = 0, claudeCached = 0;
    let planNew = 0, planCached = 0;
    let codexNew = 0, codexCached = 0;
    let geminiNew = 0, geminiCached = 0;
    let antigravityNew = 0, antigravityCached = 0;

    this.db.exec("BEGIN");
    try {
      // ── Claude 세션 ──
      if (fs.existsSync(this.projectsDir)) {
        let projectDirs;
        try { projectDirs = fs.readdirSync(this.projectsDir); } catch { projectDirs = []; }

        for (const projectDir of projectDirs) {
          const projectPath = path.join(this.projectsDir, projectDir);
          try { if (!fs.statSync(projectPath).isDirectory()) continue; } catch { continue; }

          let files;
          try { files = fs.readdirSync(projectPath); } catch { continue; }

          for (const file of files) {
            if (!file.endsWith(".jsonl")) continue;
            const filePath = path.join(projectPath, file);
            const sessionId = path.basename(file, ".jsonl");

            try {
              const mtime = fs.statSync(filePath).mtimeMs;
              if (dbMtimes.get(sessionId) === mtime) { claudeCached++; continue; }

              const result = processSession(filePath);
              if (!result || result.metadata.userEntryCount === 0) continue;
              result.metadata.type = "session";
              this._upsertSession(result.metadata, mtime);
              this._upsertMessages(result.metadata.sessionId, result.messages);
              claudeNew++;
            } catch (err) {
              if (verbose) console.warn(`⚠️  세션 파싱 실패: ${file} — ${err.message}`);
            }
          }
        }
      }

      // ── Plans ──
      // slug→sessionId 맵 빌드 (DB에서 plan_slug로 조회)
      const slugToSessionId = this._buildSlugMap();

      if (fs.existsSync(this.plansDir)) {
        let files;
        try { files = fs.readdirSync(this.plansDir).filter(f => f.endsWith(".md")); } catch { files = []; }

        for (const file of files) {
          const filePath = path.join(this.plansDir, file);
          const slug = path.basename(file, ".md");
          const cacheKey = "plan:" + slug;

          try {
            const mtime = fs.statSync(filePath).mtimeMs;
            const linkedSessionId = slugToSessionId.get(slug) || slugToSessionId.get(slug.replace(/-agent-[a-f0-9]+$/, "")) || null;

            if (dbMtimes.get(cacheKey) === mtime) {
              // mtime 변경 없어도 linkedSessionId는 매번 갱신
              if (linkedSessionId) {
                this.db.prepare("UPDATE sessions SET linked_session_id = ? WHERE session_id = ?")
                  .run(linkedSessionId, cacheKey);
              }
              planCached++;
              continue;
            }

            const result = parsePlan(filePath);
            if (!result) continue;
            if (linkedSessionId) result.metadata.linkedSessionId = linkedSessionId;
            this._upsertSession(result.metadata, mtime);
            this._upsertPlanContent(result.metadata.sessionId, result.content);
            planNew++;
          } catch (err) {
            if (verbose) console.warn(`⚠️  플랜 파싱 실패: ${file} — ${err.message}`);
          }
        }
      }

      // ── Codex 세션 ──
      if (fs.existsSync(this.codexDir)) {
        this._syncCodexDir(this.codexDir, dbMtimes, (c, n) => { codexCached += c; codexNew += n; }, verbose);
      } else if (verbose) {
        console.warn(`⚠️  Codex 세션 디렉토리 없음: ${this.codexDir}`);
      }

      // ── Gemini 세션 ──
      if (fs.existsSync(this.geminiDir)) {
        this._syncGeminiDir(this.geminiDir, dbMtimes, (c, n) => { geminiCached += c; geminiNew += n; }, verbose);
      }

      // ── Antigravity 세션 ──
      if (this.includeAntigravity || options.includeAntigravity) {
        const agResult = this._syncAntigravityFile(this.antigravityExportPath, dbMtimes, verbose);
        antigravityNew = agResult.newCount;
        antigravityCached = agResult.cachedCount;
      }

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    if (verbose) {
      let logLine = `  Claude: 신규 ${claudeNew}, 캐시 ${claudeCached} | 플랜: 신규 ${planNew}, 캐시 ${planCached} | Codex: 신규 ${codexNew}, 캐시 ${codexCached} | Gemini: 신규 ${geminiNew}, 캐시 ${geminiCached}`;
      if (antigravityNew || antigravityCached) {
        logLine += ` | Antigravity: 신규 ${antigravityNew}, 캐시 ${antigravityCached}`;
      }
      console.log(logLine);
    }

    return { claudeNew, claudeCached, planNew, planCached, codexNew, codexCached, geminiNew, geminiCached, antigravityNew, antigravityCached };
  }

  _syncCodexDir(codexDir, dbMtimes, countCb, verbose) {
    let years;
    try { years = fs.readdirSync(codexDir); } catch { return; }

    for (const year of years) {
      const yearPath = path.join(codexDir, year);
      try { if (!fs.statSync(yearPath).isDirectory()) continue; } catch { continue; }

      let months;
      try { months = fs.readdirSync(yearPath); } catch { continue; }
      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        try { if (!fs.statSync(monthPath).isDirectory()) continue; } catch { continue; }

        let days;
        try { days = fs.readdirSync(monthPath); } catch { continue; }
        for (const day of days) {
          const dayPath = path.join(monthPath, day);
          try { if (!fs.statSync(dayPath).isDirectory()) continue; } catch { continue; }

          let files;
          try { files = fs.readdirSync(dayPath); } catch { continue; }
          for (const file of files) {
            if (!file.endsWith(".jsonl")) continue;
            const filePath = path.join(dayPath, file);
            // 파일명에서 UUID 추출 (예: rollout-...-UUID.jsonl → UUID)
            // DB session_id는 "codex:UUID" 형식이므로 cacheKey를 일치시킴
            const basename = path.basename(file, ".jsonl");
            const uuidMatch = basename.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
            const cacheKey = uuidMatch ? "codex:" + uuidMatch[1] : "codex:" + basename;

            try {
              const mtime = fs.statSync(filePath).mtimeMs;
              if (dbMtimes.get(cacheKey) === mtime) { countCb(1, 0); continue; }

              const result = processCodexSession(filePath);
              if (!result || result.metadata.userEntryCount === 0) continue;
              this._upsertSession(result.metadata, mtime);
              this._upsertMessages(result.metadata.sessionId, result.messages);
              countCb(0, 1);
            } catch (err) {
              if (verbose) console.warn(`⚠️  Codex 파싱 실패: ${file} — ${err.message}`);
            }
          }
        }
      }
    }
  }

  _syncGeminiDir(geminiDir, dbMtimes, countCb, verbose) {
    let projectDirs;
    try { projectDirs = fs.readdirSync(geminiDir); } catch { return; }

    for (const projectAlias of projectDirs) {
      const projectPath = path.join(geminiDir, projectAlias);
      try { if (!fs.statSync(projectPath).isDirectory()) continue; } catch { continue; }

      // .project_root에서 실제 경로 읽기
      let projectRoot = "";
      const projectRootFile = path.join(projectPath, ".project_root");
      if (fs.existsSync(projectRootFile)) {
        try { projectRoot = fs.readFileSync(projectRootFile, "utf8").trim(); } catch {}
      }

      const chatsDir = path.join(projectPath, "chats");
      if (!fs.existsSync(chatsDir)) continue;

      let files;
      try { files = fs.readdirSync(chatsDir).filter(f => f.startsWith("session-") && f.endsWith(".json")).sort(); } catch { continue; }

      for (const file of files) {
        const absPath = path.join(chatsDir, file);

        try {
          const mtime = fs.statSync(absPath).mtimeMs;
          const existing = this._findSessionByFilePath(absPath);

          if (existing && dbMtimes.get(existing.session_id) === mtime) {
            if (verbose) console.log(`[gemini] ${file}: cached ✓`);
            countCb(1, 0);
            continue;
          }

          if (verbose) {
            const reason = !existing ? "NEW (no DB record)" : `CHANGED (mtime ${mtime} vs db ${dbMtimes.get(existing.session_id)})`;
            console.log(`[gemini] ${file}: ${reason}`);
          }

          const result = processGeminiSession(absPath, projectRoot);

          // 필터 조건에 걸리는 세션도 sentinel 레코드로 저장하여 재파싱 방지
          let excluded = false;
          let excludeReason = "";

          if (!result || result.metadata.userEntryCount === 0) {
            excluded = true;
            excludeReason = "no user entries";
          } else if (result.metadata.firstMessage && /\((codex|claude)\)/i.test(result.metadata.firstMessage)) {
            excluded = true;
            excludeReason = "auto-call session";
          } else {
            const durationSec = (new Date(result.metadata.lastTimestamp) - new Date(result.metadata.timestamp)) / 1000;
            if (durationSec < 60) {
              excluded = true;
              excludeReason = `duration ${Math.round(durationSec)}s < 60s`;
            }
          }

          if (excluded) {
            // sentinel 레코드: mtime만 기록하여 다음 빌드에서 캐시 히트
            const sentinelId = "gemini_excluded:" + absPath;
            this.db.prepare(`
              INSERT OR REPLACE INTO sessions
                (session_id, type, timestamp, file_path, mtime)
              VALUES (?, 'gemini_excluded', datetime('now'), ?, ?)
            `).run(sentinelId, absPath, mtime);
            if (verbose) console.log(`[gemini] ${file}: excluded (${excludeReason}) — sentinel saved`);
            continue;
          }

          // 동일 session_id로 이미 DB에 세션이 있으면 중복 파일 → sentinel로 저장
          const existingSession = this.db.prepare(
            "SELECT session_id FROM sessions WHERE session_id = ?"
          ).get(result.metadata.sessionId);

          if (existingSession) {
            const sentinelId = "gemini_excluded:" + absPath;
            this.db.prepare(`
              INSERT OR REPLACE INTO sessions
                (session_id, type, timestamp, file_path, mtime)
              VALUES (?, 'gemini_excluded', datetime('now'), ?, ?)
            `).run(sentinelId, absPath, mtime);
            if (verbose) console.log(`[gemini] ${file}: duplicate UUID — sentinel saved`);
            countCb(1, 0);
            continue;
          }

          this._upsertSession(result.metadata, mtime);
          this._upsertMessages(result.metadata.sessionId, result.messages);
          countCb(0, 1);
        } catch (err) {
          if (verbose) console.warn(`⚠️  Gemini 파싱 실패: ${file} — ${err.message}`);
        }
      }
    }
  }

  _findSessionByFilePath(absPath) {
    const row = this.db.prepare("SELECT session_id, mtime FROM sessions WHERE file_path = ?").get(absPath);
    return row || null;
  }

  // ── Antigravity 동기화 ──

  _syncAntigravityFile(exportPath, dbMtimes, verbose) {
    let newCount = 0, cachedCount = 0;

    if (!fs.existsSync(exportPath)) {
      if (verbose) console.warn(`⚠️  Antigravity export 파일 없음: ${exportPath}`);
      return { newCount, cachedCount };
    }

    const absExportPath = path.resolve(exportPath);
    let conversations;
    try {
      conversations = JSON.parse(fs.readFileSync(exportPath, "utf8"));
    } catch (err) {
      if (verbose) console.warn(`⚠️  Antigravity JSON 파싱 실패: ${err.message}`);
      return { newCount, cachedCount };
    }

    if (!Array.isArray(conversations)) {
      if (verbose) console.warn(`⚠️  Antigravity export가 배열이 아님`);
      return { newCount, cachedCount };
    }

    for (const conv of conversations) {
      const cascadeId = conv.cascade_id;
      if (!cascadeId) continue;
      const cacheKey = "antigravity:" + cascadeId;

      // last_modified_time/created_time이 빈 문자열일 수 있음 → 첫 메시지 timestamp 폴백
      const firstMsgTs = (conv.messages || []).find(m => m.timestamp)?.timestamp || "";
      const convMtimeRaw = conv.last_modified_time || conv.created_time || firstMsgTs;
      const convMtime = convMtimeRaw ? new Date(convMtimeRaw).getTime() : 0;
      if (dbMtimes.get(cacheKey) === convMtime) {
        cachedCount++;
        continue;
      }

      try {
        const result = processAntigravitySession(conv, absExportPath);
        if (!result || result.metadata.userEntryCount === 0) continue;
        this._upsertSession(result.metadata, convMtime);
        this._upsertMessages(result.metadata.sessionId, result.messages);
        newCount++;
      } catch (err) {
        if (verbose) console.warn(`⚠️  Antigravity 파싱 실패: ${cascadeId} — ${err.message}`);
      }
    }

    return { newCount, cachedCount };
  }

  /**
   * Antigravity 전용 동기화 — export JSON 파일을 명시적으로 지정 가능
   * @param {object} [options]
   * @param {string} [options.exportPath] - conversations_export.json 경로
   * @param {boolean} [options.verbose=true]
   * @returns {{ antigravityNew, antigravityCached }}
   */
  syncAntigravity(options = {}) {
    const verbose = options.verbose !== false;
    const exportPath = options.exportPath || this.antigravityExportPath;

    const dbMtimes = new Map();
    for (const row of this.db.prepare(
      "SELECT session_id, mtime FROM sessions WHERE type = 'antigravity'"
    ).all()) {
      dbMtimes.set(row.session_id, row.mtime);
    }

    this.db.exec("BEGIN");
    try {
      const result = this._syncAntigravityFile(exportPath, dbMtimes, verbose);
      this.db.exec("COMMIT");

      if (verbose) {
        console.log(`  Antigravity: 신규 ${result.newCount}, 캐시 ${result.cachedCount}`);
      }
      return { antigravityNew: result.newCount, antigravityCached: result.cachedCount };
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  /** plan_slug 기반 slug→sessionId 맵 (DB 조회) */
  _buildSlugMap() {
    const map = new Map();
    for (const row of this.db.prepare("SELECT session_id, plan_slug FROM sessions WHERE plan_slug IS NOT NULL").all()) {
      if (!map.has(row.plan_slug)) {
        map.set(row.plan_slug, row.session_id);
      }
    }
    return map;
  }

  _upsertSession(metadata, mtime) {
    this.db.prepare(`
      INSERT OR REPLACE INTO sessions
        (session_id, type, title, keywords, timestamp, last_timestamp, project, git_branch,
         models, user_entry_count, user_text_message_count, tool_result_count,
         tool_use_count, total_input_tokens, total_output_tokens,
         tool_names, first_message, file_path, mtime,
         slug, is_completed, char_count, linked_session_id, plan_slug, originator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      metadata.sessionId,
      metadata.type || "session",
      metadata.title || null,
      JSON.stringify(metadata.keywords || []),
      metadata.timestamp,
      metadata.lastTimestamp || null,
      metadata.project || null,
      metadata.gitBranch || null,
      JSON.stringify(metadata.models || []),
      metadata.userEntryCount || 0,
      metadata.userTextMessageCount || 0,
      metadata.toolResultCount || 0,
      metadata.toolUseCount || 0,
      metadata.totalInputTokens || 0,
      metadata.totalOutputTokens || 0,
      JSON.stringify(metadata.toolNames || {}),
      metadata.firstMessage || null,
      metadata.filePath || null,
      mtime,
      metadata.slug || null,
      metadata.isCompleted ? 1 : 0,
      metadata.charCount || 0,
      metadata.linkedSessionId || null,
      metadata.planSlug || null,
      metadata.originator || null
    );
  }

  _upsertMessages(sessionId, messages) {
    this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
    const stmt = this.db.prepare(
      "INSERT INTO messages (session_id, seq, role, subtype, text, timestamp, tools) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      stmt.run(
        sessionId,
        i,
        msg.role,
        msg.subtype || null,
        msg.text || null,
        msg.timestamp || null,
        msg.tools ? JSON.stringify(msg.tools) : null
      );
    }
  }

  _upsertPlanContent(sessionId, content) {
    this.db.prepare(
      "INSERT OR REPLACE INTO plan_contents (session_id, content) VALUES (?, ?)"
    ).run(sessionId, content);
  }

  /**
   * 전체 메타데이터 배열 반환 (timestamp DESC 정렬)
   * @returns {object[]}
   */
  getAllMeta() {
    const rows = this.db.prepare("SELECT * FROM sessions WHERE type != 'gemini_excluded' ORDER BY timestamp DESC").all();
    return rows.map(row => this._rowToMeta(row));
  }

  _rowToMeta(row) {
    const meta = {
      sessionId: row.session_id,
      type: row.type,
      title: row.title || "",
      keywords: JSON.parse(row.keywords || "[]"),
      timestamp: row.timestamp,
      lastTimestamp: row.last_timestamp || null,
      project: row.project || "",
      projectDisplay: row.project || "",
      gitBranch: row.git_branch || "",
      models: JSON.parse(row.models || "[]"),
      userEntryCount: row.user_entry_count || 0,
      userTextMessageCount: row.user_text_message_count || 0,
      toolResultCount: row.tool_result_count || 0,
      toolUseCount: row.tool_use_count || 0,
      totalInputTokens: row.total_input_tokens || 0,
      totalOutputTokens: row.total_output_tokens || 0,
      toolNames: JSON.parse(row.tool_names || "{}"),
      firstMessage: row.first_message || "",
      filePath: row.file_path || "",
    };

    // plan 전용 필드
    if (row.type === "plan") {
      meta.slug = row.slug || "";
      meta.planId = row.session_id;
      meta.isCompleted = row.is_completed ? true : false;
      meta.charCount = row.char_count || 0;
      if (row.linked_session_id) meta.linkedSessionId = row.linked_session_id;
    }

    // codex 전용 필드
    if (row.type === "codex" && row.originator) {
      meta.originator = row.originator;
    }

    return meta;
  }

  /**
   * 세션 메시지 배열 반환
   * @param {string} sessionId
   * @returns {object[]}
   */
  getMessages(sessionId) {
    const rows = this.db.prepare(
      "SELECT role, subtype, text, timestamp, tools FROM messages WHERE session_id = ? ORDER BY seq"
    ).all(sessionId);
    return rows.map(row => {
      const msg = { role: row.role };
      if (row.subtype) msg.subtype = row.subtype;
      if (row.text) msg.text = row.text;
      if (row.timestamp) msg.timestamp = row.timestamp;
      if (row.tools) msg.tools = JSON.parse(row.tools);
      return msg;
    });
  }

  /**
   * 플랜 원문 반환
   * @param {string} sessionId - "plan:slug" 형식
   * @returns {string}
   */
  getPlanContent(sessionId) {
    const row = this.db.prepare(
      "SELECT content FROM plan_contents WHERE session_id = ?"
    ).get(sessionId);
    return row ? row.content : "";
  }

  /**
   * 정규화된 이벤트 배열 반환 (timeline/transcript용)
   * @param {string} sessionId
   * @returns {object[]}
   */
  getEvents(sessionId) {
    const rows = this.db.prepare(
      "SELECT * FROM events WHERE session_id = ? ORDER BY agent_id, seq"
    ).all(sessionId);
    return rows.map(row => ({
      agentId: row.agent_id,
      kind: row.kind,
      source: row.source || "main",
      timestamp: row.timestamp || "",
      timestampMs: row.timestamp_ms,
      ...JSON.parse(row.data || "{}"),
    }));
  }

  /**
   * 단건 이벤트 동기화 — timeline/transcript 첫 조회 시 on-demand 호출
   * @param {string} sessionId
   * @param {object} [options]
   * @param {boolean} [options.force] - 이미 있어도 재동기화
   * @param {string} [options.projectsDir] - 폴백용 검색 경로
   */
  syncSingleSession(sessionId, options = {}) {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM events WHERE session_id = ?").get(sessionId);
    if (row.c > 0 && !options.force) return;

    // Gemini 세션 분기
    if (sessionId.startsWith("gemini:")) {
      const sessionRow = this.db.prepare("SELECT file_path FROM sessions WHERE session_id = ?").get(sessionId);
      if (!sessionRow || !sessionRow.file_path || !fs.existsSync(sessionRow.file_path)) {
        throw new Error(`Gemini session file not found: ${sessionId}`);
      }
      let rawData;
      try { rawData = JSON.parse(fs.readFileSync(sessionRow.file_path, "utf8")); } catch (err) {
        throw new Error(`Gemini JSON 파싱 실패: ${err.message}`);
      }
      const events = normalizeGeminiEntries(rawData.messages || []);
      this._upsertEvents(sessionId, "", events);
      return;
    }

    // Antigravity 세션 분기
    if (sessionId.startsWith("antigravity:")) {
      const cascadeId = sessionId.slice("antigravity:".length);
      const sessionRow = this.db.prepare("SELECT file_path FROM sessions WHERE session_id = ?").get(sessionId);
      if (!sessionRow || !sessionRow.file_path || !fs.existsSync(sessionRow.file_path)) {
        throw new Error(`Antigravity export file not found: ${sessionId}`);
      }
      let conversations;
      try { conversations = JSON.parse(fs.readFileSync(sessionRow.file_path, "utf8")); } catch (err) {
        throw new Error(`Antigravity JSON 파싱 실패: ${err.message}`);
      }
      const conv = conversations.find(c => c.cascade_id === cascadeId);
      if (!conv) throw new Error(`Antigravity conversation not found: ${cascadeId}`);
      const events = normalizeAntigravityEntries(conv.messages || []);
      this._upsertEvents(sessionId, "", events);
      return;
    }

    // Codex 세션 분기
    if (sessionId.startsWith("codex:")) {
      const rawId = sessionId.slice("codex:".length);

      // 파일 경로 결정 (DB 우선, 없으면 codexDir DFS 탐색)
      let filePath = null;
      const sessionRow = this.db.prepare("SELECT file_path FROM sessions WHERE session_id = ?").get(sessionId);
      if (sessionRow && sessionRow.file_path && fs.existsSync(sessionRow.file_path)) {
        filePath = sessionRow.file_path;
      } else {
        const codexDir = options.codexDir || this.codexDir;
        filePath = _findCodexSessionFile(rawId, codexDir);
        if (!filePath) throw new Error(`Codex session file not found: ${sessionId}`);
      }

      const entries = readJsonl(filePath);
      const events = normalizeCodexEntries(entries, "main", "");
      this._upsertEvents(sessionId, "", events);
      return;
    }

    // Claude 세션 처리
    let mainFilePath = null;
    const sessionRow = this.db.prepare("SELECT file_path FROM sessions WHERE session_id = ?").get(sessionId);
    if (sessionRow && sessionRow.file_path && fs.existsSync(sessionRow.file_path)) {
      mainFilePath = sessionRow.file_path;
    } else {
      // DFS 폴백
      const searchDir = options.projectsDir || this.projectsDir;
      mainFilePath = _findSessionFile(sessionId, searchDir);
      if (!mainFilePath) throw new Error(`Session file not found: ${sessionId}`);
    }

    const mainEntries = readJsonl(mainFilePath);
    const mainEvents = normalizeEntries(mainEntries, "main", "");
    this._upsertEvents(sessionId, "", mainEvents);

    // sessions 테이블에도 메타데이터 upsert (syncSingleSession 누락 수정)
    try {
      const result = processSession(mainFilePath);
      if (result && result.metadata) {
        result.metadata.type = "session";
        const mtime = fs.statSync(mainFilePath).mtimeMs;
        this._upsertSession(result.metadata, mtime);
      }
    } catch (err) {
      // sessions upsert 실패해도 events는 이미 저장됨 — 무시
    }

    // 서브에이전트
    const subagentsDir = path.join(path.dirname(mainFilePath), sessionId, "subagents");
    if (fs.existsSync(subagentsDir)) {
      for (const file of fs.readdirSync(subagentsDir)) {
        if (!/^agent-.*\.jsonl$/i.test(file)) continue;
        const agentId = path.basename(file, ".jsonl");
        const entries = readJsonl(path.join(subagentsDir, file));
        const events = normalizeEntries(entries, "subagent", agentId);
        this._upsertEvents(sessionId, agentId, events);
      }
    }
  }

  _upsertEvents(sessionId, agentId, events) {
    this.db.prepare("DELETE FROM events WHERE session_id = ? AND agent_id = ?").run(sessionId, agentId);
    const stmt = this.db.prepare(
      "INSERT INTO events (session_id, seq, agent_id, kind, source, timestamp, timestamp_ms, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    for (let i = 0; i < events.length; i++) {
      const { agentId: _a, kind, source, timestamp, timestampMs, ...rest } = events[i];
      stmt.run(
        sessionId,
        i,
        agentId,
        kind,
        source || "main",
        timestamp || null,
        timestampMs || null,
        JSON.stringify(rest)
      );
    }
  }

  /** DB 연결 닫기 */
  close() {
    try { this.db.close(); } catch {}
  }
}

/** DFS로 Codex 세션 파일 탐색 (파일명에 rawId 포함 여부로 매칭) */
function _findCodexSessionFile(rawId, rootDir) {
  if (!fs.existsSync(rootDir)) return null;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (entry.isFile() && entry.name.endsWith(".jsonl") && entry.name.includes(rawId)) return fullPath;
    }
  }
  return null;
}

/** DFS로 sessionId.jsonl 탐색 */
function _findSessionFile(sessionId, rootDir) {
  if (!fs.existsSync(rootDir)) return null;
  const target = `${sessionId}.jsonl`;
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { stack.push(fullPath); continue; }
      if (entry.isFile() && entry.name === target) return fullPath;
    }
  }
  return null;
}

module.exports = { SessionDB };
