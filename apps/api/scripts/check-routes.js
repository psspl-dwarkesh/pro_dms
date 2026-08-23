import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "../src");

async function collectJsFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJsFiles(fullPath)));
    else if (entry.name.endsWith(".js")) files.push(fullPath);
  }
  return files;
}

const files = await collectJsFiles(resolve(srcRoot, "routes"));
files.push(resolve(srcRoot, "validate.js"));

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`Checked ${files.length} route/support files.`);
