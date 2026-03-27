#!/usr/bin/env node
/**
 * analyze-skill-context.mjs
 * skill-context/<session_id>.jsonl 파일을 분석하여 스킬별 cp% 소모 리포트 출력.
 *
 * 사용법:
 *   node analyze-skill-context.mjs                    # 전체 집계
 *   node analyze-skill-context.mjs --skill wrap       # 특정 스킬 상세
 *   node analyze-skill-context.mjs --session <sid>    # 특정 세션 상세
 */

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const SKILL_CONTEXT_DIR = join(homedir(), ".claude", "scripts", "skill-context");

// CLI 인자 파싱
const args = process.argv.slice(2);
const filterSkill = args.includes("--skill") ? args[args.indexOf("--skill") + 1] : null;
const filterSession = args.includes("--session") ? args[args.indexOf("--session") + 1] : null;

if (!existsSync(SKILL_CONTEXT_DIR)) {
  console.log("데이터 없음: skill-context 디렉토리가 없습니다.");
  console.log(`경로: ${SKILL_CONTEXT_DIR}`);
  console.log("스킬을 호출하면 자동으로 생성됩니다.");
  process.exit(0);
}

// JSONL 파일 목록 수집
const files = readdirSync(SKILL_CONTEXT_DIR).filter(f => f.endsWith(".jsonl"));

if (files.length === 0) {
  console.log("데이터 없음: 아직 기록된 스킬 호출이 없습니다.");
  process.exit(0);
}

// 필터링
const targetFiles = filterSession
  ? files.filter(f => f.startsWith(filterSession))
  : files;

if (targetFiles.length === 0) {
  console.log(`세션 ${filterSession}의 데이터가 없습니다.`);
  process.exit(0);
}

/**
 * JSONL 파일을 읽어 레코드 배열 반환
 */
function readJsonl(filePath) {
  try {
    return readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    return [];
  }
}

/**
 * 레코드 배열에서 각 skill 이벤트의 cp% 델타 계산
 * skill 이벤트 직전/직후 cp 레코드를 찾아 delta 반환
 */
function computeDeltas(records) {
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.type !== "skill") continue;

    // 직전 cp 레코드: skill 레코드의 cp_before 필드 우선, 없으면 직전 cp 레코드 탐색
    let cpBefore = rec.cp_before ?? null;
    if (cpBefore === null) {
      for (let j = i - 1; j >= 0; j--) {
        if (records[j].type === "cp") { cpBefore = records[j].cp; break; }
      }
    }

    // 직후 cp 레코드 (가장 가까운)
    let cpAfter = null;
    let tsAfter = null;
    for (let j = i + 1; j < records.length; j++) {
      if (records[j].type === "cp") {
        cpAfter = records[j].cp;
        tsAfter = records[j].ts;
        break;
      }
    }

    // delta: cp_before 있으면 정확값, 없으면 cp_after를 추정값으로 사용 (세션 시작 ≈ 0%)
    let delta = null;
    let deltaEstimated = false;
    if (cpBefore !== null && cpAfter !== null) {
      delta = parseFloat((cpAfter - cpBefore).toFixed(2));
    } else if (cpBefore === null && cpAfter !== null) {
      delta = parseFloat(cpAfter.toFixed(2));
      deltaEstimated = true; // cp_before 없어 세션 시작(≈0%) 기준 추정
    }

    results.push({
      skill: rec.skill,
      session_id: rec.session_id,
      ts: rec.ts,
      cp_before: cpBefore,
      cp_after: cpAfter,
      ts_after: tsAfter,
      delta,
      deltaEstimated,
    });
  }
  return results;
}

// 전체 데이터 수집
const allDeltas = [];
for (const f of targetFiles) {
  const records = readJsonl(join(SKILL_CONTEXT_DIR, f));
  allDeltas.push(...computeDeltas(records));
}

if (allDeltas.length === 0) {
  console.log("분석 가능한 데이터 없음: skill 이벤트 전후 cp% 레코드가 아직 없습니다.");
  console.log("스킬을 몇 번 더 호출한 후 다시 실행하세요.");
  process.exit(0);
}

// 특정 스킬 필터
const filtered = filterSkill
  ? allDeltas.filter(d => d.skill === filterSkill)
  : allDeltas;

if (filtered.length === 0) {
  console.log(`스킬 '${filterSkill}'의 데이터가 없습니다.`);
  process.exit(0);
}

// 집계
if (filterSkill || filterSession) {
  // 상세 모드
  const title = filterSkill
    ? `스킬 '${filterSkill}' 상세 분석`
    : `세션 ${filterSession} 상세 분석`;
  console.log(`\n${title}`);
  console.log("─".repeat(60));

  const withDelta = filtered.filter(d => d.delta !== null);
  const exact = withDelta.filter(d => !d.deltaEstimated);
  const estimated = withDelta.filter(d => d.deltaEstimated);
  if (withDelta.length > 0) {
    const avg = withDelta.reduce((s, d) => s + d.delta, 0) / withDelta.length;
    const max = Math.max(...withDelta.map(d => d.delta));
    const min = Math.min(...withDelta.map(d => d.delta));
    console.log(`  호출 수    : ${filtered.length}회 (정확: ${exact.length}회, 추정: ${estimated.length}회)`);
    console.log(`  평균 Δcp%  : +${avg.toFixed(2)}%`);
    console.log(`  최소/최대  : +${min.toFixed(2)}% / +${max.toFixed(2)}%`);
    console.log("");
  }

  console.log("  개별 호출:");
  console.log(`  ${"시각(KST)".padEnd(22)} ${"before".padEnd(8)} ${"after".padEnd(8)} ${"Δcp%".padEnd(10)} 세션ID`);
  console.log("  " + "─".repeat(72));
  for (const d of filtered) {
    const ts = new Date(new Date(d.ts).getTime() + 9 * 3600000)
      .toISOString().replace("T", " ").slice(0, 19);
    const before = d.cp_before !== null ? `${d.cp_before}%` : "N/A";
    const after = d.cp_after !== null ? `${d.cp_after}%` : "N/A";
    const deltaStr = d.delta !== null
      ? `+${d.delta}%${d.deltaEstimated ? "~" : ""}`
      : "N/A";
    const sid = d.session_id ? d.session_id.slice(0, 8) + "..." : "?";
    console.log(`  ${ts.padEnd(22)} ${before.padEnd(8)} ${after.padEnd(8)} ${deltaStr.padEnd(10)} ${sid}`);
  }
} else {
  // 전체 집계 모드
  const bySkill = {};
  for (const d of filtered) {
    if (!bySkill[d.skill]) bySkill[d.skill] = [];
    bySkill[d.skill].push(d);
  }

  // 평균 delta 기준 내림차순 정렬 (추정값 제외, 정확값만 집계)
  const rows = Object.entries(bySkill).map(([skill, items]) => {
    const withDelta = items.filter(d => d.delta !== null);
    const exact = withDelta.filter(d => !d.deltaEstimated);
    // 정확값이 있으면 정확값만으로 집계, 없으면 추정값으로 fallback
    // 정확값(cp_before 실측)만 집계 — 추정값 완전 제외
    const avgDelta = exact.length > 0
      ? exact.reduce((s, d) => s + d.delta, 0) / exact.length
      : null;
    const maxDelta = exact.length > 0 ? Math.max(...exact.map(d => d.delta)) : null;
    const minDelta = exact.length > 0 ? Math.min(...exact.map(d => d.delta)) : null;
    const hasEstimated = withDelta.some(d => d.deltaEstimated);
    return { skill, count: items.length, measured: withDelta.length, exactCount: exact.length, avgDelta, minDelta, maxDelta, hasEstimated };
  }).sort((a, b) => (b.avgDelta ?? -Infinity) - (a.avgDelta ?? -Infinity));

  const totalSessions = new Set(allDeltas.map(d => d.session_id)).size;
  console.log(`\n스킬 컨텍스트 소모 분석 (세션 ${totalSessions}개, 호출 ${allDeltas.length}회)`);
  console.log("─".repeat(75));
  console.log(`${"스킬명".padEnd(28)} ${"호출".padStart(5)} ${"측정".padStart(5)} ${"평균Δcp%".padStart(10)} ${"최소Δcp%".padStart(10)} ${"최대Δcp%".padStart(10)}`);
  console.log("─".repeat(75));
  for (const r of rows) {
    const avg = r.avgDelta !== null ? `+${r.avgDelta.toFixed(2)}%` : "N/A";
    const min = r.minDelta !== null ? `+${r.minDelta.toFixed(2)}%` : "N/A";
    const max = r.maxDelta !== null ? `+${r.maxDelta.toFixed(2)}%` : "N/A";
    console.log(`${r.skill.padEnd(28)} ${String(r.count).padStart(5)} ${String(r.measured).padStart(5)} ${avg.padStart(10)} ${min.padStart(10)} ${max.padStart(10)}`);
  }
  console.log("─".repeat(65));
  console.log(`\n※ 측정: cp_before 실측 기준 정확값만 집계 (추정값 제외)`);
  console.log(`※ 측정 < 호출: cp% 레코드 없거나 cp_before 미확보`);
  console.log(`※ 향후 교차검증: --session <sid>으로 상세 확인`);
}
