#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadSessionBundle } = require("../../../lib/session/session-loader.js");
const { normalizeSessionBundle } = require("../../../lib/session/session-normalizer.js");
const { buildTranscript } = require("../../../lib/session/transcript-builder.js");

function parseArgs(argv) {
  const args = {
    format: "markdown",
    toolResults: "meaningful",
  };
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
      case "--tool-results":
        args.toolResults = nextValue;
        index += 1;
        break;
      case "--claude-projects-dir":
        args.claudeProjectsDir = nextValue;
        index += 1;
        break;
      case "--include-thinking":
        args.includeThinking = true;
        break;
      case "--no-tools":
        args.noTools = true;
        break;
      default:
        throw new Error(`Unknown option: ${value}`);
    }
  }

  if (positionals.length === 0) {
    throw new Error(
      "Usage: session_transcript.js <sessionId> [--format markdown|json] [--tool-results none|errors|paths|meaningful|all]"
    );
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
  const transcript = buildTranscript(normalized, args);
  const output =
    args.format === "json" ? JSON.stringify(transcript, null, 2) : transcript;

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
