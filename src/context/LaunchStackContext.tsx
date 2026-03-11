import React, { createContext, useContext, useState } from "react";

interface LaunchStackContextValue {
  stack: string[];
  addToStack: (line: string) => void;
  removeFromStack: (line: string) => void;
  clearStack: () => void;
}

const LaunchStackContext = createContext<LaunchStackContextValue | null>(null);

export const LaunchStackProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [stack, setStack] = useState<string[]>([]);

  const addToStack = (line: string) => {
    setStack((prev) => (prev.includes(line) ? prev : [...prev, line]));
  };

  const removeFromStack = (line: string) => {
    setStack((prev) => prev.filter((l) => l !== line));
  };

  const clearStack = () => setStack([]);

  return (
    <LaunchStackContext.Provider
      value={{ stack, addToStack, removeFromStack, clearStack }}
    >
      {children}
    </LaunchStackContext.Provider>
  );
};

export const useLaunchStack = () => {
  const ctx = useContext(LaunchStackContext);
  if (!ctx) throw new Error("useLaunchStack must be used within AppProvider");
  return ctx;
};
