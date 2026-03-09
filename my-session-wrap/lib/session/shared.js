"use strict";

const path = require("node:path");

function parseTimestamp(value) {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function stripSystemTags(text) {
  if (!text) return "";
  return text
    .replace(
      /<(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|antml:\w+)[^>]*>[\s\S]*?<\/\1>/gi,
      ""
    )
    .replace(
      /<\/?(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|antml:\w+)[^>]*>/gi,
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

function toPosixPath(value) {
  return value ? value.split(path.sep).join("/") : "";
}

module.exports = {
  extractPaths,
  extractPersistedOutputPath,
  findToolResults,
  findToolUses,
  formatClock,
  getTextContent,
  getThinkingContent,
  parseTimestamp,
  stripSystemTags,
  summarizeToolResult,
  toPosixPath,
};
