#!/usr/bin/env node
// extract-session.mjs
// Extract essential conversation from Claude Code session JSONL files
//
// Usage: node extract-session.mjs <session.jsonl>
// Output: Filtered JSON to stdout
//
// ============================================================
// 세션 파일 구조 분석 결과 (12MB 파일 예시)
// ============================================================
//
// JSONL type 분포:
//   file-history-snapshot : 67% (8.4MB) → 버림
//   queue-operation       : 27% (3.4MB) → 버림
//   user + assistant      :  6% (800KB) → 추출
//   system, summary       : <1%         → 선택적
//
// assistant.message.content[] 내부:
//   thinking  : Claude 생각 + signature → 버림
//   tool_use  : tool 호출 정보          → 버림
//   text      : 실제 응답 텍스트        → 추출
//
// 결과: 12MB → ~800KB (93% 감소)
// ============================================================

import fs from 'fs';
import readline from 'readline';

const sessionFile = process.argv[2];

if (!sessionFile) {
  process.stderr.write('Usage: node extract-session.mjs <session.jsonl>\n');
  process.exit(1);
}

if (!fs.existsSync(sessionFile)) {
  process.stderr.write(`Error: File not found: ${sessionFile}\n`);
  process.exit(1);
}

// Extract conversation only:
// - summary: 세션 요약
// - user: 사용자 메시지 (.message.content)
// - assistant: Claude 응답 중 text만 (.message.content[].type == "text")
//
// Explicitly ignored (94% of file size):
// - file-history-snapshot: 파일 백업 스냅샷
// - queue-operation: 큐 연산 로그
// - assistant.thinking: 생각 과정 + signature
// - assistant.tool_use: tool 호출 정보

const messages = [];

const rl = readline.createInterface({
  input: fs.createReadStream(sessionFile, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }

  if (entry.type === 'summary') {
    messages.push({ type: 'summary', summary: entry.summary });
  } else if (entry.type === 'user') {
    messages.push({
      type: 'user',
      content: entry.message?.content,
      ts: entry.timestamp,
    });
  } else if (entry.type === 'assistant') {
    const texts = (entry.message?.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text);
    if (texts.length > 0) {
      messages.push({ type: 'assistant', texts, ts: entry.timestamp });
    }
  }
}

const result = {
  file: sessionFile,
  message_count: messages.length,
  messages,
};

process.stdout.write(JSON.stringify(result) + '\n');
