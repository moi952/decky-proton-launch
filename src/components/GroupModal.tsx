import React, { useMemo, useState } from "react";
import { DialogButton, Focusable, ModalRoot, TextField } from "@decky/ui";
import { useTranslation } from "react-i18next";
import { CommandGroup } from "../context/CommandGroupsContext";
import { parseLaunchText } from "../utils/parseLaunchText";
import { varsToLaunchText } from "../utils/bulkApply";
import { GROUP_FILTER_CYCLE, GroupFilter } from "../utils/groupFilter";

export interface GroupModalProps {
  existing?: CommandGroup;
  // Names of the OTHER groups, to keep names unique.
  otherNames: string[];
  onSave: (
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) => void;
  onClose: () => void;
}

const MAX_PREVIEW = 6;

// Takes its data as props, like the custom variable modal — showModal()
// renders outside the main provider tree (see ButtonAddCustomVariableModal).
export const GroupModalContent: React.FC<GroupModalProps> = ({
  existing,
  otherNames,
  onSave,
  onClose,
}) => {
  const { t } = useTranslation("command_groups");
  const { t: tCommon } = useTranslation("common");
  const [name, setName] = useState(existing?.name ?? "");
  const [text, setText] = useState(
    existing ? varsToLaunchText(existing.vars) : "",
  );
  const [filter, setFilter] = useState<GroupFilter | undefined>(
    existing?.filter,
  );
  const [error, setError] = useState("");

  const nextFilter =
    GROUP_FILTER_CYCLE[
      (GROUP_FILTER_CYCLE.indexOf(filter) + 1) % GROUP_FILTER_CYCLE.length
    ];

  const parsed = useMemo(() => parseLaunchText(text), [text]);
  const entries = Object.entries(parsed.vars);
  const hasBlankValue = entries.some(([, value]) => !value.trim());

  // Shown live under the text field, before any save attempt.
  const liveProblem = parsed.unbalancedQuote
    ? t("error_unbalanced")
    : parsed.unsupported.length > 0
      ? t("error_unsupported", { tokens: parsed.unsupported.join(" ") })
      : hasBlankValue
        ? t("error_empty_value")
        : "";

  const handleSubmit = () => {
    if (!name.trim()) return setError(t("error_name_required"));
    if (otherNames.includes(name.trim())) return setError(t("error_name_used"));
    if (liveProblem) return setError(liveProblem);
    if (entries.length === 0) return setError(t("error_no_vars"));
    onSave(name.trim(), parsed.vars, filter);
    onClose();
  };

  return (
    <ModalRoot>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ fontWeight: 600 }}>
          {existing ? t("modal_title_edit") : t("modal_title_new")}
        </div>
        <TextField
          label={t("field_name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label={t("field_text")}
          description={t("field_text_hint")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {entries.length > 0 && (
          <div
            style={{
              fontSize: 11,
              color: "#aaa",
              lineHeight: 1.5,
              wordBreak: "break-all",
            }}
          >
            <div style={{ color: "#ccc" }}>{t("preview_title")}</div>
            {entries.slice(0, MAX_PREVIEW).map(([key, value]) => (
              <div key={key}>
                {key} = {value}
              </div>
            ))}
            {entries.length > MAX_PREVIEW && (
              <div>
                {t("preview_more", { count: entries.length - MAX_PREVIEW })}
              </div>
            )}
          </div>
        )}
        <DialogButton onClick={() => setFilter(nextFilter)}>
          {t("field_filter")} :{" "}
          {filter ? t(`filter_${filter}`) : t("filter_none")}
        </DialogButton>
        <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
          {t("filter_hint")}
        </div>
        {(error || liveProblem) && (
          <span style={{ color: "#ff4444", fontSize: 12 }}>
            {error || liveProblem}
          </span>
        )}
        <Focusable
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          flow-children="horizontal"
        >
          <DialogButton onClick={onClose}>{tCommon("cancel")}</DialogButton>
          <DialogButton onClick={handleSubmit}>
            {existing ? tCommon("save") : tCommon("create")}
          </DialogButton>
        </Focusable>
      </div>
    </ModalRoot>
  );
};
