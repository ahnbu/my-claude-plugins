#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadSessionBundle } = require("../../../lib/session/session-loader.js");
const { normalizeSessionBundle } = require("../../../lib/session/session-normalizer.js");
const { buildTimeline, renderTimelineMarkdown } = require("../../../lib/session/timeline-builder.js");

function parseArgs(argv) {
  const args = { format: "markdown" };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const nextValue = argv[index + 1];
    switch (value) {
      case "--format":
        args.format = nextValue;
        index += 1;
        break;
      case "--save":
        args.save = nextValue;
        index += 1;
        break;
      case "--claude-projects-dir":
        args.claudeProjectsDir = nextValue;
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  if (positionals.length === 0) {
    throw new Error("Usage: session_timeline.js <sessionId> [--format markdown|json] [--save <path>]");
  }

  args.sessionId = positionals[0];
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = loadSessionBundle(args.sessionId, {
    claudeProjectsDir: args.claudeProjectsDir,
  });
  const normalized = normalizeSessionBundle(bundle);
  const timeline = buildTimeline(normalized);
  const output =
    args.format === "json"
      ? JSON.stringify(timeline, null, 2)
      : renderTimelineMarkdown(timeline);

  if (args.save) {
    fs.writeFileSync(path.resolve(args.save), output, "utf8");
  }

  process.stdout.write(output);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
