import { useEffect, useRef, useState } from "react";
import {
  ButtonItem,
  DialogButton,
  DropdownItem,
  Navigation,
  PanelSectionRow,
  ProgressBarWithInfo,
} from "@decky/ui";
import { toaster } from "@decky/api";
import { useTranslation } from "react-i18next";
import { CollapsibleSection } from "./CollapsibleSection";
import {
  compareVersions,
  fetchPluginReleases,
  PluginRelease,
  PluginUpdateInfo,
} from "../utils/githubReleases";

export type { PluginUpdateInfo, PluginRelease };

// Decky Loader's own PluginInstallType enum — verified against
// backend/decky_loader/browser.py in SteamDeckHomebrew/decky-loader. Only
// used for labeling Decky's own native install-confirm dialog (see
// PluginBrowser.request_plugin_install in that file, which just forwards it
// to a UI event); the actual install always installs whatever artifact/
// version/hash was passed regardless of this value.
enum PluginInstallType {
  INSTALL = 0,
  REINSTALL = 1,
  UPDATE = 2,
  DOWNGRADE = 3,
}

const installTypeFor = (
  targetVersion: string,
  currentVersion: string,
): PluginInstallType => {
  const cmp = compareVersions(targetVersion, currentVersion);
  if (cmp > 0) return PluginInstallType.UPDATE;
  if (cmp < 0) return PluginInstallType.DOWNGRADE;
  return PluginInstallType.REINSTALL;
};

// Same remount issue as index.tsx's view restoration (see the comment
// there): picking this dropdown's option makes Decky tear down and recreate
// the whole panel, which would otherwise silently drop the pick right back
// to whatever the effect below defaults to. Persisted outside React,
// restored only within a short window after the fact.
const SELECTION_RESTORE_WINDOW_MS = 5000;
let lastSelectedTag = "";
let lastSelectedTagAt = 0;

// window.DeckyBackend lives on whichever window actually created this
// document. In Gaming Mode the Quick Access panel renders inside a popup
// window (opened via window.open by Big Picture Mode) — DeckyBackend is
// undefined on that popup's own `window` there, but reachable via
// `window.opener`.
const getDeckyBackend = (): Window["DeckyBackend"] | null =>
  window.DeckyBackend ?? window.opener?.DeckyBackend ?? null;

// If Decky's own loader install dies silently (e.g. a dead asset URL),
// nothing else would ever flip the "installing" state back off — this is
// an inactivity reset (re-armed on every progress tick), not a single fixed
// deadline, so a legitimately slow download isn't falsely flagged.
const INSTALL_WATCHDOG_TIMEOUT_MS = 45_000;

interface PluginUpdateBannerProps {
  info: PluginUpdateInfo | null;
  onClick: () => void;
}

// Small top-of-panel notice, clickable — takes the user straight to the
// Settings section where the actual update/version-picker controls live,
// rather than duplicating the install flow here. Renders nothing until an
// update is actually confirmed. Same exact green look as the original,
// simpler UpdateBanner.tsx this replaced — only the click target changed
// (Settings instead of the GitHub release page).
export function PluginUpdateBanner({ info, onClick }: PluginUpdateBannerProps) {
  const { t } = useTranslation("plugin_update");
  if (!info?.has_update) return null;
  return (
    <div style={{ margin: "0 16px 8px" }}>
      <style>{`
        .plch-update-btn:focus {
          background: #4caf50 !important;
          color: #fff !important;
          border-color: #4caf50 !important;
        }
      `}</style>
      <DialogButton
        className="plch-update-btn"
        onClick={onClick}
        style={{
          padding: "6px 10px",
          background: "#1a2a1a",
          border: "1px solid #4caf50",
          borderRadius: "6px",
          fontSize: 11,
          color: "#4caf50",
          textAlign: "center",
          width: "100%",
        }}
      >
        {t("banner", { version: info.latest_version })}
      </DialogButton>
    </div>
  );
}

interface PluginUpdateSectionProps {
  info: PluginUpdateInfo | null;
  checking: boolean;
  expanded: boolean;
  onToggle: () => void;
  onCheckNow: () => void;
}

// Collapsed-by-default details section: current/latest version, a link to
// the release page, and a version picker (defaults to latest) that installs
// via Decky Loader's own installer — same route the plugin store uses.
export function PluginUpdateSection({
  info,
  checking,
  expanded,
  onToggle,
  onCheckNow,
}: PluginUpdateSectionProps) {
  const { t } = useTranslation("plugin_update");
  const [installing, setInstalling] = useState(false);
  const [downloadActive, setDownloadActive] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const downloadActiveRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [releases, setReleases] = useState<PluginRelease[] | null>(null);
  const [loadingReleases, setLoadingReleases] = useState(false);
  const [selectedTag, setSelectedTagState] = useState<string | null>(() =>
    Date.now() - lastSelectedTagAt < SELECTION_RESTORE_WINDOW_MS
      ? lastSelectedTag || null
      : null,
  );
  const setSelectedTag = (tag: string) => {
    lastSelectedTag = tag;
    lastSelectedTagAt = Date.now();
    setSelectedTagState(tag);
  };

  // Lazy-load the release list once, the first time this section is opened.
  useEffect(() => {
    if (!expanded || releases !== null || loadingReleases) return;
    setLoadingReleases(true);
    fetchPluginReleases()
      .then((list) => {
        setReleases(list);
        // Only default to the newest release if nothing was already picked
        // (e.g. restored from a pick that survived the panel remount above).
        if (list.length > 0 && !selectedTag) setSelectedTag(list[0].tag);
      })
      .finally(() => setLoadingReleases(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, releases, loadingReleases]);

  // Mirrors Decky's own loader install progress — the install_plugin call
  // below only registers the request (Decky pops its own confirm modal and
  // does the actual download/extract), so this is how we know it's moving.
  useEffect(() => {
    const backend = getDeckyBackend();
    const name = info?.plugin_display_name;
    if (!backend || !name) return;

    const clearWatchdog = () => {
      if (watchdogRef.current !== null) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
    };
    const armWatchdog = () => {
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        if (!downloadActiveRef.current) return;
        downloadActiveRef.current = false;
        setDownloadActive(false);
        setInstalling(false);
        toaster.toast({
          title: t("install_failed_title"),
          body: t("install_timeout"),
        });
      }, INSTALL_WATCHDOG_TIMEOUT_MS);
    };

    const onStart = (eventName: string) => {
      if (eventName !== name) return;
      downloadActiveRef.current = true;
      setDownloadActive(true);
      setDownloadPercent(0);
      armWatchdog();
    };
    const onInfo = (percent: number) => {
      if (!downloadActiveRef.current) return;
      setDownloadPercent(percent);
      armWatchdog();
    };
    const onFinish = (eventName: string) => {
      if (eventName !== name) return;
      downloadActiveRef.current = false;
      setDownloadPercent(100);
      setDownloadActive(false);
      setInstalling(false);
      clearWatchdog();
      // Decky's own install flow already re-imports the Python backend, but
      // the frontend bundle already running in the browser stays the old
      // one until something tells Decky to re-fetch and remount it — same
      // route Decky's own "reload plugin" button uses.
      backend.call("loader/reload_plugin", name).catch(() => {});
    };

    backend.addEventListener("loader/plugin_download_start", onStart);
    backend.addEventListener("loader/plugin_download_info", onInfo);
    backend.addEventListener("loader/plugin_download_finish", onFinish);
    return () => {
      backend.removeEventListener("loader/plugin_download_start", onStart);
      backend.removeEventListener("loader/plugin_download_info", onInfo);
      backend.removeEventListener("loader/plugin_download_finish", onFinish);
      clearWatchdog();
    };
  }, [info?.plugin_display_name, t]);

  const installRelease = async (
    displayName: string,
    version: string,
    assetUrl: string,
    sha256: string,
  ) => {
    const backend = getDeckyBackend();
    if (!backend) {
      toaster.toast({
        title: t("install_failed_title"),
        body: t("no_backend"),
      });
      return;
    }
    setInstalling(true);
    try {
      // Only registers the request and pops Decky's own native confirm
      // modal (which owns the actual download/install and its own progress
      // bar) — returns immediately, the listeners above mirror the rest.
      await backend.call(
        "utilities/install_plugin",
        assetUrl,
        displayName,
        version,
        sha256 || "",
        installTypeFor(version, info?.current_version ?? version),
      );
    } catch (e) {
      setInstalling(false);
      toaster.toast({
        title: t("install_failed_title"),
        body: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const selectedRelease = releases?.find((r) => r.tag === selectedTag) ?? null;
  const selectedIsCurrent =
    !!selectedRelease && !!info && selectedRelease.version === info.current_version;

  const onInstallSelected = () => {
    if (!info || !selectedRelease) return;
    installRelease(
      info.plugin_display_name,
      selectedRelease.version,
      selectedRelease.asset_url,
      selectedRelease.sha256,
    );
  };

  // Navigation.NavigateToExternalWeb opens Steam's own browser overlay —
  // unlike a plain <a target="_blank">, it's reachable through the
  // gamepad-driven focus system the rest of this UI relies on.
  const onViewRelease = () => {
    if (info?.release_url) Navigation.NavigateToExternalWeb(info.release_url);
  };

  const busy = installing || downloadActive || checking;

  return (
    <CollapsibleSection
      label={t("section_label")}
      expanded={expanded}
      onToggle={onToggle}
    >
      <PanelSectionRow>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          {t("current", { version: info?.current_version || "?" })}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
          {!info || !info.checked_ok
            ? t("check_failed")
            : info.has_update
              ? t("latest", { version: info.latest_version })
              : t("up_to_date")}
        </div>
      </PanelSectionRow>

      {(downloadActive || installing) && (
        <PanelSectionRow>
          <ProgressBarWithInfo
            layout="inline"
            bottomSeparator="none"
            nProgress={downloadPercent}
            sOperationText={
              downloadActive ? t("downloading") : t("installing")
            }
          />
        </PanelSectionRow>
      )}

      {info?.release_url && (
        <PanelSectionRow>
          <ButtonItem layout="below" onClick={onViewRelease} disabled={busy}>
            {t("view_release")}
          </ButtonItem>
        </PanelSectionRow>
      )}

      <PanelSectionRow>
        <ButtonItem layout="below" onClick={onCheckNow} disabled={busy}>
          {checking ? t("checking") : t("check_button")}
        </ButtonItem>
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 8 }}>
          {t("choose_version_label")}
        </div>
      </PanelSectionRow>
      {releases && releases.length > 0 && (
        <PanelSectionRow>
          <DropdownItem
            rgOptions={releases.map((r) => ({
              data: r.tag,
              label: r.prerelease ? `${r.version} (pre-release)` : r.version,
            }))}
            selectedOption={selectedTag}
            layout="below"
            onChange={(opt) => setSelectedTag(opt.data)}
          />
        </PanelSectionRow>
      )}
      {releases && releases.length === 0 && (
        <PanelSectionRow>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {t("no_releases")}
          </div>
        </PanelSectionRow>
      )}
      <PanelSectionRow>
        <ButtonItem
          layout="below"
          onClick={onInstallSelected}
          disabled={busy || !selectedRelease || selectedIsCurrent}
        >
          {loadingReleases
            ? t("checking")
            : selectedIsCurrent
              ? t("already_installed", { version: selectedRelease!.version })
              : selectedRelease
                ? t("install_button", { version: selectedRelease.version })
                : t("check_button")}
        </ButtonItem>
      </PanelSectionRow>
    </CollapsibleSection>
  );
}
