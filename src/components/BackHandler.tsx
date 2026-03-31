import React from "react";
import { Focusable } from "@decky/ui";

interface BackHandlerProps {
  onBack?: () => void;
  children: React.ReactNode;
}

export const BackHandler: React.FC<BackHandlerProps> = ({ onBack, children }) => (
  <Focusable onCancelButton={onBack}>{children}</Focusable>
);
