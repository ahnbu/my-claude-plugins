#!/usr/bin/env node
// next-handoff.mjs — 다음 handoff 파일 경로를 생성하고 stdout으로 출력
// Usage: node next-handoff.mjs [projectRoot] [summary]
//   projectRoot: 명시적 프로젝트 루트 (비어 있으면 자동 탐색)
//   summary:     세션 작업 한줄요약 (미제공 시 HHMM 사용)

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const MARKERS = ["CHANGELOG.md", "AGENTS.md", "CLAUDE.md", "GEMINI.md"];

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

// --- Shared utils ---
const now = new Date();
const pad2 = (n) => String(n).padStart(2, "0");

// --- Main ---
const args = process.argv.slice(2);
const jsonMode = args[0] === "--json";

if (jsonMode) {
  // --json mode: output frontmatter fields as JSON, no file creation
  // Usage: node next-handoff.mjs --json "" "<session_id>"
  const rawSessionId = args[2] || "";
  const sessionId = rawSessionId.trim();
  process.stdout.write(JSON.stringify({
    created: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    session_id: sessionId,
    session_path: findSessionPath(sessionId),
    plan: findPlanPath(sessionId),
  }) + "\n");
  process.exit(0);
}

const [rawRoot = "", rawSummary = "", rawSessionId = ""] = args;

const projectRoot = resolveProjectRoot(rawRoot || "");
const handoffDir = join(projectRoot, "_handoff");

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
    const sessionId = rawSessionId.trim();
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
