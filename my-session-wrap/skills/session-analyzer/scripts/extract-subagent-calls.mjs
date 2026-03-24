#!/usr/bin/env node
// extract-subagent-calls.mjs - Extract SubAgent invocations from debug log
//
// Usage: node extract-subagent-calls.mjs <debug-log-path>
// Output: JSON array of subagent calls with timestamps and results

import fs from 'fs';
import readline from 'readline';

const debugLog = process.argv[2];

if (!debugLog || !fs.existsSync(debugLog)) {
  process.stderr.write(`Usage: node extract-subagent-calls.mjs <debug-log-path>\n`);
  process.exit(1);
}

const TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/;
const AGENT_START_RE = /SubagentStart with query: (\S+)/;
const AGENT_STOP_RE = /SubagentStop with query:/;

const subagentCalls = [];
const subagentResults = [];
const summary = { Explore: 0, 'gap-analyzer': 0, reviewer: 0, worker: 0, total: 0 };

const lines = fs.readFileSync(debugLog, 'utf8').split('\n');

for (const line of lines) {
  const tsMatch = line.match(TS_RE);
  const timestamp = tsMatch ? tsMatch[1] : '';

  const startMatch = line.match(AGENT_START_RE);
  if (startMatch) {
    const agentName = startMatch[1];
    subagentCalls.push({ timestamp, event: 'start', agent: agentName });

    // summary 집계
    for (const key of Object.keys(summary)) {
      if (key !== 'total' && agentName.startsWith(key)) {
        summary[key]++;
        summary.total++;
        break;
      }
    }
    continue;
  }

  if (AGENT_STOP_RE.test(line)) {
    subagentResults.push({ timestamp, event: 'stop' });
  }
}

const result = {
  subagent_calls: subagentCalls,
  subagent_results: subagentResults,
  summary,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
