import React from "react";
import { DialogButton } from "@decky/ui";

interface ValButtonProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

export const ValButton: React.FC<ValButtonProps> = ({ selected, onClick, children }) => (
  <>
    <style>{`
      .plch-val-btn {
        padding: 3px 8px !important;
        font-size: 11px !important;
        min-width: 0 !important;
        background: #333 !important;
        border: 2px solid transparent !important;
        color: #ccc !important;
      }
      .plch-val-btn.plch-val-selected {
        border-color: #dcdedf !important;
        color: #fff !important;
      }
      .plch-val-btn:focus,
      .plch-val-btn:hover {
        background: #555 !important;
        border-color: #fff !important;
        color: #fff !important;
      }
    `}</style>
    <DialogButton
      className={`plch-val-btn${selected ? " plch-val-selected" : ""}`}
      onClick={onClick}
    >
      {children}
    </DialogButton>
  </>
);
