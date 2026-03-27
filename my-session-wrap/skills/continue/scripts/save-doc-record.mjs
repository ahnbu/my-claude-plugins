#!/usr/bin/env node
/**
 * save-doc-record.mjs — doc-save 기록 스크립트
 * doc-save 스킬이 문서를 생성한 후 호출하여 경로를 기록한다.
 *
 * 사용법:
 *   node save-doc-record.mjs <session_id> <doc_path>
 *
 * 저장 위치: ~/.claude/scripts/doc-save/<session_id>.json
 * TTL: find-context-warning.mjs 실행 시 6시간 경과 파일 자동 정리
 */
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const [sessionId, docPath] = process.argv.slice(2);

if (!sessionId || !docPath) {
  process.stderr.write("usage: save-doc-record.mjs <session_id> <doc_path>\n");
  process.exit(1);
}

const docSaveDir = join(homedir(), ".claude", "scripts", "doc-save");
if (!existsSync(docSaveDir)) {
  mkdirSync(docSaveDir, { recursive: true });
}

const record = {
  ts: new Date().toISOString(),
  session_id: sessionId,
  doc_path: docPath,
};

const outPath = join(docSaveDir, `${sessionId}.json`);
writeFileSync(outPath, JSON.stringify(record, null, 2));
console.log(JSON.stringify({ saved: true, path: outPath }));
