import { showModal } from "@decky/ui";
import { AppProvider } from "../context/AppProvider";
import { FavoriteModalContent } from "../components/ButtonFavoriteModal";
import { DeleteFavoriteModalContent } from "../components/ButtonDeleteFavoriteModal";
import { DeleteCustomVariableModalContent } from "../components/ButtonDeleteCustomVariableModal";
import { ConfirmDeleteModal } from "../components/ConfirmDeleteModal";
import {
  CustomVariableModalContent,
  CustomVariableModalContext,
} from "../components/ButtonAddCustomVariableModal";
import {
  CustomWrapperModalContent,
  CustomWrapperModalContext,
} from "../components/ButtonAddCustomWrapperModal";
import { CustomVariable } from "../context/CustomVariablesContext";
import { CustomWrapper } from "../context/CustomWrappersContext";

export const openFavoriteModal = (params: {
  variableName: string;
  env: string;
  value: string;
}) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <FavoriteModalContent
        variableName={params.variableName}
        env={params.env}
        value={params.value}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};

export const openDeleteFavoriteModal = (title: string) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <DeleteFavoriteModalContent
        title={title}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};

export const openGenericDeleteModal = (params: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <ConfirmDeleteModal
      title={params.title}
      description={params.description}
      confirmLabel={params.confirmLabel}
      onConfirm={params.onConfirm}
      onClose={() => modal?.Close()}
    />,
  );
};

// ctx must come from the caller's own useCustomVariables()/useCustomWrappers()
// instance (see GlobalCommandsView) — this function has no hooks of its own,
// and wrapping in <AppProvider> here would spin up a separate provider
// instance whose edits wouldn't reflect back in the real list.
export const openEditCustomVariableModal = (
  variable: CustomVariable,
  ctx: CustomVariableModalContext,
) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <CustomVariableModalContent
      existing={variable}
      {...ctx}
      onClose={() => modal?.Close()}
    />,
  );
};

export const openEditCustomWrapperModal = (
  wrapper: CustomWrapper,
  ctx: CustomWrapperModalContext,
) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <CustomWrapperModalContent
      existing={wrapper}
      {...ctx}
      onClose={() => modal?.Close()}
    />,
  );
};

export const openDeleteCustomVariableModal = (id: string, name: string) => {
  let modal: ReturnType<typeof showModal> | null = null;
  modal = showModal(
    <AppProvider>
      <DeleteCustomVariableModalContent
        id={id}
        name={name}
        onClose={() => modal?.Close()}
      />
    </AppProvider>,
  );
};
