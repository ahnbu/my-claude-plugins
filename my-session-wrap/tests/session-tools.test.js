const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const fixtureRoot = path.join(__dirname, "fixtures", "session-fixture");
const sessionId = "session-main-001";

const { loadSessionBundle } = require("../lib/session/session-loader.js");
const { normalizeSessionBundle } = require("../lib/session/session-normalizer.js");
const { buildTimeline } = require("../lib/session/timeline-builder.js");
const { buildTranscript } = require("../lib/session/transcript-builder.js");

test("loadSessionBundle finds the main session file and subagent transcripts", () => {
  const bundle = loadSessionBundle(sessionId, { claudeProjectsDir: fixtureRoot });

  assert.equal(bundle.sessionId, sessionId);
  assert.match(bundle.mainFilePath, /session-main-001\.jsonl$/);
  assert.equal(bundle.subagentFiles.length, 1);
  assert.match(bundle.subagentFiles[0], /agent-a1\.jsonl$/);
});

test("normalizeSessionBundle extracts plan, tool, progress, and turn-duration events", () => {
  const bundle = loadSessionBundle(sessionId, { claudeProjectsDir: fixtureRoot });
  const normalized = normalizeSessionBundle(bundle);

  assert.ok(normalized.events.some((event) => event.kind === "plan_content"));
  assert.ok(normalized.events.some((event) => event.kind === "tool_use" && event.toolName === "Read"));
  assert.ok(normalized.events.some((event) => event.kind === "tool_result" && event.toolUseId === "toolu_bash_1"));
  assert.ok(normalized.events.some((event) => event.kind === "progress" && event.progressType === "hook_progress"));
  assert.ok(normalized.events.some((event) => event.kind === "turn_duration" && event.durationMs === 9000));
  assert.equal(normalized.subagents.length, 1);
  assert.equal(normalized.subagents[0].agentId, "agent-a1");
});

test("buildTimeline summarizes tool waits, turn durations, and subagent spans", () => {
  const bundle = loadSessionBundle(sessionId, { claudeProjectsDir: fixtureRoot });
  const normalized = normalizeSessionBundle(bundle);
  const timeline = buildTimeline(normalized);

  assert.equal(timeline.summary.sessionElapsedMs, 31000);
  assert.equal(timeline.summary.totalToolWaitMs, 12000);
  assert.equal(timeline.summary.totalTurnDurationMs, 9000);
  assert.equal(timeline.summary.subagentSpanMs, 4900);
  assert.equal(timeline.toolCalls.length, 3);
  assert.match(timeline.toolCalls[1].resultPreview, /Full output saved to:/);
});

test("buildTranscript keeps plan content and meaningful tool results by default", () => {
  const bundle = loadSessionBundle(sessionId, { claudeProjectsDir: fixtureRoot });
  const normalized = normalizeSessionBundle(bundle);
  const transcript = buildTranscript(normalized, { format: "markdown" });

  assert.match(transcript, /## Plan/);
  assert.match(transcript, /session-timeline 구현/);
  assert.match(transcript, /TOOL USE Read/);
  assert.match(transcript, /D:\\work\\notes\.md/);
  assert.match(transcript, /Full output saved to:/);
  assert.match(transcript, /Grep failed: access denied/);
  assert.doesNotMatch(transcript, /Preview \(first 2KB\):\n> line 1\n> line 2/);
});

test("buildTranscript respects tool result filtering options", () => {
  const bundle = loadSessionBundle(sessionId, { claudeProjectsDir: fixtureRoot });
  const normalized = normalizeSessionBundle(bundle);
  const transcript = buildTranscript(normalized, {
    format: "json",
    toolResults: "errors",
  });

  assert.equal(transcript.entries.some((entry) => entry.kind === "tool_result" && /access denied/.test(entry.text)), true);
  assert.equal(transcript.entries.some((entry) => entry.kind === "tool_result" && /notes\.md/.test(entry.text)), false);
  assert.equal(transcript.entries.some((entry) => entry.kind === "plan_content"), true);
});

test("session_timeline CLI prints JSON for the requested session", () => {
  const cliPath = path.join(
    __dirname,
    "..",
    "skills",
    "session-timeline",
    "scripts",
    "session_timeline.js"
  );

  const raw = execFileSync(process.execPath, [
    cliPath,
    sessionId,
    "--format",
    "json",
    "--claude-projects-dir",
    fixtureRoot,
  ], { encoding: "utf8" });

  const parsed = JSON.parse(raw);
  assert.equal(parsed.sessionId, sessionId);
  assert.equal(parsed.summary.totalToolWaitMs, 12000);
});

test("session_transcript CLI can hide tools entirely", () => {
  const cliPath = path.join(
    __dirname,
    "..",
    "skills",
    "session-transcript",
    "scripts",
    "session_transcript.js"
  );

  const raw = execFileSync(process.execPath, [
    cliPath,
    sessionId,
    "--format",
    "markdown",
    "--no-tools",
    "--claude-projects-dir",
    fixtureRoot,
  ], { encoding: "utf8" });

  assert.match(raw, /## Conversation/);
  assert.doesNotMatch(raw, /TOOL USE/);
  assert.match(raw, /## Plan/);
});
