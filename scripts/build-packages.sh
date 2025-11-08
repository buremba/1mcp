#!/usr/bin/env node

// Build packages in dependency order
import { execSync } from "child_process";
import { existsSync } from "fs";

const packages = [
  "packages/shared",
  "packages/browser-harness",
  "packages/server",
  "website",
];

function buildPackage(pkg) {
  if (!existsSync(pkg)) {
    console.error(`❌ Package not found: ${pkg}`);
    process.exit(1);
  }

  console.log(`\n📦 Building ${pkg}...`);
  try {
    execSync("npm run build", { cwd: pkg, stdio: "inherit" });
    console.log(`✅ ${pkg} built successfully`);
  } catch (error) {
    console.error(`❌ Failed to build ${pkg}`);
    process.exit(1);
  }
}

console.log("🔨 Building all packages in dependency order...\n");

for (const pkg of packages) {
  buildPackage(pkg);
}

console.log("\n✅ All packages built successfully!");
