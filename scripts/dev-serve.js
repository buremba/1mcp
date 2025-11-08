#!/usr/bin/env node
/**
 * Development serve script - loads .env and runs the CLI
 */

import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Load .env file
config({ path: resolve(rootDir, '.env') });

const projectDir = process.env.PROJECT_DIR || 'examples/hello-world';
const cliPath = resolve(rootDir, 'packages/server/dist/cli/index.js');

// Get command from args (default to 'serve')
const command = process.argv[2] || 'serve';
const args = process.argv.slice(3);

// Run the CLI with the project directory
const child = spawn('node', [cliPath, command, '--dir', projectDir, ...args], {
  stdio: 'inherit',
  cwd: rootDir
});

child.on('exit', (code) => {
  process.exit(code);
});
