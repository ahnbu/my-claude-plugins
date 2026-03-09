"use strict";
// shared/session-db.js — SQLite 기반 세션 통합 DB (node:sqlite 내장 모듈 사용)
// 세션/플랜/Codex 파싱 결과를 캐싱·조회하는 중심 스토어

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const {
  processSession,
  processCodexSession,
  parsePlan,
  normalizeEntries,
  readJsonl,
} = require("./session-parser.js");

const HOME = process.env.HOME || process.env.USERPROFILE;
const DEFAULT_PROJECTS_DIR = path.join(HOME, ".claude", "projects");
const DEFAULT_PLANS_DIR = path.join(HOME, ".claude", "plans");
const DEFAULT_CODEX_DIR = path.join(HOME, ".codex", "sessions");

class SessionDB {
  /**
   * @param {string} dbPath - sessions.db 파일 경로
   * @param {object} [options]
   * @param {string} [options.projectsDir]
   * @param {string} [options.plansDir]
   * @param {string} [options.codexDir]
   */
  constructor(dbPath, options = {}) {
    this.dbPath = dbPath;
    this.projectsDir = options.projectsDir || DEFAULT_PROJECTS_DIR;
    this.plansDir = options.plansDir || DEFAULT_PLANS_DIR;
    this.codexDir = options.codexDir || DEFAULT_CODEX_DIR;

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
        message_count     INTEGER DEFAULT 0,
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
        text        TEXT,
        timestamp   TEXT,
        tools       TEXT,
        PRIMARY KEY (session_id, seq)
      )
    `);
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
  }

  /**
   * 전체 증분 동기화 — 소스 파일 변경 분만 DB에 upsert
   * @param {object} [options]
   * @param {boolean} [options.verbose=true]
   * @returns {{ claudeNew, claudeCached, planNew, planCached, codexNew, codexCached }}
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
              if (!result || result.metadata.messageCount === 0) continue;
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

      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }

    if (verbose) {
      console.log(`  Claude: 신규 ${claudeNew}, 캐시 ${claudeCached} | 플랜: 신규 ${planNew}, 캐시 ${planCached} | Codex: 신규 ${codexNew}, 캐시 ${codexCached}`);
    }

    return { claudeNew, claudeCached, planNew, planCached, codexNew, codexCached };
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
            const cacheKey = "codex:" + path.basename(file, ".jsonl");

            try {
              const mtime = fs.statSync(filePath).mtimeMs;
              if (dbMtimes.get(cacheKey) === mtime) { countCb(1, 0); continue; }

              const result = processCodexSession(filePath);
              if (!result || result.metadata.messageCount === 0) continue;
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
         models, message_count, tool_use_count, total_input_tokens, total_output_tokens,
         tool_names, first_message, file_path, mtime,
         slug, is_completed, char_count, linked_session_id, plan_slug, originator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      metadata.messageCount || 0,
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
      "INSERT INTO messages (session_id, seq, role, text, timestamp, tools) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      stmt.run(
        sessionId,
        i,
        msg.role,
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
    const rows = this.db.prepare("SELECT * FROM sessions ORDER BY timestamp DESC").all();
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
      messageCount: row.message_count || 0,
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
      "SELECT role, text, timestamp, tools FROM messages WHERE session_id = ? ORDER BY seq"
    ).all(sessionId);
    return rows.map(row => {
      const msg = { role: row.role };
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

    // 파일 경로 결정
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
