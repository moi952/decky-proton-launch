import { Field } from "@decky/ui";
import type { ReactNode } from "react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa";

interface CollapsibleSectionProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Field is the actual generic building block Decky's own ToggleField/
// SliderField/etc. are built on — using it here (instead of a hand-styled
// DialogButton) gets the standard padding and bottom separator for free,
// matching every other row in this panel instead of approximating it.
export function CollapsibleSection({
  label,
  expanded,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <>
      <Field
        label={label}
        onActivate={onToggle}
        onClick={onToggle}
        focusable
        bottomSeparator="standard"
        childrenLayout="inline"
      >
        {expanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
      </Field>
      {expanded && children}
    </>
  );
}
