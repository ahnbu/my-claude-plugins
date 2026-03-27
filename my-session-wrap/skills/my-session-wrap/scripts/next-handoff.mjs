#!/usr/bin/env node
// next-handoff.mjs — handoff 파일 경로 생성 + 런타임 컨텍스트 수집
//
// Usage (기본): node next-handoff.mjs [projectRoot] [summary] [sessionId]
//   → stdout: 생성된 handoff 파일 절대경로
//
// Usage (JSON): node next-handoff.mjs --json [projectRoot] [summary] [sessionId]
//   → stdout: JSON { runtime, session_id, session_path, plan, summary, handoff_path, created }
//
// sessionId 생략 시 런타임에서 자동 해결

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const MARKERS = ["CHANGELOG.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md"];

// --- Runtime detection ---
function detectRuntime() {
  if (process.env.ANTIGRAVITY_AGENT) return "antigravity";
  if (process.env.CLAUDECODE)        return "claude";
  if (process.env.CODEX_THREAD_ID)   return "codex";
  if (process.env.GEMINI_CLI)        return "gemini";
  return "unknown";
}

// --- Session ID auto-resolution ---
function resolveSessionId(explicit, runtime) {
  if (explicit && explicit.trim()) return explicit.trim();

  if (runtime === "codex") {
    return process.env.CODEX_THREAD_ID || "";
  }
  if (runtime === "claude" || runtime === "antigravity") {
    // .claude/.current-session-id fallback
    const candidate = join(os.homedir(), ".claude", ".current-session-id");
    if (existsSync(candidate)) {
      try { return readFileSync(candidate, "utf8").trim(); } catch { /* ignore */ }
    }
    return "";
  }
  if (runtime === "gemini") {
    const projectName = process.cwd().split(/[\\/]/).pop();
    const suffixes = ["", "-1", "-2", "-3"];
    for (const s of suffixes) {
      const logPath = join(os.homedir(), ".gemini", "tmp", `${projectName}${s}`, "logs.json");
      if (existsSync(logPath)) {
        try {
          const m = readFileSync(logPath, "utf8").match(/"sessionId":"([^"]+)"/);
          if (m) return m[1];
        } catch { /* ignore */ }
      }
    }
    return "";
  }
  return "";
}

// --- Summary sanitization ---
function sanitizeSummary(value) {
  if (!value || !value.trim()) return "";

  const invalid = /[<>:"/\\|?*\x00-\x1f]/g;
  let s = value.trim().replace(invalid, "-");
  s = s.replace(/\s+/g, "-");
  s = s.replace(/-{2,}/g, "-");
  s = s.replace(/^-+|-+$/g, "");
  return s;
}

// --- Project root resolution ---
function resolveProjectRoot(explicitRoot) {
  // Priority 1: explicit argument
  if (explicitRoot && explicitRoot.trim()) {
    const found = MARKERS.filter((m) => existsSync(join(explicitRoot, m))).length;
    if (found === 0) {
      process.stderr.write(
        `ERROR: ProjectRoot '${explicitRoot}' has no marker files (${MARKERS.join(" / ")})\n`
      );
      process.exit(1);
    }
    return explicitRoot.trim();
  }

  // Priority 2: git root (OS native git — no WSL path issues)
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (gitRoot) return gitRoot;
  } catch {
    // fall through
  }

  // Priority 3: marker scan — CWD + up to 3 levels above
  // Sort: most markers wins; tie-break by lowest depth (closest to CWD)
  const candidates = [];
  let dir = process.cwd();

  for (let depth = 0; depth <= 3; depth++) {
    const count = MARKERS.filter((m) => existsSync(join(dir, m))).length;
    if (count > 0) {
      candidates.push({ path: dir, count, depth });
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.count - a.count || a.depth - b.depth);
    return candidates[0].path;
  }

  // Priority 4: fail with hint
  let hint = "";
  try {
    hint = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    // no hint
  }
  const msg =
    "ERROR: ProjectRoot could not be determined. No marker files found within 3 levels." +
    (hint ? ` Git root candidate: ${hint}` : "");
  process.stderr.write(msg + "\n");
  process.exit(1);
}

// --- Plan path resolution ---
function findPlanPath(sessionId) {
  if (!sessionId || !sessionId.trim()) return "";
  const scriptPath = join(os.homedir(), ".claude", "skills", "doc-save", "scripts", "find_linked_plan.js");
  if (!existsSync(scriptPath)) return "";
  try {
    const result = execSync(`node "${scriptPath}" "${sessionId}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    const parsed = JSON.parse(result);
    if (parsed.found && parsed.planPath) return parsed.planPath.replace(/\\/g, "/");
  } catch {
    // ignore
  }
  return "";
}

// --- Session path resolution ---
function findSessionPath(sessionId) {
  if (!sessionId || !sessionId.trim()) return "";
  const projectsDir = join(os.homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) return "";
  try {
    for (const dir of readdirSync(projectsDir)) {
      const candidate = join(projectsDir, dir, `${sessionId}.jsonl`);
      if (existsSync(candidate)) return candidate.replace(/\\/g, "/");
    }
  } catch {
    // ignore
  }
  return "";
}

// --- Session summary (graceful) ---
function extractSessionSummary(sessionId) {
  if (!sessionId) return null;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const script = join(__dirname, "extract-session-summary.js");
  if (!existsSync(script)) return null;
  try {
    const out = execSync(`node "${script}" "${sessionId}"`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    }).trim();
    return JSON.parse(out);
  } catch {
    return null;
  }
}

// --- Shared utils ---
const now = new Date();
const pad2 = (n) => String(n).padStart(2, "0");

// --- Main ---
const args = process.argv.slice(2);
const jsonMode = args[0] === "--json";

const runtime = detectRuntime();

if (jsonMode) {
  // --json mode: collect full context + create handoff file
  // Usage: node next-handoff.mjs --json [projectRoot] [summary] [sessionId]
  const rawRoot      = args[1] || "";
  const rawSummary   = args[2] || "";
  const rawSessionId = args[3] || "";

  const sessionId   = resolveSessionId(rawSessionId, runtime);
  const sessionPath = findSessionPath(sessionId);
  const planPath    = findPlanPath(sessionId);
  const summary     = extractSessionSummary(sessionId);

  // Also create the handoff file
  const projectRoot = resolveProjectRoot(rawRoot);
  const handoffDir  = join(projectRoot, "_handoff");
  mkdirSync(handoffDir, { recursive: true });

  const date   = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  let suffix   = sanitizeSummary(rawSummary);
  if (!suffix) suffix = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;

  const pattern = new RegExp(`^handoff_${date}_(\\d{2})_.+\\.md$`);
  let maxSeq = 0;
  try {
    for (const name of readdirSync(handoffDir)) {
      const m = name.match(pattern);
      if (m) { const seq = parseInt(m[1], 10); if (seq > maxSeq) maxSeq = seq; }
    }
  } catch { /* ok */ }

  const nextSeq  = pad2(maxSeq + 1);
  const newFile  = join(handoffDir, `handoff_${date}_${nextSeq}_${suffix}.md`);

  if (existsSync(newFile)) {
    process.stderr.write(`ERROR: ${newFile} already exists\n`);
    process.exit(1);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  const templatePath = join(__dirname, "..", "references", "template.md");

  if (existsSync(templatePath)) {
    try {
      let content = readFileSync(templatePath, "utf8");
      const titleValue = suffix.replace(/-/g, " ");
      const createdStr = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
      content = content.replaceAll("__TITLE__",        titleValue);
      content = content.replaceAll("__DATE__",         createdStr);
      content = content.replaceAll("__NN__",           nextSeq);
      content = content.replaceAll("__SESSION_ID__",   sessionId);
      content = content.replaceAll("__SESSION_PATH__", sessionPath);
      content = content.replaceAll("__PLAN__",         planPath);
      writeFileSync(newFile, content, "utf8");
    } catch (err) {
      process.stderr.write(`WARN: template copy failed (${err.message}), outputting path only\n`);
    }
  }

  const created = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  process.stdout.write(JSON.stringify({
    runtime,
    session_id:   sessionId,
    session_path: sessionPath,
    plan:         planPath,
    summary,
    handoff_path: newFile.replace(/\\/g, "/"),
    created,
  }) + "\n");
  process.exit(0);
}

// --- Legacy mode (하위 호환) ---
// Usage: node next-handoff.mjs [projectRoot] [summary] [sessionId]
const [rawRoot = "", rawSummary = "", rawSessionId = ""] = args;

const sessionId   = resolveSessionId(rawSessionId, runtime);
const projectRoot = resolveProjectRoot(rawRoot || "");
const handoffDir  = join(projectRoot, "_handoff");

mkdirSync(handoffDir, { recursive: true });

// Date string YYYYMMDD
const date = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;

// Summary suffix
let suffix = sanitizeSummary(rawSummary);
if (!suffix) {
  suffix = `${pad2(now.getHours())}${pad2(now.getMinutes())}`;
}

// Sequence number: max existing NN for today + 1
const pattern = new RegExp(`^handoff_${date}_(\\d{2})_.+\\.md$`);
let maxSeq = 0;
try {
  for (const name of readdirSync(handoffDir)) {
    const m = name.match(pattern);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }
} catch {
  // handoffDir didn't exist yet — that's fine, mkdirSync above handles it
}

const nextSeq = pad2(maxSeq + 1);
const newFile = join(handoffDir, `handoff_${date}_${nextSeq}_${suffix}.md`);

if (existsSync(newFile)) {
  process.stderr.write(`ERROR: ${newFile} already exists\n`);
  process.exit(1);
}

// --- Template copy ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const templatePath = join(__dirname, "..", "references", "template.md");

if (existsSync(templatePath)) {
  try {
    let content = readFileSync(templatePath, "utf8");
    const titleValue = suffix.replace(/-/g, " ");
    const sessionPath = findSessionPath(sessionId);
    content = content.replaceAll("__TITLE__", titleValue);
    content = content.replaceAll("__DATE__", `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    content = content.replaceAll("__NN__", nextSeq);
    const planPath = findPlanPath(sessionId);
    content = content.replaceAll("__SESSION_ID__", sessionId);
    content = content.replaceAll("__SESSION_PATH__", sessionPath);
    content = content.replaceAll("__PLAN__", planPath);
    writeFileSync(newFile, content, "utf8");
  } catch (err) {
    process.stderr.write(`WARN: template copy failed (${err.message}), outputting path only\n`);
  }
} else {
  process.stderr.write(`WARN: template not found at ${templatePath}, outputting path only\n`);
}

process.stdout.write(newFile + "\n");
