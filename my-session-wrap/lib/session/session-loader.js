"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function resolveProjectsDir(options = {}) {
  if (options.claudeProjectsDir) {
    return path.resolve(options.claudeProjectsDir);
  }

  return path.join(os.homedir(), ".claude", "projects");
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findSessionFile(sessionId, rootDir) {
  const stack = [rootDir];
  const targetFile = `${sessionId}.jsonl`;

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === targetFile) {
        return fullPath;
      }
    }
  }

  return "";
}

function loadSessionBundle(sessionId, options = {}) {
  if (!sessionId) {
    throw new Error("sessionId is required");
  }

  const claudeProjectsDir = resolveProjectsDir(options);
  if (!fs.existsSync(claudeProjectsDir)) {
    throw new Error(`Claude projects directory not found: ${claudeProjectsDir}`);
  }

  const mainFilePath = findSessionFile(sessionId, claudeProjectsDir);
  if (!mainFilePath) {
    throw new Error(`Session file not found for sessionId: ${sessionId}`);
  }

  const mainEntries = readJsonl(mainFilePath);
  const subagentsDir = path.join(path.dirname(mainFilePath), sessionId, "subagents");
  const subagentFiles = fs.existsSync(subagentsDir)
    ? fs
        .readdirSync(subagentsDir)
        .filter((name) => /^agent-.*\.jsonl$/i.test(name))
        .sort()
        .map((name) => path.join(subagentsDir, name))
    : [];

  const subagents = subagentFiles.map((filePath) => ({
    agentId: path.basename(filePath, ".jsonl"),
    filePath,
    entries: readJsonl(filePath),
  }));

  return {
    claudeProjectsDir,
    mainEntries,
    mainFilePath,
    sessionId,
    subagentFiles,
    subagents,
  };
}

module.exports = {
  loadSessionBundle,
  readJsonl,
};
