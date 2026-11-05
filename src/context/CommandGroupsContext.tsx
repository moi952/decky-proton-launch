import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { call } from "@decky/api";
import { GROUPS_UPDATED_EVENT, GroupFilter } from "../utils/groupFilter";

// A named set of env vars applied together onto the games listed in appids.
// With a filter, games that match it are picked up automatically.
export interface CommandGroup {
  id: string;
  name: string;
  vars: Record<string, string>;
  appids: number[];
  filter?: GroupFilter;
}

interface CommandGroupsContextValue {
  groups: CommandGroup[];
  addGroup: (
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) => CommandGroup | null;
  editGroup: (
    id: string,
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) => void;
  setGroupAppIds: (id: string, appids: number[]) => void;
  removeGroup: (id: string) => void;
}

const CommandGroupsContext = createContext<CommandGroupsContextValue | null>(
  null,
);

export const CommandGroupsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [groups, setGroups] = useState<CommandGroup[]>([]);
  // Mirrors the state so several updates in a row (e.g. after a bulk run)
  // each build on the latest list instead of a stale render's copy.
  const latest = useRef<CommandGroup[]>([]);

  useEffect(() => {
    const load = () =>
      call<[], CommandGroup[]>("get_command_groups")
        .then((data) => {
          latest.current = data ?? [];
          setGroups(latest.current);
        })
        .catch(() => {});
    load();
    // The background scan can change the saved groups while the panel is
    // open — reload, or the next save here would overwrite that change.
    window.addEventListener(GROUPS_UPDATED_EVENT, load);
    return () => window.removeEventListener(GROUPS_UPDATED_EVENT, load);
  }, []);

  const commit = (next: CommandGroup[]) => {
    latest.current = next;
    setGroups(next);
    call<[CommandGroup[]], boolean>("set_command_groups", next).catch(() => {});
  };

  const addGroup = (
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) => {
    if (latest.current.some((g) => g.name === name)) return null;
    const group: CommandGroup = {
      id: crypto.randomUUID(),
      name,
      vars,
      appids: [],
      filter,
    };
    commit([...latest.current, group]);
    return group;
  };

  const editGroup = (
    id: string,
    name: string,
    vars: Record<string, string>,
    filter?: GroupFilter,
  ) =>
    commit(
      latest.current.map((g) =>
        g.id === id ? { ...g, name, vars, filter } : g,
      ),
    );

  const setGroupAppIds = (id: string, appids: number[]) =>
    commit(latest.current.map((g) => (g.id === id ? { ...g, appids } : g)));

  const removeGroup = (id: string) =>
    commit(latest.current.filter((g) => g.id !== id));

  return (
    <CommandGroupsContext.Provider
      value={{ groups, addGroup, editGroup, setGroupAppIds, removeGroup }}
    >
      {children}
    </CommandGroupsContext.Provider>
  );
};

export const useCommandGroups = () => {
  const ctx = useContext(CommandGroupsContext);
  if (!ctx) throw new Error("useCommandGroups must be used within AppProvider");
  return ctx;
};
