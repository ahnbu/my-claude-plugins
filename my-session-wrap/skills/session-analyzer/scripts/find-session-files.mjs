#!/usr/bin/env node
// find-session-files.mjs - Locate all files related to a Claude Code session
//
// Usage: node find-session-files.mjs <session-id>
// Output: JSON with paths to session files

import fs from 'fs';
import path from 'path';
import os from 'os';

const sessionId = process.argv[2];

if (!sessionId) {
  process.stderr.write(`Usage: node find-session-files.mjs <session-id>\n`);
  process.exit(1);
}

const claudeDir = path.join(os.homedir(), '.claude');

/**
 * 디렉토리를 재귀 탐색하여 조건에 맞는 파일 목록 반환
 */
function findFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, predicate, results);
    } else if (predicate(entry.name, fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * agent-*.jsonl 파일 중 sessionId를 포함하는 파일 탐색
 */
function findAgentLogs(projectsDir) {
  const agentFiles = findFiles(projectsDir, (name) => /^agent-.*\.jsonl$/.test(name));
  return agentFiles.filter((f) => {
    try {
      return fs.readFileSync(f, 'utf8').includes(sessionId);
    } catch {
      return false;
    }
  });
}

// Main session log
const projectsDir = path.join(claudeDir, 'projects');
const mainLogMatches = findFiles(projectsDir, (name) => name === `${sessionId}.jsonl`);
const mainLog = mainLogMatches[0] ?? '';

// Debug log
const debugLogPath = path.join(claudeDir, 'debug', `${sessionId}.txt`);
const debugLog = fs.existsSync(debugLogPath) ? debugLogPath : '';

// Agent transcripts
const agentLogs = findAgentLogs(projectsDir);

// Todo file
const todosDir = path.join(claudeDir, 'todos');
const todoMatches = findFiles(todosDir, (name) => name.includes(sessionId) && name.endsWith('.json'));
const todoFile = todoMatches[0] ?? '';

// Session environment
const sessionEnvPath = path.join(claudeDir, 'session-env', sessionId);
const sessionEnv = fs.existsSync(sessionEnvPath) ? sessionEnvPath : '';

const result = {
  session_id: sessionId,
  main_log: mainLog,
  debug_log: debugLog,
  agent_logs: agentLogs,
  todo_file: todoFile,
  session_env: sessionEnv,
  found: {
    main_log: !!mainLog,
    debug_log: !!debugLog,
  },
};

process.stdout.write(JSON.stringify(result, null, 2) + '\n');
