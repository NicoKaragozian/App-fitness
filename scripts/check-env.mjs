import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const rootDir = resolve(process.cwd());
const serverEnvPath = resolve(rootDir, "server/.env");
const nodeMajor = Number(process.versions.node.split(".")[0]);

let hasError = false;

function ok(message) {
  console.log(`OK: ${message}`);
}

function warn(message) {
  console.warn(`WARN: ${message}`);
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  hasError = true;
}

if (nodeMajor >= 18) {
  ok(`Node.js ${process.versions.node} detected.`);
} else {
  fail(`Node.js ${process.versions.node} detected. Node.js 18+ is required.`);
}

if (existsSync(serverEnvPath)) {
  ok("Found server/.env");
} else {
  fail("Missing server/.env. Run `npm run setup` first.");
}

if (existsSync(serverEnvPath)) {
  const envRaw = readFileSync(serverEnvPath, "utf8");
  const providerMatch = envRaw.match(/^\s*AI_PROVIDER\s*=\s*(.+)\s*$/m);
  const provider = providerMatch?.[1]?.trim() ?? "gemma";

  if (provider === "gemma") {
    try {
      execSync("ollama --version", { stdio: "ignore" });
      ok("Ollama detected for AI_PROVIDER=gemma.");
    } catch {
      warn("AI_PROVIDER=gemma but Ollama is not installed or not in PATH.");
      warn("Install Ollama or switch to AI_PROVIDER=claude and set ANTHROPIC_API_KEY.");
    }
  } else if (provider === "claude") {
    const anthropicMatch = envRaw.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m);
    if (anthropicMatch?.[1]?.trim()) {
      ok("ANTHROPIC_API_KEY is set for AI_PROVIDER=claude.");
    } else {
      warn("AI_PROVIDER=claude but ANTHROPIC_API_KEY is missing in server/.env.");
    }
  } else {
    warn(`Unknown AI_PROVIDER value: ${provider}`);
  }
}

if (hasError) {
  process.exit(1);
}
