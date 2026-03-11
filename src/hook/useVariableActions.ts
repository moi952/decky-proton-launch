import { copy } from "../utils/functions";
import { useLaunchStack } from "../context/LaunchStackContext";

interface UseVariableActionsProps {
  env: string;
  selectedValue: string;
}

export const useVariableActions = ({
  env,
  selectedValue,
}: UseVariableActionsProps) => {
  const { addToStack } = useLaunchStack();

  const line = env === "" ? selectedValue : `${env}=${selectedValue}`;

  return {
    line,
    copyLine: () => copy(line),
    copyWithCmd: () => copy(`${line} %command%`),
    addToStack: () => addToStack(line),
  };
};
