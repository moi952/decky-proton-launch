import React, { useEffect, useState } from "react";
// @ts-ignore — replaced at build time by rollup with the content of plugin.json
import manifest from "@decky/manifest";

const CURRENT_VERSION: string = manifest?.version ?? "0.0.0";

const REPO = "moi952/decky-proton-launch";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

function semverGt(a: string, b: string): boolean {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export const UpdateBanner: React.FC = () => {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch(RELEASES_URL)
      .then((r) => r.json())
      .then((data) => {
        const tag: string = data?.tag_name ?? "";
        if (tag && semverGt(tag, CURRENT_VERSION)) {
          setLatestVersion(tag.replace(/^v/, ""));
        }
      })
      .catch(() => {});
  }, []);

  if (!latestVersion) return null;

  return (
    <a
      href={RELEASES_PAGE}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        margin: "0 16px 8px",
        padding: "6px 10px",
        background: "#1a2a1a",
        border: "1px solid #4caf50",
        borderRadius: "6px",
        fontSize: 11,
        color: "#4caf50",
        textDecoration: "none",
        textAlign: "center",
      }}
    >
      ↑ v{latestVersion} available — click to download
    </a>
  );
};
