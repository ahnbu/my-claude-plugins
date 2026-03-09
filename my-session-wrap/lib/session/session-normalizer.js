"use strict";

const path = require("node:path");
const {
  findToolResults,
  findToolUses,
  getTextContent,
  getThinkingContent,
  parseTimestamp,
} = require("./shared.js");

function pushTopLevelMessageEvents(events, entry, source, agentId) {
  const timestamp = entry.timestamp || "";
  const timestampMs = parseTimestamp(timestamp);

  if (entry.type === "user" && entry.message) {
    const content = entry.message.content || entry.message;
    const text = getTextContent(content);
    if (text) {
      events.push({
        agentId,
        kind: "user_text",
        source,
        text,
        timestamp,
        timestampMs,
      });
    }

    for (const toolResult of findToolResults(content)) {
      events.push({
        agentId,
        isError: toolResult.isError,
        kind: "tool_result",
        rawText: toolResult.rawText,
        source,
        timestamp,
        timestampMs,
        toolUseId: toolResult.toolUseId,
      });
    }

    if (entry.planContent) {
      events.push({
        agentId,
        kind: "plan_content",
        source,
        text: entry.planContent,
        timestamp,
        timestampMs,
      });
    }

    return;
  }

  if (entry.type !== "assistant" || !entry.message) {
    return;
  }

  const text = getTextContent(entry.message.content || entry.message);
  const thinking = getThinkingContent(entry.message.content);
  if (text) {
    events.push({
      agentId,
      kind: "assistant_text",
      source,
      text,
      timestamp,
      timestampMs,
    });
  }

  if (thinking) {
    events.push({
      agentId,
      kind: "assistant_thinking",
      source,
      text: thinking,
      timestamp,
      timestampMs,
    });
  }

  for (const toolUse of findToolUses(entry.message.content)) {
    events.push({
      agentId,
      input: toolUse.input,
      kind: "tool_use",
      source,
      timestamp,
      timestampMs,
      toolName: toolUse.toolName,
      toolUseId: toolUse.toolUseId,
    });
  }
}

function pushProgressEvents(events, entry, source, agentId) {
  const timestamp = entry.timestamp || "";
  const timestampMs = parseTimestamp(timestamp);
  const progressType = entry.data?.type || "progress";

  events.push({
    agentId: entry.data?.agentId || agentId || "",
    command: entry.data?.command || "",
    hookEvent: entry.data?.hookEvent || "",
    kind: "progress",
    progressType,
    prompt: entry.data?.prompt || "",
    source,
    timestamp,
    timestampMs,
  });

  const progressMessage = entry.data?.message?.message;
  if (!progressMessage) {
    return;
  }

  for (const toolResult of findToolResults(progressMessage.content)) {
    events.push({
      agentId: entry.data?.agentId || agentId || "",
      fromProgressMessage: true,
      isError: toolResult.isError,
      kind: "tool_result",
      progressType,
      rawText: toolResult.rawText,
      source,
      timestamp,
      timestampMs,
      toolUseId: toolResult.toolUseId,
    });
  }
}

function normalizeEntries(entries, source, agentId) {
  const events = [];

  for (const entry of entries) {
    if (!entry || !entry.timestamp) continue;

    if (entry.type === "system" && entry.subtype === "turn_duration") {
      events.push({
        agentId,
        durationMs: entry.durationMs || 0,
        kind: "turn_duration",
        source,
        timestamp: entry.timestamp,
        timestampMs: parseTimestamp(entry.timestamp),
      });
      continue;
    }

    if (entry.type === "progress" && entry.data) {
      pushProgressEvents(events, entry, source, agentId);
      continue;
    }

    pushTopLevelMessageEvents(events, entry, source, agentId);
  }

  return events.sort((left, right) => left.timestampMs - right.timestampMs);
}

function normalizeSessionBundle(bundle) {
  const mainEvents = normalizeEntries(bundle.mainEntries, "main", "");
  const subagents = bundle.subagents.map((subagent) => {
    const events = normalizeEntries(subagent.entries, "subagent", subagent.agentId);
    return {
      agentId: subagent.agentId,
      events,
      filePath: subagent.filePath,
      firstTimestampMs: events[0]?.timestampMs ?? null,
      lastTimestampMs: events[events.length - 1]?.timestampMs ?? null,
    };
  });

  return {
    events: mainEvents,
    mainFilePath: bundle.mainFilePath,
    sessionId: bundle.sessionId,
    subagents,
    toolUseLookup: Object.fromEntries(
      mainEvents
        .filter((event) => event.kind === "tool_use")
        .map((event) => [event.toolUseId, event.toolName])
    ),
  };
}

module.exports = {
  normalizeSessionBundle,
};
