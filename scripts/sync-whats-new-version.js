// Run at release time (see release.yml). Claude adds each new What's New
// entry ahead of release under a guessed "next version" key — if the actual
// bump doesn't match that guess (e.g. a patch got skipped), this renames the
// pending entry to the real version instead of shipping it under the wrong
// key or leaving it stuck for a version that's already out.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , oldVersion, newVersion] = process.argv;
if (!oldVersion || !newVersion) {
  console.error("Usage: node sync-whats-new-version.js <oldVersion> <newVersion>");
  process.exit(1);
}

const toKey = (v) => `v${v.replace(/\./g, "_")}`;
const toParts = (v) => v.split(".").map(Number);
const isNewerThan = (a, b) => {
  const pa = toParts(a);
  const pb = toParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] > pb[i];
  }
  return false;
};

const oldKey = toKey(oldVersion);
const newKey = toKey(newVersion);

if (oldKey === newKey) {
  console.log("[sync-whats-new] old and new version resolve to the same key, nothing to do");
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "src", "i18n", "locales");
const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));

let changedAny = false;

for (const file of files) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const wn = data.whats_new;
  if (!wn) continue;

  if (wn[newKey]) {
    console.log(`[sync-whats-new] ${file}: ${newKey} already present, skipping`);
    continue;
  }

  const pendingKeys = Object.keys(wn).filter((k) => {
    const m = k.match(/^v(\d+)_(\d+)_(\d+)$/);
    if (!m) return false;
    const version = m.slice(1).join(".");
    return isNewerThan(version, oldVersion);
  });

  if (pendingKeys.length === 0) {
    console.log(`[sync-whats-new] ${file}: no pending entry ahead of ${oldVersion}, nothing to rename`);
    continue;
  }
  if (pendingKeys.length > 1) {
    console.warn(
      `[sync-whats-new] ${file}: multiple pending entries found (${pendingKeys.join(", ")}), skipping — resolve manually`,
    );
    continue;
  }

  const pendingKey = pendingKeys[0];
  const guessedVersion = pendingKey.slice(1).replace(/_/g, ".");
  const entry = wn[pendingKey];
  if (entry.title) {
    entry.title = entry.title.split(guessedVersion).join(newVersion);
  }

  const reordered = {};
  for (const k of Object.keys(wn)) {
    reordered[k === pendingKey ? newKey : k] = k === pendingKey ? entry : wn[k];
  }
  data.whats_new = reordered;

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
  console.log(`[sync-whats-new] ${file}: renamed ${pendingKey} -> ${newKey}`);
  changedAny = true;
}

if (!changedAny) {
  console.log("[sync-whats-new] no files changed");
}
