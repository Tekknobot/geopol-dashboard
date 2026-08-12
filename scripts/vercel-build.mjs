import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const projectRoot = process.cwd();
const legacyPages = join(projectRoot, "src", "pages");
const parkedPages = join(
  projectRoot,
  `.vercel-legacy-pages-${process.pid}`,
);

let parked = false;

try {
  // The original Vite dashboard used src/pages for ordinary components.
  // Next interprets that folder as its Pages Router, which conflicts with the
  // redesigned root app directory. Park it only for this ephemeral build.
  if (existsSync(legacyPages)) {
    renameSync(legacyPages, parkedPages);
    parked = true;
  }

  const nextCli = join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const result = spawnSync(process.execPath, [nextCli, "build"], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status ?? 1;
} finally {
  if (parked && existsSync(parkedPages)) {
    renameSync(parkedPages, legacyPages);
  }
}
