#!/usr/bin/env node
// extract-hook-events.mjs - Extract Hook events from debug log
//
// Usage: node extract-hook-events.mjs <debug-log-path>
// Output: JSON with hook events, triggers, and results

import fs from 'fs';

const debugLog = process.argv[2];

if (!debugLog || !fs.existsSync(debugLog)) {
  process.stderr.write(`Usage: node extract-hook-events.mjs <debug-log-path>\n`);
  process.exit(1);
}

const TS_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/;

const lines = fs.readFileSync(debugLog, 'utf8').split('\n');

const preToolUse = [];
const hookMatches = [];
const promptHookResults = [];
const permissionDecisions = [];
const summary = { PreToolUse: 0, PostToolUse: 0, Stop: 0, SubagentStop: 0, prompt_hooks_processed: 0 };

for (const line of lines) {
  const tsMatch = line.match(TS_RE);
  const timestamp = tsMatch ? tsMatch[1] : '';

  // PreToolUse triggers
  if (line.includes('Getting matching hook commands for PreToolUse')) {
    const toolMatch = line.match(/PreToolUse with query: (\S+)/);
    preToolUse.push({ timestamp, tool: toolMatch ? toolMatch[1] : '' });
    summary.PreToolUse++;
    continue;
  }

  // Hook matches
  if (line.includes('unique hooks for query')) {
    const countMatch = line.match(/Matched (\d+)/);
    const queryMatch = line.match(/for query "([^"]+)/);
    const matchCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    if (matchCount > 0) {
      hookMatches.push({ timestamp, query: queryMatch ? queryMatch[1] : '', matched: matchCount });
    }
    continue;
  }

  // Prompt hook results
  if (line.includes('Prompt hook condition was met')) {
    promptHookResults.push({ timestamp, result: 'met' });
    continue;
  }
  if (line.includes('Prompt hook condition was not met')) {
    promptHookResults.push({ timestamp, result: 'not_met' });
    continue;
  }

  // Permission decisions
  if (line.includes('permissionDecision')) {
    const decisionMatch = line.match(/permissionDecision.*?:\s*"([^"]+)/);
    if (decisionMatch) {
      permissionDecisions.push({ timestamp, decision: decisionMatch[1] });
    }
    continue;
  }

  // Summary counters (remaining hook types)
  if (line.includes('Getting matching hook commands for PostToolUse')) summary.PostToolUse++;
  else if (line.includes('Getting matching hook commands for Stop')) summary.Stop++;
  else if (line.includes('Getting matching hook commands for SubagentStop')) summary.SubagentStop++;
  else if (line.includes('Processing prompt hook')) summary.prompt_hooks_processed++;
}

const result = {
  pre_tool_use: preToolUse,
  hook_matches: hookMatches,
  prompt_hook_results: promptHookResults,
  permission_decisions: permissionDecisions,
  summary,
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
