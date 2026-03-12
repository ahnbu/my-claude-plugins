#!/usr/bin/env node
/**
 * pre-commit hook: marketplace.json과 각 plugin.json의 버전 일치 검증
 *
 * 불일치 시 커밋을 차단하고 어떤 플러그인이 불일치인지 출력한다.
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const marketplacePath = path.join(
  repoRoot,
  ".claude-plugin",
  "marketplace.json"
);

try {
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, "utf8"));
  const errors = [];

  for (const plugin of marketplace.plugins) {
    const pluginJsonPath = path.join(
      repoRoot,
      plugin.source,
      ".claude-plugin",
      "plugin.json"
    );

    if (!fs.existsSync(pluginJsonPath)) {
      errors.push(
        `  ${plugin.name}: plugin.json not found at ${plugin.source}/.claude-plugin/plugin.json`
      );
      continue;
    }

    const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, "utf8"));

    if (plugin.version !== pluginJson.version) {
      errors.push(
        `  ${plugin.name}: marketplace.json=${plugin.version} ≠ plugin.json=${pluginJson.version}`
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n[pre-commit] Version sync check FAILED:\n");
    errors.forEach((e) => console.error(e));
    console.error(
      "\nFix: marketplace.json과 plugin.json의 version을 일치시키세요.\n"
    );
    process.exit(1);
  }
} catch (err) {
  console.error(`\n[pre-commit] Version check error: ${err.message}\n`);
  process.exit(1);
}
