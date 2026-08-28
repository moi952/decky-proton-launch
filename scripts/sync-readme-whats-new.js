// Run at release time (see release.yml), right after sync-whats-new-version.js
// has settled the real whats_new key. Replaces README's "New in X.Y.Z" section
// with the current release's bullets, so the README always reflects the
// latest version instead of drifting behind it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [, , newVersion] = process.argv;
if (!newVersion) {
  console.error("Usage: node sync-readme-whats-new.js <newVersion>");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.join(__dirname, "..", "README.md");
const enLocalePath = path.join(__dirname, "..", "src", "i18n", "locales", "en-US.json");

const key = `v${newVersion.replace(/\./g, "_")}`;
const en = JSON.parse(fs.readFileSync(enLocalePath, "utf-8"));
const entry = en.whats_new?.[key];

if (!entry) {
  console.log(`[sync-readme] no whats_new.${key} entry in en-US.json, leaving README untouched`);
  process.exit(0);
}

const block = [`### ✨ New in ${newVersion}`, "", ...entry.items.map((item) => `- ${item}`)].join("\n");

const readme = fs.readFileSync(readmePath, "utf-8");
const sectionRe = /### ✨ New in [^\n]*\n\n(?:- .*\n)+/;

if (!sectionRe.test(readme)) {
  console.error("[sync-readme] couldn't find an existing '### ✨ New in ...' section to replace");
  process.exit(1);
}

fs.writeFileSync(readmePath, readme.replace(sectionRe, block + "\n"), "utf-8");
console.log(`[sync-readme] README.md What's New section updated to ${newVersion}`);
