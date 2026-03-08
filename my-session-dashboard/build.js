#!/usr/bin/env node
// build.js — Claude Code JSONL 세션을 self-contained 대시보드 HTML로 변환 (증분 빌드)
const fs = require("fs");
const path = require("path");

const CLAUDE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".claude"
);
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const PLANS_DIR = path.join(CLAUDE_DIR, "plans");
const CODEX_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  ".codex", "sessions"
);
const DIST_DIR = path.join(__dirname, "..", "output", "session-dashboard");
const CACHE_FILE = path.join(DIST_DIR, ".build-cache.json");

const STOPWORDS = new Set([
  // 조사
  "은", "는", "이", "가", "을", "를", "에", "에서", "의", "와", "과",
  "도", "만", "로", "으로", "부터", "까지", "에게", "한테", "께",
  // 대명사/지시어
  "나", "너", "우리", "저", "이것", "그것", "저것", "여기", "거기",
  "이", "그", "저", "것", "거", "뭐", "어떤",
  // 접속/부사
  "그리고", "그래서", "하지만", "그런데", "또", "더", "좀", "잘",
  "매우", "아주", "정말", "진짜", "너무",
  // 동사/형용사 어미
  "하다", "되다", "있다", "없다", "같다",
  // 일반
  "수", "등", "때", "중", "위", "후", "안", "밖",
  // 영어 불용어
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "shall",
  "i", "you", "he", "she", "it", "we", "they", "me", "my",
  "your", "his", "her", "its", "our", "their",
  "this", "that", "these", "those", "what", "which", "who",
  "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "and", "or", "but", "not", "so", "if", "then",
  "how", "please", "help", "want", "need", "make", "let",
  // 시스템 태그 잔여물
  "command", "message", "name", "args", "local", "caveat",
  "ide", "opened", "file", "user", "system", "reminder",
  "screenshot", "pasted", "image", "png", "jpg", "jpeg",
  // Plan 실행 boilerplate
  "implement", "following", "plan", "context", "resume",
  // 경로 조각
  "users", "claude", "cloudsync", "download",
]);

function stripSystemTags(text) {
  if (!text) return "";
  text = text.replace(
    /<(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|antml:\w+)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  text = text.replace(
    /<\/?(command-message|command-name|command-args|local-command-caveat|ide_opened_file|system-reminder|user-prompt-submit-hook|antml:\w+)[^>]*>/gi,
    ""
  );
  return text.trim();
}

function extractKeywords(text, count = 3) {
  if (!text) return [];

  const words = text
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => {
      if (w.length <= 1) return false;
      if (STOPWORDS.has(w)) return false;
      if (/^\d+$/.test(w)) return false;
      if (/^[0-9a-f]{8,}$/.test(w)) return false;
      if (/^\d{4}-?\d{2}-?\d{2}/.test(w)) return false;
      return true;
    });

  const seen = new Set();
  const unique = [];
  for (const w of words) {
    if (!seen.has(w)) {
      seen.add(w);
      unique.push(w);
    }
  }

  return unique.slice(0, count);
}

// 여러 소스에서 키워드 폴백 추출
function extractKeywordsWithFallback(entries) {
  // 1차: 첫 번째 user 메시지
  for (const entry of entries) {
    if (entry.type === "user" && entry.message?.content) {
      const text = stripSystemTags(getTextContent(entry.message.content));
      const kw = extractKeywords(text);
      if (kw.length > 0) return { keywords: kw, firstMessage: text };
    }
  }

  // 2차: 두 번째~세 번째 user 메시지
  let userCount = 0;
  for (const entry of entries) {
    if (entry.type === "user" && entry.message?.content) {
      userCount++;
      if (userCount <= 1) continue;
      if (userCount > 3) break;
      const text = stripSystemTags(getTextContent(entry.message.content));
      const kw = extractKeywords(text);
      if (kw.length > 0) return { keywords: kw, firstMessage: text };
    }
  }

  // 3차: 첫 번째 assistant 텍스트 응답
  for (const entry of entries) {
    if (entry.type === "assistant" && entry.message?.content) {
      if (Array.isArray(entry.message.content)) {
        for (const block of entry.message.content) {
          if (block.type === "text" && block.text) {
            const kw = extractKeywords(block.text);
            if (kw.length > 0) return { keywords: kw, firstMessage: "" };
          }
        }
      }
    }
  }

  // 4차: 도구 이름 + 프로젝트명 폴백
  const toolSet = new Set();
  for (const entry of entries) {
    if (entry.type === "assistant" && entry.message?.content) {
      if (Array.isArray(entry.message.content)) {
        for (const block of entry.message.content) {
          if (block.type === "tool_use" && block.name) {
            toolSet.add(block.name);
          }
        }
      }
    }
  }
  const cwd = findCwd(entries);
  const projectName = cwd ? cwd.split(/[/\\]/).pop() : "";
  const fallback = [];
  if (projectName) fallback.push(projectName);
  for (const t of toolSet) {
    if (fallback.length >= 3) break;
    fallback.push(t);
  }

  return { keywords: fallback.slice(0, 3), firstMessage: "" };
}

function getTextContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textBlock = content.find((b) => b.type === "text");
    if (textBlock) return textBlock.text;
  }
  return "";
}

function getTextFromMessage(msg) {
  if (!msg?.content) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

function parseJSONL(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim());
  const entries = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip
    }
  }
  return entries;
}

function formatTimestamp(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}`;
}

function normalizeProjectPath(p) {
  if (!p) return "";
  return p.replace(/^([a-z]):/, (_, letter) => letter.toUpperCase() + ":");
}

function processSession(filePath) {
  const entries = parseJSONL(filePath);
  const absFilePath = path.resolve(filePath);
  if (entries.length === 0) return null;

  const sessionId = path.basename(filePath, ".jsonl");
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  const timestamp = firstEntry.timestamp;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;

  // 키워드 폴백 추출
  const { keywords, firstMessage } = extractKeywordsWithFallback(entries);
  const timeStr = formatTimestamp(timestamp);
  const title = [timeStr, ...keywords].join("_");

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let messageCount = 0;
  let toolUseCount = 0;
  const models = new Set();
  const toolNames = {};
  const messages = [];

  for (const entry of entries) {
    if (entry.type === "user") {
      messageCount++;
      const rawText = getTextFromMessage(entry.message);
      messages.push({
        role: "user",
        text: stripSystemTags(rawText),
        timestamp: entry.timestamp,
      });
    } else if (entry.type === "assistant" && entry.message) {
      const msg = entry.message;
      if (msg.model) models.add(msg.model);
      if (msg.usage) {
        totalInputTokens +=
          (msg.usage.input_tokens || 0) +
          (msg.usage.cache_creation_input_tokens || 0) +
          (msg.usage.cache_read_input_tokens || 0);
        totalOutputTokens += msg.usage.output_tokens || 0;
      }
      if (Array.isArray(msg.content)) {
        const textParts = [];
        const tools = [];
        for (const block of msg.content) {
          if (block.type === "text" && block.text) {
            textParts.push(block.text);
          } else if (block.type === "tool_use") {
            toolUseCount++;
            const name = block.name || "unknown";
            toolNames[name] = (toolNames[name] || 0) + 1;
            tools.push({ name, input: block.input });
          } else if (block.type === "thinking" && block.thinking) {
            textParts.push(`[thinking] ${block.thinking}`);
          }
        }
        if (textParts.length > 0 || tools.length > 0) {
          const msgObj = { role: "assistant", timestamp: entry.timestamp };
          if (textParts.length > 0) msgObj.text = textParts.join("\n");
          if (tools.length > 0) msgObj.tools = tools;
          messages.push(msgObj);
        }
      }
    }
  }

  // Merge streaming chunks
  const mergedMessages = [];
  for (const msg of messages) {
    const prev = mergedMessages[mergedMessages.length - 1];
    if (
      prev &&
      prev.role === "assistant" &&
      msg.role === "assistant" &&
      prev.timestamp === msg.timestamp
    ) {
      if (msg.text) {
        prev.text = prev.text ? prev.text + "\n" + msg.text : msg.text;
      }
      if (msg.tools) {
        prev.tools = prev.tools ? [...prev.tools, ...msg.tools] : msg.tools;
      }
    } else {
      mergedMessages.push({ ...msg });
    }
  }

  const project = normalizeProjectPath(findCwd(entries));

  // firstMessage: 시스템 태그 제거된 첫 user 메시지 (폴백에서 가져옴)
  const displayFirstMsg = firstMessage || stripSystemTags(
    messages.find((m) => m.role === "user")?.text || ""
  );

  const metadata = {
    sessionId,
    title,
    keywords,
    timestamp,
    lastTimestamp: lastEntry.timestamp,
    project,
    gitBranch: entries.find((e) => e.gitBranch)?.gitBranch || "",
    models: [...models],
    messageCount,
    toolUseCount,
    totalInputTokens,
    totalOutputTokens,
    toolNames,
    firstMessage: displayFirstMsg.substring(0, 200),
    projectDisplay: project,
    filePath: absFilePath,
  };

  return { metadata, messages: mergedMessages };
}

function findCwd(entries) {
  for (const entry of entries) {
    if (entry.cwd) return entry.cwd;
  }
  return "";
}

// ── Codex 세션 파싱 ──
function processCodexSession(filePath) {
  const entries = parseJSONL(filePath);
  const absFilePath = path.resolve(filePath);
  if (entries.length === 0) return null;

  // session_meta에서 세션 정보 추출
  const sessionMeta = entries.find((e) => e.type === "session_meta");
  if (!sessionMeta) return null;

  const payload = sessionMeta.payload || {};
  const rawSessionId = payload.id || path.basename(filePath, ".jsonl");
  const sessionId = "codex:" + rawSessionId;
  const timestamp = payload.timestamp || sessionMeta.timestamp;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;

  const cwd = payload.cwd || "";
  const gitBranch = (payload.git && payload.git.branch) ? payload.git.branch : "";
  const originator = payload.originator || "codex_cli_rs";

  // turn_context에서 model 수집
  const models = new Set();
  for (const entry of entries) {
    if (entry.type === "turn_context" && entry.payload && entry.payload.model) {
      models.add(entry.payload.model);
    }
  }

  // 메시지 파싱
  const messages = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastTokenEntry = null;
  let toolUseCount = 0;
  const toolNames = {};

  for (const entry of entries) {
    const ts = entry.timestamp;

    if (entry.type === "event_msg") {
      const ep = entry.payload || {};
      if (ep.type === "user_message" && ep.message) {
        messages.push({
          role: "user",
          text: stripSystemTags(ep.message),
          timestamp: ts,
        });
      } else if (ep.type === "token_count" && ep.info && ep.info.total_token_usage) {
        lastTokenEntry = ep.info.total_token_usage;
      }
    } else if (entry.type === "response_item") {
      const ep = entry.payload || {};
      const pType = ep.type;

      if (pType === "message") {
        const role = ep.role;
        if (role === "assistant") {
          // content 배열에서 output_text 추출
          let text = "";
          if (Array.isArray(ep.content)) {
            text = ep.content
              .filter((c) => c.type === "output_text")
              .map((c) => c.text || "")
              .join("\n");
          }
          if (text) {
            messages.push({ role: "assistant", text, timestamp: ts });
          }
        }
        // user role은 event_msg/user_message로 이미 처리, developer(시스템) 스킵
      } else if (pType === "function_call") {
        const name = ep.name || "unknown";
        let input = {};
        try {
          input = ep.arguments ? JSON.parse(ep.arguments) : {};
        } catch {
          input = { raw: ep.arguments };
        }
        toolUseCount++;
        toolNames[name] = (toolNames[name] || 0) + 1;
        // 이전 assistant 메시지에 도구 추가, 없으면 새 메시지 생성
        const prev = messages[messages.length - 1];
        if (prev && prev.role === "assistant") {
          prev.tools = prev.tools ? [...prev.tools, { name, input }] : [{ name, input }];
        } else {
          messages.push({ role: "assistant", timestamp: ts, tools: [{ name, input }] });
        }
      } else if (pType === "custom_tool_call") {
        const name = ep.name || "unknown";
        const input = ep.input !== undefined ? ep.input : {};
        toolUseCount++;
        toolNames[name] = (toolNames[name] || 0) + 1;
        const prev = messages[messages.length - 1];
        if (prev && prev.role === "assistant") {
          prev.tools = prev.tools ? [...prev.tools, { name, input }] : [{ name, input }];
        } else {
          messages.push({ role: "assistant", timestamp: ts, tools: [{ name, input }] });
        }
      }
      // reasoning, function_call_output, custom_tool_call_output 스킵
    }
  }

  // 토큰 집계
  if (lastTokenEntry) {
    totalInputTokens = (lastTokenEntry.input_tokens || 0) + (lastTokenEntry.cached_input_tokens || 0);
    totalOutputTokens = (lastTokenEntry.output_tokens || 0) + (lastTokenEntry.reasoning_output_tokens || 0);
  }

  if (messages.length === 0) return null;

  // 키워드 추출: 첫 user 메시지 텍스트에서
  const firstUserMsg = messages.find((m) => m.role === "user");
  const firstMsgText = firstUserMsg ? firstUserMsg.text : "";
  const keywords = extractKeywords(firstMsgText);

  const timeStr = formatTimestamp(timestamp);
  const title = [timeStr, ...keywords].join("_");
  const lastEntry = entries[entries.length - 1];
  const project = normalizeProjectPath(cwd);
  const messageCount = messages.filter((m) => m.role === "user").length;

  const metadata = {
    sessionId,
    type: "codex",
    originator,
    title,
    keywords,
    timestamp,
    lastTimestamp: lastEntry.timestamp,
    project,
    projectDisplay: project,
    gitBranch,
    models: [...models],
    messageCount,
    toolUseCount,
    totalInputTokens,
    totalOutputTokens,
    toolNames,
    firstMessage: firstMsgText.substring(0, 200),
    filePath: absFilePath,
  };

  return { metadata, messages };
}

function loadCodexSessions(cache, newCache) {
  const codexResults = [];
  let newCount = 0;
  let cachedCount = 0;

  if (!fs.existsSync(CODEX_DIR)) {
    console.warn(`⚠️  Codex 세션 디렉토리 없음: ${CODEX_DIR}`);
    return { codexResults, newCount, cachedCount };
  }

  // YYYY/MM/DD/ 구조 순회
  let years;
  try { years = fs.readdirSync(CODEX_DIR); } catch { return { codexResults, newCount, cachedCount }; }

  for (const year of years) {
    const yearPath = path.join(CODEX_DIR, year);
    let yearStat;
    try { yearStat = fs.statSync(yearPath); } catch { continue; }
    if (!yearStat.isDirectory()) continue;

    let months;
    try { months = fs.readdirSync(yearPath); } catch { continue; }
    for (const month of months) {
      const monthPath = path.join(yearPath, month);
      let monthStat;
      try { monthStat = fs.statSync(monthPath); } catch { continue; }
      if (!monthStat.isDirectory()) continue;

      let days;
      try { days = fs.readdirSync(monthPath); } catch { continue; }
      for (const day of days) {
        const dayPath = path.join(monthPath, day);
        let dayStat;
        try { dayStat = fs.statSync(dayPath); } catch { continue; }
        if (!dayStat.isDirectory()) continue;

        let files;
        try { files = fs.readdirSync(dayPath); } catch { continue; }
        for (const file of files) {
          if (!file.endsWith(".jsonl")) continue;
          const filePath = path.join(dayPath, file);
          const cacheKey = "codex:" + path.basename(file, ".jsonl");

          try {
            const stat = fs.statSync(filePath);
            const mtime = stat.mtimeMs;

            if (cache[cacheKey] && cache[cacheKey].mtime === mtime) {
              const cached = cache[cacheKey];
              if (cached.metadata && cached.metadata.messageCount > 0) {
                codexResults.push({ metadata: cached.metadata, messages: cached.messages });
                newCache[cacheKey] = cached;
                cachedCount++;
              }
              continue;
            }

            const result = processCodexSession(filePath);
            if (!result) continue;
            if (result.metadata.messageCount === 0) continue;
            codexResults.push(result);
            newCache[cacheKey] = { mtime, metadata: result.metadata, messages: result.messages };
            newCount++;
          } catch (err) {
            console.warn(`⚠️  Codex 파싱 실패: ${file} — ${err.message}`);
          }
        }
      }
    }
  }

  return { codexResults, newCount, cachedCount };
}

// ── Plan 파싱 ──
function parsePlan(filePath) {
  const absFilePath = path.resolve(filePath);
  const slug = path.basename(filePath, ".md");
  const stat = fs.statSync(filePath);
  const rawText = fs.readFileSync(filePath, "utf8");

  if (!rawText.trim()) return null;

  // 제목 추출: 첫 번째 # 줄
  const lines = rawText.split("\n");
  let title = slug;
  const firstHeading = lines.find((l) => /^#\s+/.test(l));
  if (firstHeading) {
    title = firstHeading.replace(/^#+\s+/, "").trim();
  }

  // 완료 여부 판단
  const isCompleted = /^#\s*완료/.test(lines[0]?.trim() || "");

  // timestamp = mtime
  const timestamp = new Date(stat.mtimeMs).toISOString();

  // Context 섹션 추출 (firstMessage 용)
  let contextText = "";
  const contextIdx = lines.findIndex((l) => /^##\s*(Context|컨텍스트)/i.test(l));
  if (contextIdx >= 0) {
    for (let i = contextIdx + 1; i < lines.length; i++) {
      if (/^##\s/.test(lines[i])) break;
      if (lines[i].trim()) {
        contextText += lines[i].trim() + " ";
      }
    }
  }
  const firstMessage = (contextText || rawText.substring(0, 200)).trim().substring(0, 200);

  // 키워드: 제목 + context에서 추출
  const kwSource = title + " " + contextText;
  const keywords = extractKeywords(kwSource);

  // 프로젝트 경로 추정: 본문에서 경로 패턴 탐색
  const pathMatch = rawText.match(/[A-Z]:[/\\][\w/\\.-]+|~\/[\w/\\.-]+/);
  const project = pathMatch ? normalizeProjectPath(pathMatch[0].replace(/[/\\][^/\\]+\.\w+$/, "")) : "";

  return {
    metadata: {
      planId: "plan:" + slug,
      sessionId: "plan:" + slug,
      type: "plan",
      title,
      slug,
      isCompleted,
      timestamp,
      keywords,
      project,
      projectDisplay: project,
      firstMessage,
      charCount: rawText.length,
      // 세션 호환 필드 (빈 값)
      gitBranch: "",
      models: [],
      messageCount: 0,
      toolUseCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolNames: {},
      filePath: absFilePath,
    },
    content: rawText,
  };
}

function loadPlans(cache, newCache) {
  const planResults = [];
  let newCount = 0;
  let cachedCount = 0;

  if (!fs.existsSync(PLANS_DIR)) {
    console.warn(`⚠️  Plans 디렉토리 없음: ${PLANS_DIR}`);
    return { planResults, newCount, cachedCount };
  }

  const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(PLANS_DIR, file);
    const slug = path.basename(file, ".md");
    const cacheKey = "plan:" + slug;

    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;

      if (cache[cacheKey] && cache[cacheKey].mtime === mtime) {
        const cached = cache[cacheKey];
        planResults.push({
          metadata: cached.metadata,
          content: cached.content,
        });
        newCache[cacheKey] = cached;
        cachedCount++;
        continue;
      }

      const result = parsePlan(filePath);
      if (!result) continue;
      planResults.push(result);
      newCache[cacheKey] = {
        mtime,
        metadata: result.metadata,
        content: result.content,
      };
      newCount++;
    } catch (err) {
      console.warn(`⚠️  Plan 파싱 실패: ${file} — ${err.message}`);
    }
  }

  return { planResults, newCount, cachedCount };
}

// ── 캐시 관리 ──
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
  } catch {
    // 캐시 손상 시 무시
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
}

function main() {
  console.log("Claude Session Dashboard — 빌드 시작\n");

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(
      `❌ Claude 프로젝트 디렉토리를 찾을 수 없습니다: ${PROJECTS_DIR}`
    );
    process.exit(1);
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const htmlSrc = path.join(__dirname, "index.html");
  const htmlDest = path.join(DIST_DIR, "index.html");

  const cache = loadCache();
  const newCache = {};
  const sessionResults = [];
  let newCount = 0;
  let cachedCount = 0;

  const projects = fs.readdirSync(PROJECTS_DIR);

  for (const projectDir of projects) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    const files = fs.readdirSync(projectPath);
    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(projectPath, file);
      const sessionId = path.basename(file, ".jsonl");

      try {
        const stat = fs.statSync(filePath);
        const mtime = stat.mtimeMs;

        // 캐시 히트: mtime 동일하면 재사용
        if (cache[sessionId] && cache[sessionId].mtime === mtime) {
          const cached = cache[sessionId];
          if (cached.metadata.messageCount > 0) {
            sessionResults.push({
              metadata: { ...cached.metadata, type: "session" },
              messages: cached.messages,
            });
            newCache[sessionId] = cached;
            cachedCount++;
          }
          continue;
        }

        // 캐시 미스: 새로 처리
        const result = processSession(filePath);
        if (!result) continue;
        if (result.metadata.messageCount === 0) continue;
        result.metadata.type = "session";
        sessionResults.push(result);
        newCache[sessionId] = {
          mtime,
          metadata: result.metadata,
          messages: result.messages,
        };
        newCount++;
      } catch (err) {
        console.warn(`⚠️  세션 파싱 실패: ${file} — ${err.message}`);
      }
    }
  }

  // Plans 로드
  const { planResults, newCount: planNew, cachedCount: planCached } = loadPlans(cache, newCache);

  // Codex 세션 로드
  const { codexResults, newCount: codexNew, cachedCount: codexCached } = loadCodexSessions(cache, newCache);

  // 병합 & 정렬
  const allResults = [...sessionResults, ...planResults, ...codexResults];
  allResults.sort(
    (a, b) => new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp)
  );

  const allMeta = allResults.map((r) => r.metadata);
  const sessionsData = {};
  for (const r of allResults) {
    if (r.metadata.type === "plan") {
      sessionsData[r.metadata.sessionId] = r.content;
    } else {
      sessionsData[r.metadata.sessionId] = r.messages;
    }
  }

  // sessionsData에 codex 메시지 포함 (sessions/plan과 동일 구조로 추가됨 — 루프 처리)

  // Build self-contained HTML
  const metaJson = JSON.stringify(allMeta).replace(/<\//g, "<\\/");
  const dataJson = JSON.stringify(sessionsData).replace(/<\//g, "<\\/");
  let html = fs.readFileSync(htmlSrc, "utf8");
  const dataScript = `<script>
window.__SESSIONS_META__ = ${metaJson};
window.__SESSIONS_DATA__ = ${dataJson};
</script>`;
  // String.replace()는 replacement의 $'/$`/$& 등을 특수 해석하므로
  // 세션 데이터에 $ 포함 시 HTML이 손상됨 → indexOf + substring 사용
  const placeholder = "<!-- __SESSION_DATA__ -->";
  const phIdx = html.indexOf(placeholder);
  html = html.substring(0, phIdx) + dataScript + html.substring(phIdx + placeholder.length);
  fs.writeFileSync(htmlDest, html);

  // 캐시 저장
  saveCache(newCache);

  console.log(`✅ ${sessionResults.length}개 Claude 세션 (신규 ${newCount}, 캐시 ${cachedCount}) | ${planResults.length}개 플랜 (신규 ${planNew}, 캐시 ${planCached}) | ${codexResults.length}개 Codex 세션 (신규 ${codexNew}, 캐시 ${codexCached})`);
  console.log(`📁 출력: ${htmlDest}`);
  console.log(`\n🌐 브라우저에서 열기: ${htmlDest}`);
}

main();
