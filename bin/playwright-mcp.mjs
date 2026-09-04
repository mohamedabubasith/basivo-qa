#!/usr/bin/env node
// Starts the Playwright MCP server for this plugin.
//
// One job beyond passing flags: credentials. Playwright MCP can substitute
// secrets from a dotenv file when the agent types a secret's *name*, and
// redact the values from everything it returns, so the checking agent never
// sees a password. But the server refuses to start when the file is missing,
// and most projects have none. So: pass --secrets only when the project has
// a .qa folder, creating an empty secrets file there if needed.
import { existsSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const VERSION = "0.0.80";
const root = process.cwd();
const args = ["-y", `@playwright/mcp@${VERSION}`, "--isolated", "--headless", "--output-dir", ".qa/run"];
if (existsSync(join(root, ".qa"))) {
  const secrets = join(root, ".qa", "secrets.env");
  if (!existsSync(secrets)) writeFileSync(secrets, "# QA_USER=you@example.com\n# QA_PASSWORD=...\n");
  args.push("--secrets", secrets);
}
const child = spawn("npx", args, { stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
