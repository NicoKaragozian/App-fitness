import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = resolve(process.cwd());
const serverDir = resolve(rootDir, "server");
const envExamplePath = resolve(serverDir, ".env.example");
const envPath = resolve(serverDir, ".env");

function run(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Installing frontend dependencies...");
run("npm", ["install", "--legacy-peer-deps"], rootDir);

console.log("Installing backend dependencies...");
run("npm", ["install"], serverDir);

if (!existsSync(envPath)) {
  if (!existsSync(envExamplePath)) {
    console.error("Missing server/.env.example. Cannot create server/.env.");
    process.exit(1);
  }
  copyFileSync(envExamplePath, envPath);
  console.log("Created server/.env from server/.env.example");
} else {
  console.log("server/.env already exists, keeping current file.");
}

console.log("Setup complete. Run `npm run check:env` and then `npm run dev:all`.");
