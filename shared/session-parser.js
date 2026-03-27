"use strict";
// shared/session-parser.js — JSONL/Plan/Codex 파싱 + JSONL 이벤트 정규화
// build.js와 session-normalizer.js에서 추출한 공유 파싱 로직

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  extractCodexSkills,
  extractSlashCommands,
  extractSlashSkills,
  findToolResults,
  findToolUses,
  getTextContent,
  getThinkingContent,
  parseTimestamp,
  stripSystemTags,
} = require("./text-utils.js");

// ── 불용어 ──
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

// ── 키워드 추출 ──
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

// build.js 호환: 배열의 첫 번째 text 블록만 반환 (stripSystemTags 미적용)
function _getRawFirstText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textBlock = content.find((b) => b.type === "text");
    if (textBlock) return textBlock.text;
  }
  return "";
}

// 메시지 전체 텍스트 (모든 text 블록 조인, stripSystemTags 미적용)
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

// 여러 소스에서 키워드 폴백 추출
function extractKeywordsWithFallback(entries) {
  // 1차: 첫 번째 user 메시지
  for (const entry of entries) {
    if (entry.type === "user" && entry.message?.content) {
      const text = stripSystemTags(_getRawFirstText(entry.message.content));
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
      const text = stripSystemTags(_getRawFirstText(entry.message.content));
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

// ── 마지막 사용자 메시지 추출 ──
function extractLastMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && m.subtype !== "tool_result" && m.text?.trim()) {
      return m.text.substring(0, 200);
    }
  }
  return "";
}

// ── JSONL 파싱 ──
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

// JSONL 문자열 또는 라인 배열에서 파싱 (session-loader.js 호환)
function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
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

function findCwd(entries) {
  for (const entry of entries) {
    if (entry.cwd) return entry.cwd;
  }
  return "";
}

// ── Claude 세션 파싱 ──
function processSession(filePath) {
  const entries = parseJSONL(filePath);
  const absFilePath = path.resolve(filePath);
  if (entries.length === 0) return null;

  const sessionId = path.basename(filePath, ".jsonl");
  const firstEntry = entries.find(e => e.timestamp) || entries[0];
  const lastEntry = entries[entries.length - 1];

  const timestamp = firstEntry.timestamp;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;

  const { keywords, firstMessage } = extractKeywordsWithFallback(entries);
  const timeStr = formatTimestamp(timestamp);
  const title = [timeStr, ...keywords].join("_");

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let userEntryCount = 0;
  let userTextMessageCount = 0;
  let toolResultCount = 0;
  let toolUseCount = 0;
  let errorCount = 0;
  const models = new Set();
  const toolNames = {};
  const toolUseIdMap = {};
  const slashCommands = [];
  const skillCalls = [];
  const messages = [];

  // plan_slug: 세션이 어떤 플랜에서 시작됐는지 (linkedSessionId 연결용)
  let planSlug = null;
  for (let i = 0; i < Math.min(10, entries.length); i++) {
    if (entries[i].slug && entries[i].sessionId) {
      planSlug = entries[i].slug;
      break;
    }
  }

  for (const entry of entries) {
    if (entry.type === "user") {
      userEntryCount++;

      // tool_result block 수 합산
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        toolResultCount += content.filter(b => b.type === "tool_result").length;
        errorCount += content.filter(b => b.type === "tool_result" && b.is_error).length;
      }

      // 실제 사용자 텍스트 판정: isMeta 제외 (스킬 확장 프롬프트는 시스템 자동 주입)
      const rawText = getTextFromMessage(entry.message);
      const cmds = extractSlashCommands(rawText);
      if (cmds.length > 0) slashCommands.push(...cmds);
      const cleanText = stripSystemTags(rawText);
      const isUserText = !entry.isMeta && cleanText.trim();
      if (isUserText) {
        userTextMessageCount++;
      }

      // isMeta (스킬 본문 주입)는 messages에서 제외 — Skill tool_use로 이미 추적됨
      if (entry.isMeta) continue;

      // 메시지 분류 (대시보드 역할 라벨 분화용)
      const isToolResult = Array.isArray(content) && content.some(b => b.type === "tool_result");
      const subtype = entry.isMeta ? "meta"
        : isToolResult ? "tool_result"
        : "user_input";

      const msgObj = { role: "user", subtype, text: cleanText || (cmds.length > 0 ? cmds.join(" ") : ""), timestamp: entry.timestamp };
      if (isToolResult) {
        const trTools = content
          .filter(b => b.type === "tool_result" && b.tool_use_id)
          .map(b => toolUseIdMap[b.tool_use_id])
          .filter(Boolean);
        if (trTools.length > 0) msgObj.tools = trTools;
      }
      messages.push(msgObj);
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
            if (block.id) toolUseIdMap[block.id] = { name, input: block.input };
            if (block.name === "Skill" && block.input?.skill) {
              skillCalls.push(block.input.skill);
            }
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
    userEntryCount,
    userTextMessageCount,
    toolResultCount,
    toolUseCount,
    errorCount,
    totalInputTokens,
    totalOutputTokens,
    toolNames,
    slashCommands,
    skillCalls,
    firstMessage: displayFirstMsg.substring(0, 200),
    lastMessage: extractLastMessage(mergedMessages),
    projectDisplay: project,
    filePath: absFilePath,
    planSlug,
  };

  return { metadata, messages: mergedMessages };
}

// ── Codex 스킬 화이트리스트 빌드 ──
// ~/.codex/skills/ 하위 디렉토리명을 스캔하여 Set 반환 (_/. 시작 제외)
function buildCodexSkillWhitelist() {
  const skillsDir = path.join(os.homedir(), ".codex", "skills");
  if (!fs.existsSync(skillsDir)) return null;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return new Set(
    entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith("_") &&
          !e.name.startsWith(".")
      )
      .map((e) => e.name)
  );
}

// ── 통합 스킬 화이트리스트 로드 ──
// skills-registry.json의 names 배열 → Set. 미존재 시 buildCodexSkillWhitelist() fallback.
function loadSkillWhitelist() {
  const registryPath = path.join(
    os.homedir(), ".claude", "skills", "skills-registry.json"
  );
  try {
    if (fs.existsSync(registryPath)) {
      const reg = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
      if (Array.isArray(reg.names) && reg.names.length > 0) {
        return new Set(reg.names);
      }
    }
  } catch {}
  return buildCodexSkillWhitelist();
}

// ── Codex 세션 파싱 ──
function processCodexSession(filePath) {
  const entries = parseJSONL(filePath);
  const absFilePath = path.resolve(filePath);
  if (entries.length === 0) return null;

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

  const models = new Set();
  for (const entry of entries) {
    if (entry.type === "turn_context" && entry.payload && entry.payload.model) {
      models.add(entry.payload.model);
    }
  }

  const messages = [];
  const slashCommands = [];
  const codexSkillWhitelist = loadSkillWhitelist();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lastTokenEntry = null;
  let toolUseCount = 0;
  let toolResultCount = 0;
  const toolNames = {};

  for (const entry of entries) {
    const ts = entry.timestamp;

    if (entry.type === "event_msg") {
      const ep = entry.payload || {};
      if (ep.type === "user_message" && ep.message) {
        const codexCmds = extractCodexSkills(ep.message, codexSkillWhitelist);
        if (codexCmds.length > 0) slashCommands.push(...codexCmds);
        messages.push({
          role: "user",
          subtype: "user_input",
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
      } else if (pType === "function_call_output") {
        toolResultCount++;
      }
    }
  }

  if (lastTokenEntry) {
    totalInputTokens = (lastTokenEntry.input_tokens || 0) + (lastTokenEntry.cached_input_tokens || 0);
    totalOutputTokens = (lastTokenEntry.output_tokens || 0) + (lastTokenEntry.reasoning_output_tokens || 0);
  }

  if (messages.length === 0) return null;

  const firstUserMsg = messages.find((m) => m.role === "user");
  const firstMsgText = firstUserMsg ? firstUserMsg.text : "";
  const keywords = extractKeywords(firstMsgText);

  const timeStr = formatTimestamp(timestamp);
  const title = [timeStr, ...keywords].join("_");
  const lastEntry = entries[entries.length - 1];
  const project = normalizeProjectPath(cwd);
  const userEntryCount = messages.filter((m) => m.role === "user").length;

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
    userEntryCount,
    userTextMessageCount: userEntryCount,
    toolResultCount,
    toolUseCount,
    errorCount: 0,
    totalInputTokens,
    totalOutputTokens,
    toolNames,
    slashCommands,
    firstMessage: firstMsgText.substring(0, 200),
    lastMessage: extractLastMessage(messages),
    filePath: absFilePath,
  };

  return { metadata, messages };
}

// ── Plan 파싱 ──
function parsePlan(filePath) {
  const absFilePath = path.resolve(filePath);
  const slug = path.basename(filePath, ".md");
  const stat = fs.statSync(filePath);
  const rawText = fs.readFileSync(filePath, "utf8");

  if (!rawText.trim()) return null;

  const lines = rawText.split("\n");
  let title = slug;
  const firstHeading = lines.find((l) => /^#\s+/.test(l));
  if (firstHeading) {
    title = firstHeading.replace(/^#+\s+/, "").trim();
  }

  const isCompleted = /^#\s*완료/.test(lines[0]?.trim() || "");
  const timestamp = new Date(stat.mtimeMs).toISOString();

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

  const kwSource = title + " " + contextText;
  const keywords = extractKeywords(kwSource);

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
      lastMessage: "",
      charCount: rawText.length,
      gitBranch: "",
      models: [],
      userEntryCount: 0,
      userTextMessageCount: 0,
      toolResultCount: 0,
      toolUseCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      toolNames: {},
      filePath: absFilePath,
    },
    content: rawText,
  };
}

// ── JSONL 이벤트 정규화 (session-normalizer.js에서 이동) ──

function pushTopLevelMessageEvents(events, entry, source, agentId) {
  const timestamp = entry.timestamp || "";
  const timestampMs = parseTimestamp(timestamp);

  if (entry.type === "user" && entry.message) {
    const content = entry.message.content || entry.message;
    const text = getTextContent(content);
    if (text) {
      events.push({
        agentId,
        kind: "user_text",
        source,
        text,
        timestamp,
        timestampMs,
      });
    }

    for (const toolResult of findToolResults(content)) {
      events.push({
        agentId,
        isError: toolResult.isError,
        kind: "tool_result",
        rawText: toolResult.rawText,
        source,
        timestamp,
        timestampMs,
        toolUseId: toolResult.toolUseId,
      });
    }

    if (entry.planContent) {
      events.push({
        agentId,
        kind: "plan_content",
        source,
        text: entry.planContent,
        timestamp,
        timestampMs,
      });
    }

    return;
  }

  if (entry.type !== "assistant" || !entry.message) {
    return;
  }

  const text = getTextContent(entry.message.content || entry.message);
  const thinking = getThinkingContent(entry.message.content);
  if (text) {
    events.push({
      agentId,
      kind: "assistant_text",
      source,
      text,
      timestamp,
      timestampMs,
    });
  }

  if (thinking) {
    events.push({
      agentId,
      kind: "assistant_thinking",
      source,
      text: thinking,
      timestamp,
      timestampMs,
    });
  }

  for (const toolUse of findToolUses(entry.message.content)) {
    events.push({
      agentId,
      input: toolUse.input,
      kind: "tool_use",
      source,
      timestamp,
      timestampMs,
      toolName: toolUse.toolName,
      toolUseId: toolUse.toolUseId,
    });
  }
}

function pushProgressEvents(events, entry, source, agentId) {
  const timestamp = entry.timestamp || "";
  const timestampMs = parseTimestamp(timestamp);
  const progressType = entry.data?.type || "progress";

  events.push({
    agentId: entry.data?.agentId || agentId || "",
    command: entry.data?.command || "",
    hookEvent: entry.data?.hookEvent || "",
    kind: "progress",
    progressType,
    prompt: entry.data?.prompt || "",
    source,
    timestamp,
    timestampMs,
  });

  const progressMessage = entry.data?.message?.message;
  if (!progressMessage) {
    return;
  }

  for (const toolResult of findToolResults(progressMessage.content)) {
    events.push({
      agentId: entry.data?.agentId || agentId || "",
      fromProgressMessage: true,
      isError: toolResult.isError,
      kind: "tool_result",
      progressType,
      rawText: toolResult.rawText,
      source,
      timestamp,
      timestampMs,
      toolUseId: toolResult.toolUseId,
    });
  }
}

function normalizeCodexEntries(entries, source, agentId) {
  const events = [];

  for (const entry of entries) {
    if (!entry || !entry.timestamp) continue;
    const timestamp = entry.timestamp;
    const timestampMs = parseTimestamp(timestamp);

    if (entry.type === "event_msg") {
      const ep = entry.payload || {};
      if (ep.type === "user_message" && ep.message) {
        events.push({
          agentId,
          kind: "user_text",
          source,
          text: ep.message,
          timestamp,
          timestampMs,
        });
      }
      continue;
    }

    if (entry.type === "response_item") {
      const ep = entry.payload || {};
      const pType = ep.type;

      if (pType === "message" && ep.role === "assistant") {
        let text = "";
        if (Array.isArray(ep.content)) {
          text = ep.content
            .filter((c) => c.type === "output_text")
            .map((c) => c.text || "")
            .join("\n");
        }
        if (text) {
          events.push({
            agentId,
            kind: "assistant_text",
            source,
            text,
            timestamp,
            timestampMs,
          });
        }
        continue;
      }

      if (pType === "function_call" || pType === "custom_tool_call") {
        const toolName = ep.name || "unknown";
        let input = {};
        if (pType === "function_call") {
          try { input = ep.arguments ? JSON.parse(ep.arguments) : {}; } catch { input = { raw: ep.arguments }; }
        } else {
          input = ep.input !== undefined ? ep.input : {};
        }
        events.push({
          agentId,
          input,
          kind: "tool_use",
          source,
          timestamp,
          timestampMs,
          toolName,
          toolUseId: ep.call_id || ep.id || "",
        });
        continue;
      }
    }
  }

  return events.sort((left, right) => left.timestampMs - right.timestampMs);
}

function normalizeEntries(entries, source, agentId) {
  const events = [];

  for (const entry of entries) {
    if (!entry || !entry.timestamp) continue;

    if (entry.type === "system" && entry.subtype === "turn_duration") {
      events.push({
        agentId,
        durationMs: entry.durationMs || 0,
        kind: "turn_duration",
        source,
        timestamp: entry.timestamp,
        timestampMs: parseTimestamp(entry.timestamp),
      });
      continue;
    }

    if (entry.type === "progress" && entry.data) {
      pushProgressEvents(events, entry, source, agentId);
      continue;
    }

    pushTopLevelMessageEvents(events, entry, source, agentId);
  }

  return events.sort((left, right) => left.timestampMs - right.timestampMs);
}

// ── Gemini 세션 파싱 ──
function processGeminiSession(filePath, projectRoot) {
  const absFilePath = path.resolve(filePath);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`⚠️  Gemini JSON 파싱 실패: ${filePath} — ${err.message}`);
    return null;
  }

  const rawSessionId = data.sessionId;
  if (!rawSessionId) return null;
  const sessionId = "gemini:" + rawSessionId;

  const timestamp = data.startTime;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;
  const lastTimestamp = data.lastUpdated || timestamp;

  const messages = data.messages || [];

  // 빈 세션 (user 메시지 없음) 건너뜀
  const userMessages = messages.filter(m => m.type === "user");
  if (userMessages.length === 0) return null;

  // 모델 수집
  const modelSet = new Set();
  for (const msg of messages) {
    if (msg.type === "gemini" && msg.model) modelSet.add(msg.model);
  }

  // 토큰 합산
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  for (const msg of messages) {
    if (msg.type === "gemini" && msg.tokens) {
      const t = msg.tokens;
      totalInputTokens += (t.input || 0) + (t.cached || 0) + (t.tool || 0);
      totalOutputTokens += (t.output || 0) + (t.thoughts || 0);
    }
  }

  // tool 통계
  let toolUseCount = 0;
  const toolNames = {};
  for (const msg of messages) {
    if (msg.type === "gemini" && Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        toolUseCount++;
        const name = tc.name || "unknown";
        toolNames[name] = (toolNames[name] || 0) + 1;
      }
    }
  }

  // 메시지 배열 구축
  const builtMessages = [];
  const slashCommands = [];
  for (const msg of messages) {
    if (msg.type === "user") {
      const contentArr = Array.isArray(msg.content) ? msg.content : [];
      const text = contentArr.map(c => c.text || "").join("\n");
      const gemCmds = extractSlashSkills(text);
      if (gemCmds.length > 0) slashCommands.push(...gemCmds);
      builtMessages.push({
        role: "user",
        subtype: "user_input",
        text,
        timestamp: msg.timestamp,
      });
    } else if (msg.type === "gemini") {
      const text = typeof msg.content === "string" ? msg.content : "";
      const tools = Array.isArray(msg.toolCalls)
        ? msg.toolCalls.map(tc => ({ name: tc.name, input: tc.args }))
        : [];
      const msgObj = { role: "assistant", timestamp: msg.timestamp };
      if (text) msgObj.text = text;
      if (tools.length > 0) msgObj.tools = tools;
      if (text || tools.length > 0) builtMessages.push(msgObj);
    }
    // error 타입은 건너뜀
  }

  // 키워드/첫 메시지
  const firstUserMsg = userMessages[0];
  const contentArr = Array.isArray(firstUserMsg.content) ? firstUserMsg.content : [];
  const firstMsgText = contentArr.map(c => c.text || "").join("\n");
  const keywords = extractKeywords(firstMsgText);
  const timeStr = formatTimestamp(timestamp);
  const title = [timeStr, ...keywords].join("_");

  const project = normalizeProjectPath(projectRoot || "");

  const metadata = {
    sessionId,
    type: "gemini",
    title,
    keywords,
    timestamp,
    lastTimestamp,
    project,
    projectDisplay: project,
    gitBranch: "",
    models: [...modelSet],
    userEntryCount: userMessages.length,
    userTextMessageCount: userMessages.length,
    toolResultCount: toolUseCount,
    toolUseCount,
    errorCount: 0,
    totalInputTokens,
    totalOutputTokens,
    toolNames,
    slashCommands,
    firstMessage: firstMsgText.substring(0, 200),
    lastMessage: extractLastMessage(builtMessages),
    filePath: absFilePath,
  };

  return { metadata, messages: builtMessages };
}

// ── Gemini 이벤트 정규화 ──
function normalizeGeminiEntries(rawMessages) {
  const { parseTimestamp } = require("./text-utils.js");
  const events = [];

  for (const msg of rawMessages) {
    if (!msg || !msg.timestamp) continue;
    const timestamp = msg.timestamp;
    const timestampMs = parseTimestamp(timestamp);

    if (msg.type === "user") {
      const contentArr = Array.isArray(msg.content) ? msg.content : [];
      const text = contentArr.map(c => c.text || "").join("\n");
      if (text) {
        events.push({ agentId: "", kind: "user_text", source: "main", text, timestamp, timestampMs });
      }
    } else if (msg.type === "gemini") {
      // thoughts
      if (Array.isArray(msg.thoughts) && msg.thoughts.length > 0) {
        const thoughtText = msg.thoughts.map(t => t.description || "").filter(Boolean).join("\n");
        if (thoughtText) {
          events.push({ agentId: "", kind: "assistant_thinking", source: "main", text: thoughtText, timestamp, timestampMs });
        }
      }
      // tool calls
      if (Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          events.push({
            agentId: "",
            kind: "tool_use",
            source: "main",
            toolName: tc.name || "unknown",
            toolUseId: tc.id || "",
            input: tc.args || {},
            timestamp,
            timestampMs,
          });
          if (tc.result !== undefined) {
            events.push({
              agentId: "",
              kind: "tool_result",
              source: "main",
              toolUseId: tc.id || "",
              rawText: JSON.stringify(tc.result).substring(0, 500),
              timestamp,
              timestampMs,
            });
          }
        }
      }
      // content text
      if (typeof msg.content === "string" && msg.content) {
        events.push({ agentId: "", kind: "assistant_text", source: "main", text: msg.content, timestamp, timestampMs });
      }
    }
  }

  return events.sort((a, b) => a.timestampMs - b.timestampMs);
}

// ── Antigravity 세션 파싱 ──
function processAntigravitySession(conversation, exportFilePath) {
  const cascadeId = conversation.cascade_id;
  if (!cascadeId) return null;

  const sessionId = "antigravity:" + cascadeId;
  const rawMessages = conversation.messages || [];
  const userMessages = rawMessages.filter(m => m.role === "user");
  if (userMessages.length === 0) return null;

  // created_time 폴백: 빈 문자열이면 첫 메시지 timestamp 사용
  const firstMsgTs = rawMessages.find(m => m.timestamp)?.timestamp || "";
  const timestamp = conversation.created_time || firstMsgTs;
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return null;

  const lastMsgTs = [...rawMessages].reverse().find(m => m.timestamp)?.timestamp || "";
  const lastTimestamp = conversation.last_modified_time || lastMsgTs || timestamp;

  // workspace URI → project 경로
  let project = "";
  if (Array.isArray(conversation.workspaces) && conversation.workspaces.length > 0) {
    try {
      const url = new URL(conversation.workspaces[0]);
      project = normalizeProjectPath(decodeURIComponent(url.pathname).replace(/^\//, ""));
    } catch {
      project = conversation.workspaces[0];
    }
  }

  // tool 통계
  let toolUseCount = 0;
  const toolNames = {};
  for (const msg of rawMessages) {
    if (msg.role === "tool" && msg.tool_name) {
      toolUseCount++;
      toolNames[msg.tool_name] = (toolNames[msg.tool_name] || 0) + 1;
    }
  }

  // 메시지 배열
  const builtMessages = [];
  const slashCommands = [];
  for (const msg of rawMessages) {
    if (msg.role === "user") {
      const agCmds = extractSlashSkills(msg.content || "");
      if (agCmds.length > 0) slashCommands.push(...agCmds);
      builtMessages.push({
        role: "user",
        subtype: "user_input",
        text: msg.content || "",
        timestamp: msg.timestamp || null,
      });
    } else if (msg.role === "assistant") {
      builtMessages.push({
        role: "assistant",
        text: msg.content || "",
        timestamp: msg.timestamp || null,
      });
    } else if (msg.role === "tool") {
      builtMessages.push({
        role: "assistant",
        subtype: "tool_use",
        text: msg.content || "",
        timestamp: msg.timestamp || null,
        tools: [{ name: msg.tool_name || "unknown" }],
      });
    }
  }

  // 키워드/첫 메시지/제목
  const firstMsgText = (userMessages[0]?.content || "").substring(0, 500);
  const keywords = extractKeywords(firstMsgText);
  const agTitle = conversation.title;
  const title = (agTitle && !agTitle.startsWith("_unindexed_"))
    ? agTitle
    : [formatTimestamp(timestamp), ...keywords].join("_");

  const metadata = {
    sessionId,
    type: "antigravity",
    title,
    keywords,
    timestamp,
    lastTimestamp,
    project,
    projectDisplay: project,
    gitBranch: "",
    models: [],
    userEntryCount: userMessages.length,
    userTextMessageCount: userMessages.length,
    toolResultCount: toolUseCount,
    toolUseCount,
    errorCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    toolNames,
    slashCommands,
    firstMessage: firstMsgText.substring(0, 200),
    lastMessage: extractLastMessage(builtMessages),
    filePath: exportFilePath || "",
  };

  return { metadata, messages: builtMessages };
}

// ── Antigravity 이벤트 정규화 ──
function normalizeAntigravityEntries(rawMessages) {
  const { parseTimestamp } = require("./text-utils.js");
  const events = [];

  for (const msg of rawMessages) {
    if (!msg || !msg.timestamp) continue;
    const timestamp = msg.timestamp;
    const timestampMs = parseTimestamp(timestamp);

    if (msg.role === "user") {
      if (msg.content) {
        events.push({ agentId: "", kind: "user_text", source: "main", text: msg.content, timestamp, timestampMs });
      }
    } else if (msg.role === "assistant") {
      if (msg.content) {
        events.push({ agentId: "", kind: "assistant_text", source: "main", text: msg.content, timestamp, timestampMs });
      }
    } else if (msg.role === "tool") {
      events.push({
        agentId: "",
        kind: "tool_use",
        source: "main",
        toolName: msg.tool_name || "unknown",
        toolUseId: "",
        input: msg.content || "",
        timestamp,
        timestampMs,
      });
    }
  }

  return events.sort((a, b) => (a.timestampMs || 0) - (b.timestampMs || 0));
}

module.exports = {
  extractKeywords,
  extractKeywordsWithFallback,
  findCwd,
  formatTimestamp,
  getTextFromMessage,
  normalizeAntigravityEntries,
  normalizeCodexEntries,
  normalizeEntries,
  normalizeGeminiEntries,
  normalizeProjectPath,
  parsePlan,
  parseJSONL,
  processAntigravitySession,
  processCodexSession,
  processGeminiSession,
  processSession,
  readJsonl,
};
