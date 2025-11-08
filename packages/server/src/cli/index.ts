#!/usr/bin/env node
/**
 * CLI entry point (spec §12)
 */

import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("1mcp")
  .description("MCP server with browser-based execution")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize 1mcp.config.json")
  .option("--dir <path>", "Project directory", ".")
  .action((options) => {
    if (options.dir && options.dir !== ".") {
      process.chdir(options.dir);
    }
    initCommand();
  });

program
  .command("serve")
  .description("Start MCP server and UI")
  .option("-c, --config <path>", "Config file path", "1mcp.config.json")
  .option("-p, --port <number>", "Server port", "7888")
  .option("--bind <address>", "Bind address", "127.0.0.1")
  .option("--open", "Auto-open browser")
  .option("--no-ui", "Headless mode (no browser UI)")
  .option("--dir <path>", "Project directory", ".")
  .option("--timeout <ms>", "Execution timeout in milliseconds")
  .option("--max-memory <mb>", "Maximum memory per execution in MB")
  .option("--max-stdout <bytes>", "Maximum stdout size in bytes")
  .action((options) => {
    if (options.dir && options.dir !== ".") {
      process.chdir(options.dir);
    }
    serveCommand(options);
  });

program.parse();
