import { spawn } from "node:child_process";
import { resolve } from "node:path";

const rootDir = resolve(process.cwd());
const serverDir = resolve(rootDir, "server");
const children = [];

function run(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: "pipe",
    shell: process.platform === "win32",
    env: process.env,
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      process.stderr.write(`[${label}] exited with code ${code}\n`);
    }
  });

  children.push(child);
}

function cleanupAndExit(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(signal ? 0 : 1);
}

process.on("SIGINT", () => cleanupAndExit("SIGINT"));
process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));

console.log("Starting backend and frontend...");
run("server", "npm", ["run", "dev"], serverDir);
run("web", "npm", ["run", "dev"], rootDir);
