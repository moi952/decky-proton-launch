import React from "react";
import { AnchoredDropdown, AnchoredDropdownProps } from "@moi952/decky-ui-kit";

const BG = "#333";
const TEXT = "#ccc";
const BORDER = "#555";

type ThemedDropdownProps = Omit<
  AnchoredDropdownProps,
  "bgColor" | "textColor" | "borderColor"
>;

// The plugin's base dropdown style — outline focus, Proton Launch colors.
// Callers only override what makes their specific case different.
export const ThemedDropdown: React.FC<ThemedDropdownProps> = ({
  focusStyle = "outline",
  ...rest
}) => (
  <AnchoredDropdown
    bgColor={BG}
    textColor={TEXT}
    borderColor={BORDER}
    focusStyle={focusStyle}
    {...rest}
  />
);
