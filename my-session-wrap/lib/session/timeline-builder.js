"use strict";

const { formatClock, summarizeToolResult } = require("./shared.js");

function buildTimeline(normalized) {
  const mainEvents = normalized.events;
  if (mainEvents.length === 0) {
    return {
      sessionId: normalized.sessionId,
      subagentSpans: [],
      summary: {
        hookProgressCount: 0,
        mcpProgressCount: 0,
        sessionElapsedMs: 0,
        subagentSpanMs: 0,
        totalToolWaitMs: 0,
        totalTurnDurationMs: 0,
      },
      toolCalls: [],
    };
  }

  const originMs = mainEvents[0].timestampMs;
  const lastMs = mainEvents[mainEvents.length - 1].timestampMs;
  const mainToolResults = mainEvents.filter((event) => event.kind === "tool_result");

  const toolCalls = mainEvents
    .filter((event) => event.kind === "tool_use" && event.toolName !== "Task")
    .map((toolUse) => {
      const toolResult = mainToolResults.find(
        (candidate) =>
          candidate.toolUseId === toolUse.toolUseId &&
          candidate.timestampMs >= toolUse.timestampMs
      );

      const waitMs = toolResult ? toolResult.timestampMs - toolUse.timestampMs : null;
      return {
        input: toolUse.input,
        resultPreview: toolResult ? summarizeToolResult(toolResult.rawText) : "",
        startClock: formatClock(toolUse.timestampMs, originMs),
        status: toolResult ? (toolResult.isError ? "error" : "ok") : "pending",
        timestamp: toolUse.timestamp,
        toolName: toolUse.toolName,
        toolUseId: toolUse.toolUseId,
        waitMs,
      };
    });

  const subagentSpans = normalized.subagents.map((subagent) => ({
    agentId: subagent.agentId,
    endClock: formatClock(subagent.lastTimestampMs, originMs),
    filePath: subagent.filePath,
    spanMs:
      subagent.firstTimestampMs == null || subagent.lastTimestampMs == null
        ? 0
        : subagent.lastTimestampMs - subagent.firstTimestampMs,
    startClock: formatClock(subagent.firstTimestampMs, originMs),
  }));

  const summary = {
    hookProgressCount: mainEvents.filter(
      (event) => event.kind === "progress" && event.progressType === "hook_progress"
    ).length,
    mcpProgressCount: mainEvents.filter(
      (event) => event.kind === "progress" && event.progressType === "mcp_progress"
    ).length,
    sessionElapsedMs: lastMs - originMs,
    subagentSpanMs: subagentSpans.reduce((sum, item) => sum + item.spanMs, 0),
    totalToolWaitMs: toolCalls.reduce((sum, item) => sum + (item.waitMs || 0), 0),
    totalTurnDurationMs: mainEvents
      .filter((event) => event.kind === "turn_duration")
      .reduce((sum, event) => sum + event.durationMs, 0),
  };

  return {
    sessionId: normalized.sessionId,
    subagentSpans,
    summary,
    toolCalls,
  };
}

function renderTimelineMarkdown(timeline) {
  const lines = [
    "# Session Timeline",
    "",
    `- Session ID: ${timeline.sessionId}`,
    `- Session elapsed: ${timeline.summary.sessionElapsedMs} ms`,
    `- Total tool wait: ${timeline.summary.totalToolWaitMs} ms`,
    `- Total AI turn duration: ${timeline.summary.totalTurnDurationMs} ms`,
    `- Total subagent span: ${timeline.summary.subagentSpanMs} ms`,
    "",
    "## Tools",
  ];

  if (timeline.toolCalls.length === 0) {
    lines.push("- No direct tool calls");
  } else {
    for (const toolCall of timeline.toolCalls) {
      lines.push(
        `- [${toolCall.startClock}] ${toolCall.toolName} (${toolCall.waitMs ?? "pending"} ms)`,
        `  ${toolCall.resultPreview || "(no result)"}`
      );
    }
  }

  lines.push("", "## Subagents");
  if (timeline.subagentSpans.length === 0) {
    lines.push("- No subagent spans");
  } else {
    for (const subagent of timeline.subagentSpans) {
      lines.push(
        `- ${subagent.agentId}: ${subagent.spanMs} ms (${subagent.startClock} -> ${subagent.endClock})`
      );
    }
  }

  return lines.join("\n");
}

module.exports = {
  buildTimeline,
  renderTimelineMarkdown,
};
