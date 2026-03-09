"use strict";

const {
  extractPaths,
  extractPersistedOutputPath,
  formatClock,
  summarizeToolResult,
} = require("./shared.js");

function isMeaningfulToolResult(text) {
  if (!text) return false;
  if (extractPersistedOutputPath(text)) return true;
  if (extractPaths(text).length > 0) return true;

  const compact = text.trim();
  if (!compact) return false;
  if (compact.length > 120) return false;
  if (/Preview \(first/i.test(compact)) return false;
  if (/^\d+[→|]/.test(compact)) return false;
  if (/^Line \d+\s*\|/i.test(compact)) return false;
  if ((compact.match(/\n/g) || []).length > 2) return false;
  return true;
}

function shouldIncludeToolResult(event, policy, toolName) {
  switch (policy) {
    case "none":
      return false;
    case "errors":
      return event.isError;
    case "paths":
      return Boolean(
        toolName &&
          (extractPersistedOutputPath(event.rawText) ||
            extractPaths(event.rawText).length > 0)
      );
    case "all":
      return true;
    case "meaningful":
    default:
      if (event.isError) return true;
      if (!toolName) return false;
      return isMeaningfulToolResult(event.rawText);
  }
}

function buildTranscript(normalized, options = {}) {
  const format = options.format || "markdown";
  const includeTools = !options.noTools;
  const includeThinking = Boolean(options.includeThinking);
  const toolResultsPolicy = options.toolResults || "meaningful";
  const originMs = normalized.events[0]?.timestampMs ?? null;
  const planTimestamps = new Set(
    normalized.events
      .filter((event) => event.kind === "plan_content")
      .map((event) => event.timestamp)
  );

  const entries = [];
  for (const event of normalized.events) {
    if (event.kind === "user_text") {
      const text =
        planTimestamps.has(event.timestamp) &&
        /Implement the following plan:/i.test(event.text)
          ? "Implement the following plan:"
          : event.text;
      entries.push({
        kind: "user_text",
        text,
        timestamp: event.timestamp,
        timeLabel: formatClock(event.timestampMs, originMs),
      });
      continue;
    }

    if (event.kind === "plan_content") {
      entries.push({
        kind: "plan_content",
        text: event.text,
        timestamp: event.timestamp,
        timeLabel: formatClock(event.timestampMs, originMs),
      });
      continue;
    }

    if (event.kind === "assistant_text") {
      entries.push({
        kind: "assistant_text",
        text: event.text,
        timestamp: event.timestamp,
        timeLabel: formatClock(event.timestampMs, originMs),
      });
      continue;
    }

    if (event.kind === "assistant_thinking" && includeThinking) {
      entries.push({
        kind: "assistant_thinking",
        text: event.text,
        timestamp: event.timestamp,
        timeLabel: formatClock(event.timestampMs, originMs),
      });
      continue;
    }

    if (!includeTools) {
      continue;
    }

    if (event.kind === "tool_use") {
      entries.push({
        input: event.input,
        kind: "tool_use",
        text: JSON.stringify(event.input || {}),
        timeLabel: formatClock(event.timestampMs, originMs),
        timestamp: event.timestamp,
        toolName: event.toolName,
        toolUseId: event.toolUseId,
      });
      continue;
    }

    if (event.kind === "tool_result") {
      const toolName = normalized.toolUseLookup[event.toolUseId] || "";
      if (!shouldIncludeToolResult(event, toolResultsPolicy, toolName)) {
        continue;
      }

      entries.push({
        isError: event.isError,
        kind: "tool_result",
        text: summarizeToolResult(event.rawText),
        timeLabel: formatClock(event.timestampMs, originMs),
        timestamp: event.timestamp,
        toolName: toolName || "unknown",
        toolUseId: event.toolUseId,
      });
    }
  }

  if (format === "json") {
    return {
      entries,
      sessionId: normalized.sessionId,
    };
  }

  const lines = [
    "# Session Transcript",
    "",
    `- Session ID: ${normalized.sessionId}`,
    "",
  ];

  const planEntries = entries.filter((entry) => entry.kind === "plan_content");
  if (planEntries.length > 0) {
    lines.push("## Plan", "");
    for (const entry of planEntries) {
      lines.push(entry.text, "");
    }
  }

  lines.push("## Conversation", "");
  for (const entry of entries) {
    if (entry.kind === "plan_content") continue;

    if (entry.kind === "user_text") {
      lines.push(`[${entry.timeLabel}] USER`, entry.text, "");
      continue;
    }

    if (entry.kind === "assistant_text") {
      lines.push(`[${entry.timeLabel}] ASSISTANT`, entry.text, "");
      continue;
    }

    if (entry.kind === "assistant_thinking") {
      lines.push(`[${entry.timeLabel}] THINKING`, entry.text, "");
      continue;
    }

    if (entry.kind === "tool_use") {
      lines.push(
        `[${entry.timeLabel}] TOOL USE ${entry.toolName}`,
        entry.text,
        ""
      );
      continue;
    }

    if (entry.kind === "tool_result") {
      const label = entry.isError ? "TOOL ERROR" : "TOOL RESULT";
      lines.push(
        `[${entry.timeLabel}] ${label} ${entry.toolName}`,
        entry.text,
        ""
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  buildTranscript,
};
