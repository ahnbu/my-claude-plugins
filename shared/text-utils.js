"use strict";
// shared/text-utils.js — 공통 텍스트 유틸리티 (세션 파싱·타임라인·트랜스크립트 공유)
// 원본: my-session-wrap/lib/session/shared.js (소스 오브 트루스는 이 파일)

const path = require("node:path");

function parseTimestamp(value) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function extractSlashCommands(text) {
  if (!text) return [];
  const re = /<command-name>([^<]+)<\/command-name>/gi;
  const cmds = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    cmds.push(m[1].trim());
  }
  return cmds;
}

function stripSystemTags(text) {
  if (!text) return "";
  return text
    .replace(
      /<(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|task-notification|antml:\w+)[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(
      /<\/?(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|task-notification|antml:\w+)[^>]*>/gi,
      ""
    )
    .trim();
}

function getTextContent(content) {
  if (!content) return "";
  if (typeof content === "string") return stripSystemTags(content);
  if (!Array.isArray(content)) return "";

  return stripSystemTags(
    content
      .filter((block) => block && block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n")
  );
}

function getThinkingContent(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && block.type === "thinking" && block.thinking)
    .map((block) => block.thinking)
    .join("\n")
    .trim();
}

function findToolUses(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block && block.type === "tool_use")
    .map((block) => ({
      toolUseId: block.id || "",
      toolName: block.name || "unknown",
      input: block.input || {},
    }));
}

function findToolResults(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((block) => block && block.type === "tool_result")
    .map((block) => ({
      toolUseId: block.tool_use_id || "",
      rawText: typeof block.content === "string" ? block.content : JSON.stringify(block.content || {}),
      isError: Boolean(block.is_error),
    }));
}

function extractPersistedOutputPath(text) {
  if (!text) return "";
  const match = text.match(/Full output saved to:\s*([^\r\n]+)/i);
  return match ? match[1].trim() : "";
}

function extractPaths(text) {
  if (!text) return [];

  const matches = text.match(/[A-Za-z]:\\[^\r\n]+|\/[A-Za-z0-9._\-\/]+/g) || [];
  return [...new Set(matches.map((value) => value.trim()).filter(Boolean))];
}

function summarizeToolResult(text) {
  if (!text) return "";

  const persistedPath = extractPersistedOutputPath(text);
  if (persistedPath) {
    return `Full output saved to: ${persistedPath}`;
  }

  const compact = text.trim();
  if (compact.length <= 160) {
    return compact;
  }

  return `${compact.slice(0, 157)}...`;
}

function formatClock(timestampMs, originMs) {
  if (timestampMs == null || originMs == null) return "";
  const delta = Math.max(0, timestampMs - originMs);
  const totalSeconds = Math.floor(delta / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

function shortenToolName(name) {
  if (!name || !name.startsWith("mcp__")) return name;
  const rest = name.slice(5); // remove "mcp__"
  const idx = rest.indexOf("__");
  if (idx === -1) return rest;
  const server = rest.slice(0, idx);
  const action = rest.slice(idx + 2);
  if (server.startsWith("plugin_")) return action;
  if (server === action) return server;
  return `${server}:${action}`;
}

function getToolContext(input) {
  if (!input) return "";
  if (input.file_path) return String(input.file_path);
  if (input.command) return String(input.command).slice(0, 60);
  if (input.pattern) return String(input.pattern);
  if (input.url) return String(input.url);
  if (input.path) return String(input.path);
  if (input.description) return String(input.description).slice(0, 60);
  return "";
}

function cleanToolResultText(raw) {
  if (!raw) return "";
  let text = raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const textBlocks = parsed.filter((b) => b && b.type === "text" && b.text);
      if (textBlocks.length > 0) {
        text = textBlocks.map((b) => b.text).join("\n");
      }
    }
  } catch {
    // Not JSON, use raw text
  }
  // Remove Playwright code blocks
  text = text.replace(/### Ran Playwright code[\s\S]*/, "Ran Playwright code");
  // Remove "### Result\n" prefix
  text = text.replace(/^### Result\n/, "");
  return text.trim();
}

function toPosixPath(value) {
  return value ? value.split(path.sep).join("/") : "";
}

// Codex $skill 패턴 (환경변수 $PATH 등 전체대문자 제외)
function extractCodexSkills(text) {
  if (!text) return [];
  const re = /\$([a-zA-Z][a-zA-Z0-9_-]+)/g;
  const cmds = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== m[1].toUpperCase()) cmds.push("$" + m[1]);
  }
  return cmds;
}

// Gemini/Antigravity /skill 패턴
function extractSlashSkills(text) {
  if (!text) return [];
  const re = /^\/([a-zA-Z][a-zA-Z0-9_-]+)/gm;
  const cmds = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    cmds.push("/" + m[1]);
  }
  return cmds;
}

module.exports = {
  cleanToolResultText,
  extractCodexSkills,
  extractPaths,
  extractSlashCommands,
  extractSlashSkills,
  extractPersistedOutputPath,
  findToolResults,
  findToolUses,
  formatClock,
  formatDuration,
  getTextContent,
  getThinkingContent,
  getToolContext,
  parseTimestamp,
  shortenToolName,
  stripSystemTags,
  summarizeToolResult,
  toPosixPath,
};
