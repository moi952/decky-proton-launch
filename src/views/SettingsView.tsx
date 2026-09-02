import React from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  ToggleField,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useSettings, DefaultHome } from "../context/SettingsContext";
import { ActionButton, AnchoredDropdown, CollapsibleSection, QrCodeButton } from "@moi952/decky-ui-kit";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiRefreshCw, FiImage } from "react-icons/fi";
import { useRemoteData } from "../context/RemoteDataContext";
import { openGenericDeleteModal } from "../utils/modals";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { WhatsNewCard } from "../components/WhatsNewCard";
import { PluginUpdateSection } from "../components/PluginUpdate";
import { OtherPluginRow } from "../components/OtherPluginRow";
import { usePluginUpdate } from "../context/PluginUpdateContext";
import {
  markPluginUpdateExpanded,
  isPluginUpdateExpansionFresh,
} from "../utils/pluginUpdateFocus";
import {
  markOtherPluginsExpanded,
  isOtherPluginsExpansionFresh,
} from "../utils/otherPluginsFocus";
import { isFeatureRequestFocusFresh } from "../utils/featureRequestFocus";
import { FEATURE_REQUEST_URL, BUG_REPORT_URL, KOFI_URL } from "../utils/links";
import { clearCoverCache } from "../utils/coverCache";
import { CoverImageType } from "../context/SettingsContext";
import { useOtherPlugins } from "../context/OtherPluginsContext";

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const {
    isCategoryVisible,
    toggleCategory,
    defaultHome,
    setDefaultHome,
    hideVariablesPage,
    setHideVariablesPage,
    showActiveSection,
    setShowActiveSection,
    coverImageType,
    setCoverImageType,
  } = useSettings();
  const { t } = useTranslation("categories");
  const { t: tSettings } = useTranslation("settings_view");
  const { others: otherPlugins } = useOtherPlugins();
  const { variables: variablesData, refresh } = useRemoteData();
  const { clearCustomWrappers } = useCustomWrappers();
  const { clearCustomVariables } = useCustomVariables();
  const [cachePath, setCachePath] = React.useState<string>("");
  const [showWhatsNewHistory, setShowWhatsNewHistory] = React.useState(false);
  const [showOtherPlugins, setShowOtherPluginsState] = React.useState(
    isOtherPluginsExpansionFresh,
  );
  const setShowOtherPlugins = (v: boolean) => {
    if (v) markOtherPluginsExpanded();
    setShowOtherPluginsState(v);
  };
  const [showPluginUpdate, setShowPluginUpdateState] = React.useState(
    isPluginUpdateExpansionFresh,
  );
  const setShowPluginUpdate = (v: boolean) => {
    if (v) markPluginUpdateExpanded();
    setShowPluginUpdateState(v);
  };
  // Keeps the restore window alive the whole time it's expanded, not just
  // at the moment it was toggled.
  React.useEffect(() => {
    if (!showPluginUpdate) return;
    const heartbeat = setInterval(markPluginUpdateExpanded, 1000);
    return () => clearInterval(heartbeat);
  }, [showPluginUpdate]);
  React.useEffect(() => {
    if (!showOtherPlugins) return;
    const heartbeat = setInterval(markOtherPluginsExpanded, 1000);
    return () => clearInterval(heartbeat);
  }, [showOtherPlugins]);
  // True only when this mount restored an already-expanded section, never
  // on a normal fresh visit.
  const wasRestoredExpanded = React.useRef(showPluginUpdate).current;
  const pluginUpdateSectionRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!wasRestoredExpanded) return;
    // Targets the last enabled focusable element (the Install button, last
    // in DOM order — see PluginUpdate.tsx). Disabled elements are excluded
    // since it starts disabled until releases finish loading; retried on a
    // few delays to catch it once that happens.
    const focusAndScrollToLast = () => {
      const container = pluginUpdateSectionRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([aria-disabled="true"]), [tabindex]:not([disabled]):not([aria-disabled="true"]), a[href]',
      );
      const target = focusables[focusables.length - 1];
      if (!target) return;
      target.focus();
      // Delayed a couple of frames so it runs after Steam's own
      // focus-driven scroll adjustment, not before it (it overrides ours).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center" });
        });
      });
    };

    focusAndScrollToLast();
    const retries = [300, 700, 1200].map((delay) =>
      setTimeout(focusAndScrollToLast, delay),
    );
    return () => retries.forEach(clearTimeout);
  }, [wasRestoredExpanded]);
  // Same restore-and-land pattern as the plugin-update section above, for
  // the banner's own "Aller aux paramètres" button — lands right on the
  // "My other plugins" header (already expanded) instead of just the top
  // of the page, leaving the user to hunt for it themselves.
  const wasOtherPluginsRestoredExpanded = React.useRef(showOtherPlugins).current;
  const otherPluginsSectionRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!wasOtherPluginsRestoredExpanded) return;
    const focusAndScrollToFirst = () => {
      const container = otherPluginsSectionRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        'button:not([disabled]):not([aria-disabled="true"]), [tabindex]:not([disabled]):not([aria-disabled="true"]), a[href]',
      );
      if (!target) return;
      target.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center" });
        });
      });
    };

    focusAndScrollToFirst();
    const retries = [300, 700, 1200].map((delay) =>
      setTimeout(focusAndScrollToFirst, delay),
    );
    return () => retries.forEach(clearTimeout);
  }, [wasOtherPluginsRestoredExpanded]);
  // Same restore-and-land pattern, for the What's New banner's own
  // "Suggest a feature" button — lands right on the real feature-request
  // QR code in the GitHub section below instead of just the top of the
  // page. No expand/collapse involved here (unlike the two above), so
  // just a one-shot scroll+focus on a fresh landing.
  const featureRequestFresh = React.useRef(isFeatureRequestFocusFresh()).current;
  const featureRequestSectionRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!featureRequestFresh) return;
    const focusAndScrollToFirst = () => {
      const container = featureRequestSectionRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(
        'button:not([disabled]):not([aria-disabled="true"]), [tabindex]:not([disabled]):not([aria-disabled="true"]), a[href]',
      );
      if (!target) return;
      target.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          target.scrollIntoView({ block: "center" });
        });
      });
    };

    focusAndScrollToFirst();
    const retries = [300, 700, 1200].map((delay) =>
      setTimeout(focusAndScrollToFirst, delay),
    );
    return () => retries.forEach(clearTimeout);
  }, [featureRequestFresh]);
  const {
    info: pluginUpdateInfo,
    checking: checkingPluginUpdate,
    checkNow: checkPluginUpdateNow,
  } = usePluginUpdate();

  React.useEffect(() => {
    call<[], string>("get_variables_cache_path").then(setCachePath);
  }, []);

  return (
    <div>
      <PanelSection>
        <Focusable
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
          flow-children="horizontal"
        >
          <ActionButton onClick={onBack}>
            <FiArrowLeft size={16} />
          </ActionButton>
          <span style={{ fontWeight: 600 }}>{tSettings("settings")}</span>
        </Focusable>
      </PanelSection>

      <PanelSection>
        <PanelSectionRow>
          <CollapsibleSection
            label={tSettings("whats_new_history")}
            expanded={showWhatsNewHistory}
            onToggle={() => setShowWhatsNewHistory((v) => !v)}
          >
            <WhatsNewCard />
          </CollapsibleSection>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("default_home")}>
        <PanelSectionRow>
          <ToggleField
            label={tSettings("hide_variables_page")}
            checked={hideVariablesPage}
            onChange={setHideVariablesPage}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <AnchoredDropdown
            options={[
              ...(hideVariablesPage
                ? []
                : [{ value: "home", label: tSettings("default_home_vars") }]),
              {
                value: "game-manager",
                label: tSettings("default_home_game_manager"),
              },
              {
                value: "global-commands",
                label: tSettings("default_home_global_commands"),
              },
            ]}
            selectedValue={defaultHome}
            onChange={(value) => setDefaultHome(value as DefaultHome)}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("settings_categories")}>
        <PanelSectionRow>
          <ToggleField
            label={tSettings("show_active_section")}
            checked={showActiveSection}
            onChange={setShowActiveSection}
          />
        </PanelSectionRow>
        {variablesData.map((cat) => (
          <React.Fragment key={cat.category}>
            <PanelSectionRow>
              <ToggleField
                label={t(cat.category)}
                checked={isCategoryVisible(cat.category)}
                onChange={() => toggleCategory(cat.category)}
              />
            </PanelSectionRow>
            {cat.subCategory && (
              <PanelSectionRow>
                <div style={{ marginLeft: 16 }}>
                  <ToggleField
                    label={t(cat.subCategory.title)}
                    checked={isCategoryVisible(cat.subCategory.title)}
                    onChange={() => toggleCategory(cat.subCategory!.title)}
                  />
                </div>
              </PanelSectionRow>
            )}
          </React.Fragment>
        ))}
      </PanelSection>

      <PanelSection title={tSettings("images_title")}>
        <PanelSectionRow>
          <AnchoredDropdown
            options={[
              { value: "portrait", label: tSettings("cover_image_type_portrait") },
              { value: "landscape", label: tSettings("cover_image_type_landscape") },
              { value: "banner", label: tSettings("cover_image_type_banner") },
            ]}
            selectedValue={coverImageType}
            onChange={(value) => {
              setCoverImageType(value as CoverImageType);
              clearCoverCache();
            }}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ActionButton
            onClick={() => {
              clearCoverCache();
              toaster.toast({ title: tSettings("images_title"), body: tSettings("purge_image_cache_done") });
            }}
            width="100%"
          >
            <FiImage size={14} style={{ marginRight: 6 }} />
            {tSettings("purge_image_cache")}
          </ActionButton>
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("github_section_title")}>
        <PanelSectionRow>
          <div ref={pluginUpdateSectionRef}>
            <PluginUpdateSection
              info={pluginUpdateInfo}
              checking={checkingPluginUpdate}
              expanded={showPluginUpdate}
              onToggle={() => setShowPluginUpdate(!showPluginUpdate)}
              onCheckNow={checkPluginUpdateNow}
            />
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <div ref={featureRequestSectionRef}>
            <QrCodeButton
              value={FEATURE_REQUEST_URL}
              label={tSettings("feature_request_button")}
              hint={tSettings("feature_request_hint")}
            />
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <QrCodeButton
            value={BUG_REPORT_URL}
            label={tSettings("bug_report_button")}
            hint={tSettings("bug_report_hint")}
          />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title={tSettings("support_section_title")}>
        <PanelSectionRow>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
            {tSettings("kofi_description")}
          </div>
          <QrCodeButton
            value={KOFI_URL}
            label={tSettings("kofi_button")}
            hint={tSettings("kofi_hint")}
          />
        </PanelSectionRow>
        {otherPlugins.length > 0 && (
          <PanelSectionRow>
            <div ref={otherPluginsSectionRef}>
              <CollapsibleSection
                label={tSettings("other_plugins_section_title")}
                expanded={showOtherPlugins}
                onToggle={() => setShowOtherPlugins(!showOtherPlugins)}
              >
                <div style={{ marginTop: 8, marginLeft: 16 }}>
                  {otherPlugins.map((plugin) => (
                    <OtherPluginRow key={plugin.id} plugin={plugin} />
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          </PanelSectionRow>
        )}
      </PanelSection>

      <PanelSection title={tSettings("data_title")}>
        {cachePath && (
          <React.Fragment>
            <PanelSectionRow>
              <ActionButton onClick={refresh} width="100%">
                <FiRefreshCw size={14} style={{ marginRight: 6 }} />
                {tSettings("force_refresh")}
              </ActionButton>
            </PanelSectionRow>
            <PanelSectionRow>
              <div
                style={{
                  fontSize: 9,
                  color: "#555",
                  fontFamily: "monospace",
                  wordBreak: "break-all",
                  lineHeight: "1.4",
                  marginTop: 8,
                  marginBottom: 8,
                }}
              >
                {cachePath}
              </div>
            </PanelSectionRow>
          </React.Fragment>
        )}
      </PanelSection>

      <PanelSection title={tSettings("reset_title")}>
        <PanelSectionRow>
          <div style={{ marginBottom: 8 }}>
            <ActionButton
              variant="danger"
              width="100%"
              onClick={() =>
                openGenericDeleteModal({
                  title: tSettings("clean_custom_wrappers_confirm_title"),
                  description: tSettings(
                    "clean_custom_wrappers_confirm_description",
                  ),
                  onConfirm: clearCustomWrappers,
                })
              }
            >
              {tSettings("clean_custom_wrappers")}
            </ActionButton>
          </div>
        </PanelSectionRow>
        <PanelSectionRow>
          <ActionButton
            variant="danger"
            width="100%"
            onClick={() =>
              openGenericDeleteModal({
                title: tSettings("clean_custom_variables_confirm_title"),
                description: tSettings(
                  "clean_custom_variables_confirm_description",
                ),
                onConfirm: clearCustomVariables,
              })
            }
          >
            {tSettings("clean_custom_variables")}
          </ActionButton>
        </PanelSectionRow>
      </PanelSection>
    </div>
  );
};
