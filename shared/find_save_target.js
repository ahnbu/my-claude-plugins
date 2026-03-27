"use strict";
// doc-save/scripts/find_save_target.js
// doc-save Step 6 "저장 위치 결정" 전용 — 수정 파일의 git 레포를 식별하여 저장 대상 반환
//
// 사용법: node find_save_target.js <sessionId>
// 출력:   JSON {
//   modified_files: string[],
//   git_repos: Array<{root: string, file_count: number}>,
//   non_repo_files: string[],
//   recommended_repo: string | null,
//   recommended_path: string | null
// }

const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");
const fs = require("node:fs");

const HOME = os.homedir();
const { SessionDB } = require(
  path.join(HOME, ".claude", "my-claude-plugins", "shared", "session-db.js")
);
const DB_PATH = path.join(
  HOME, ".claude", "my-claude-plugins", "output", "session-dashboard", "sessions.db"
);

function getGitRoot(filePath) {
  try {
    // 파일이면 디렉토리로 변환
    let dir = filePath;
    try {
      if (fs.statSync(filePath).isFile()) {
        dir = path.dirname(filePath);
      }
    } catch {
      // 파일이 존재하지 않으면 디렉토리 부분 사용
      dir = path.dirname(filePath);
    }
    const result = execSync("git rev-parse --show-toplevel", {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    // Windows 경로 정규화
    return result.replace(/\\/g, "/");
  } catch {
    return null;
  }
}

function findDocsFolder(repoRoot) {
  // docs/ 또는 _docs/ 존재 여부 확인
  for (const name of ["docs", "_docs"]) {
    const candidate = path.join(repoRoot, name);
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate.replace(/\\/g, "/");
      }
    } catch {
      // 없으면 다음
    }
  }
  return null;
}

function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("Usage: node find_save_target.js <sessionId>");
    process.exit(1);
  }

  let db;
  try {
    db = new SessionDB(DB_PATH);
    db.sync({ verbose: false });
  } catch (err) {
    console.log(JSON.stringify({
      error: err.message,
      modified_files: [],
      git_repos: [],
      non_repo_files: [],
      recommended_repo: null,
      recommended_path: null,
    }));
    return;
  }

  try {
    // 세션 이벤트 동기화
    db.syncSingleSession(sessionId);
    const events = db.getEvents(sessionId);

    // Edit/Write 도구 이벤트에서 file_path 추출
    const fileSet = new Set();
    for (const event of events) {
      if (event.kind !== "tool_use") continue;
      const toolName = event.toolName || "";
      if (toolName !== "Edit" && toolName !== "Write") continue;

      // tool_use 이벤트에서 file_path 추출 (input 객체 또는 텍스트 파싱)
      let fp = null;
      if (event.input && event.input.file_path) {
        fp = event.input.file_path;
      } else {
        const text = event.text || event.rawText || "";
        const match = text.match(/file_path["\s:]+["']?([^"'\n,}]+)/);
        if (match) fp = match[1].trim();
      }
      if (fp) {
        fp = fp.replace(/\\/g, "/");
        // 임시 파일, plan 파일 제외
        if (!fp.includes(".temp/") && !fp.includes("/temp/") && !fp.includes("plan-")) {
          fileSet.add(fp);
        }
      }
    }

    const modifiedFiles = [...fileSet];
    const repoMap = new Map(); // root -> files[]
    const nonRepoFiles = [];

    for (const fp of modifiedFiles) {
      const root = getGitRoot(fp);
      if (root) {
        if (!repoMap.has(root)) repoMap.set(root, []);
        repoMap.get(root).push(fp);
      } else {
        nonRepoFiles.push(fp);
      }
    }

    const gitRepos = [...repoMap.entries()]
      .map(([root, files]) => ({ root, files, file_count: files.length }))
      .sort((a, b) => b.file_count - a.file_count);

    // 저장 대상 레포 결정
    let recommendedRepo = null;

    if (gitRepos.length === 1) {
      // ② 1곳이면 해당 레포
      recommendedRepo = gitRepos[0].root;
    } else if (gitRepos.length >= 2) {
      // ③ 2곳 이상이면 비중 큰 쪽
      recommendedRepo = gitRepos[0].root;
    } else {
      // ④ 모두 비레포 → 수정 파일 쪽 (첫 번째 파일의 디렉토리)
      if (nonRepoFiles.length > 0) {
        recommendedRepo = path.dirname(nonRepoFiles[0]).replace(/\\/g, "/");
      }
    }

    // 레포 내 docs 폴더 확인
    let recommendedPath = recommendedRepo;
    if (recommendedRepo) {
      const docsDir = findDocsFolder(recommendedRepo);
      if (docsDir) {
        recommendedPath = docsDir;
      }
    }

    console.log(JSON.stringify({
      modified_files: modifiedFiles,
      git_repos: gitRepos,
      non_repo_files: nonRepoFiles,
      recommended_repo: recommendedRepo,
      recommended_path: recommendedPath,
    }));
  } finally {
    db.close();
  }
}

main();
