"use strict";

const { cleanToolResultText, formatClock, formatDuration, getToolContext, shortenToolName, summarizeToolResult } = require("./shared.js");

function clockToSeconds(clock) {
  if (!clock) return 0;
  const parts = clock.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// resultPreview may be a raw JSON array wrapper or truncated mid-JSON.
// Step 1: shared cleanToolResultText (full JSON parse + Playwright code removal)
// Step 2: strip remaining JSON array wrapper (happens when parse failed but content was modified)
function timelinePreview(text) {
  if (!text) return "(no result)";
  let result = cleanToolResultText(text);
  // If still wrapped in JSON array (full parse failed), extract text value
  const m = result.match(/^\[{"type":"text","text":"([\s\S]{0,150})/);
  if (m) {
    result = m[1]
      .replace(/\\n/g, " ")
      .replace(/\\"/g, '"')
      .replace(/^### Result\s+/, "");
  }
  return result.replace(/\n/g, " ").replace(/"$/, "").slice(0, 60);
}

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

  // 턴 경계: turn_duration 이벤트의 timestampMs 목록 (오름차순)
  const turnEndTimestamps = mainEvents
    .filter((event) => event.kind === "turn_duration")
    .map((event) => event.timestampMs);

  // activeElapsedMs: 각 턴의 시작(직전 user_text 또는 originMs) ~ turn_duration 구간 합산
  // user_text 이벤트 목록
  const userTextEvents = mainEvents.filter((event) => event.kind === "user_text");
  const activeElapsedMs = turnEndTimestamps.reduce((sum, turnEndMs) => {
    // 해당 turn_duration 이전의 가장 가까운 user_text 시작점
    const prevUserText = [...userTextEvents].reverse().find((e) => e.timestampMs <= turnEndMs);
    const turnStartMs = prevUserText ? prevUserText.timestampMs : originMs;
    return sum + (turnEndMs - turnStartMs);
  }, 0);

  const toolCalls = mainEvents
    .filter((event) => event.kind === "tool_use" && event.toolName !== "Task")
    .map((toolUse) => {
      const toolResult = mainToolResults.find(
        (candidate) =>
          candidate.toolUseId === toolUse.toolUseId &&
          candidate.timestampMs >= toolUse.timestampMs
      );

      const waitMs = toolResult ? toolResult.timestampMs - toolUse.timestampMs : null;
      // 이 tool_use 이후 가장 가까운 turn_duration이 해당 턴 종료
      const turnEndMs = turnEndTimestamps.find((t) => t >= toolUse.timestampMs) || null;
      return {
        input: toolUse.input,
        resultPreview: toolResult ? summarizeToolResult(toolResult.rawText) : "",
        startClock: formatClock(toolUse.timestampMs, originMs),
        status: toolResult ? (toolResult.isError ? "error" : "ok") : "pending",
        timestamp: toolUse.timestamp,
        timestampMs: toolUse.timestampMs,
        toolName: toolUse.toolName,
        toolUseId: toolUse.toolUseId,
        turnEndMs,
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
    activeElapsedMs,
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
  const { summary, sessionId, toolCalls, subagentSpans } = timeline;

  const lines = [
    "# Session Timeline",
    "",
    "| 항목 | 값 |",
    "|------|-----|",
    `| Session ID | \`${sessionId}\` |`,
    `| 작업 소요 | ${formatDuration(summary.activeElapsedMs)} |`,
    `| AI 턴 소요 | ${formatDuration(summary.totalTurnDurationMs)} |`,
    `| 도구 대기 | ${formatDuration(summary.totalToolWaitMs)} |`,
    `| 서브에이전트 | ${formatDuration(summary.subagentSpanMs)} |`,
    "",
    `## Tools (${toolCalls.length}건)`,
    "",
  ];

  if (toolCalls.length === 0) {
    lines.push("도구 호출 없음", "");
  } else {
    lines.push(
      "| # | 시각 | 간격 | 도구 | 대상 | 소요 | 대기 | 상태 | 결과 요약 |",
      "|---|------|------|------|------|------|------|------|-----------|"
    );
    const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5분
    let rowNum = 1;
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      // idle 행 삽입: 이전 턴과 현재 턴이 다르고 gap이 5분 초과
      if (i > 0 && toolCalls[i - 1].turnEndMs !== toolCall.turnEndMs) {
        const prevTurnEnd = toolCalls[i - 1].turnEndMs;
        if (prevTurnEnd != null) {
          const idleMs = toolCall.timestampMs - prevTurnEnd;
          if (idleMs > IDLE_THRESHOLD_MS) {
            lines.push(`| | | ⏸ idle | | | ${formatDuration(idleMs)} | | | |`);
          }
        }
      }
      const shortName = shortenToolName(toolCall.toolName);
      const wait = toolCall.waitMs != null ? formatDuration(toolCall.waitMs) : "pending";
      const preview = timelinePreview(toolCall.resultPreview);
      const prevSeconds = i === 0 ? 0 : clockToSeconds(toolCalls[i - 1].startClock);
      const gap = formatDuration((clockToSeconds(toolCall.startClock) - prevSeconds) * 1000);
      const inputCtx = getToolContext(toolCall.input).replace(/\|/g, "\\|").slice(0, 40);
      // 소요: 같은 턴이면 다음 도구까지, 턴 마지막이면 turn_duration까지
      const isLastInTurn =
        i === toolCalls.length - 1 || toolCall.turnEndMs !== toolCalls[i + 1].turnEndMs;
      let stepDuration;
      if (isLastInTurn && toolCall.turnEndMs != null) {
        stepDuration = formatDuration(toolCall.turnEndMs - toolCall.timestampMs);
      } else if (!isLastInTurn) {
        const nextStartSec = clockToSeconds(toolCalls[i + 1].startClock);
        const currentStartSec = clockToSeconds(toolCall.startClock);
        stepDuration = formatDuration((nextStartSec - currentStartSec) * 1000);
      } else {
        // turnEndMs 없는 마지막 도구 폴백: 세션 종료까지
        const nextStart = summary.sessionElapsedMs / 1000;
        const currentStart = clockToSeconds(toolCall.startClock);
        stepDuration = formatDuration((nextStart - currentStart) * 1000);
      }
      lines.push(
        `| ${rowNum++} | ${toolCall.startClock} | ${gap} | ${shortName} | ${inputCtx} | ${stepDuration} | ${wait} | ${toolCall.status} | ${preview} |`
      );
    }
    lines.push("");
  }

  lines.push(`## Subagents (${subagentSpans.length}건)`, "");
  if (subagentSpans.length === 0) {
    lines.push("| Agent | 구간 | 소요 |", "|-------|------|------|", "| (없음) | | |", "");
  } else {
    lines.push("| Agent | 구간 | 소요 |", "|-------|------|------|");
    for (const subagent of subagentSpans) {
      lines.push(
        `| ${subagent.agentId} | ${subagent.startClock} → ${subagent.endClock} | ${formatDuration(subagent.spanMs)} |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

module.exports = {
  buildTimeline,
  renderTimelineMarkdown,
};
