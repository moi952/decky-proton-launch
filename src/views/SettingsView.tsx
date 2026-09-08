import React from "react";
import {
  Focusable,
  PanelSection,
  PanelSectionRow,
  ToggleField,
} from "@decky/ui";
import { call, toaster } from "@decky/api";
import { useSettings, DefaultHome } from "../context/SettingsContext";
import { ActionButton, AnchoredDropdown } from "@moi952/decky-ui-kit";
import {
  UpdateHistorySection,
  GitHubSection,
  SupportSection,
  getWhatsNewVersions,
} from "@moi952/decky-plugin-toolkit";
import { useTranslation } from "react-i18next";
import { FiArrowLeft, FiRefreshCw, FiImage } from "react-icons/fi";
import { useRemoteData } from "../context/RemoteDataContext";
import { openGenericDeleteModal } from "../utils/modals";
import { useCustomWrappers } from "../context/CustomWrappersContext";
import { useCustomVariables } from "../context/CustomVariablesContext";
import { fetchPluginReleases } from "../utils/githubReleases";
import { FEATURE_REQUEST_URL, BUG_REPORT_URL } from "../utils/links";
import { clearCoverCache } from "../utils/coverCache";
import { CoverImageType } from "../context/SettingsContext";

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
  const { variables: variablesData, refresh } = useRemoteData();
  const { clearCustomWrappers } = useCustomWrappers();
  const { clearCustomVariables } = useCustomVariables();
  const [cachePath, setCachePath] = React.useState<string>("");

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

      <UpdateHistorySection versions={getWhatsNewVersions()} />

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
          <div style={{ marginTop: 8 }}>
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
          </div>
        </PanelSectionRow>
      </PanelSection>

      <GitHubSection
        fetchReleases={fetchPluginReleases}
        featureRequestUrl={FEATURE_REQUEST_URL}
        bugReportUrl={BUG_REPORT_URL}
      />

      <SupportSection />

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
