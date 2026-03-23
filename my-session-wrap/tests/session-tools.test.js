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
const { formatDuration, shortenToolName, cleanToolResultText } = require("../lib/session/shared.js");

// --- formatDuration ---
test("formatDuration: 0 → 00:00", () => {
  assert.equal(formatDuration(0), "00:00");
});

test("formatDuration: 45000 → 00:45", () => {
  assert.equal(formatDuration(45000), "00:45");
});

test("formatDuration: 77000 → 01:17", () => {
  assert.equal(formatDuration(77000), "01:17");
});

test("formatDuration: 3930000 → 1:05:30", () => {
  assert.equal(formatDuration(3930000), "1:05:30");
});

test("formatDuration: null → 00:00", () => {
  assert.equal(formatDuration(null), "00:00");
});

// --- shortenToolName ---
test("shortenToolName: 일반 도구는 그대로", () => {
  assert.equal(shortenToolName("Read"), "Read");
  assert.equal(shortenToolName("Bash"), "Bash");
});

test("shortenToolName: mcp plugin 도구 → action만", () => {
  assert.equal(
    shortenToolName("mcp__plugin_playwright_playwright__browser_run_code"),
    "browser_run_code"
  );
});

test("shortenToolName: mcp 서버 도구 → server:action", () => {
  assert.equal(
    shortenToolName("mcp__github__create_pull_request"),
    "github:create_pull_request"
  );
});

test("shortenToolName: server === action → server만", () => {
  assert.equal(shortenToolName("mcp__fetch__fetch"), "fetch");
});

// --- cleanToolResultText ---
test("cleanToolResultText: raw JSON array 파싱", () => {
  const raw = JSON.stringify([{ type: "text", text: "hello world" }]);
  assert.equal(cleanToolResultText(raw), "hello world");
});

test("cleanToolResultText: Playwright 코드블록 정리", () => {
  const raw = "### Ran Playwright code\n```js\nconsole.log('hi');\n```";
  assert.equal(cleanToolResultText(raw), "Ran Playwright code");
});

test("cleanToolResultText: ### Result 접두사 제거", () => {
  const raw = JSON.stringify([{ type: "text", text: "### Result\nhello" }]);
  assert.equal(cleanToolResultText(raw), "hello");
});

test("cleanToolResultText: 일반 텍스트 통과", () => {
  assert.equal(cleanToolResultText("regular text"), "regular text");
});

test("cleanToolResultText: 빈 입력", () => {
  assert.equal(cleanToolResultText(""), "");
  assert.equal(cleanToolResultText(null), "");
});

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
  assert.match(transcript, /도구.*Read/);
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

// session-transcript CLI 테스트: session-transcript 스킬 미복구로 생략
